'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Link } from '@astryxdesign/core/Link';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import type { MapPointInspection } from '@/components/cartography/LeafletGrid';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import { eventLabel, eventMeasurement, MissionEventRecorder, scenarioPoint } from '@/components/workbench/MissionEventRecorder';
import type { EventSubmission } from '@/components/workbench/MissionEventRecorder';
import { conservativeSummary, marginText } from '@/components/workbench/MissionPlanPreview';
import { ThemeControlPopup } from '@/components/workbench/ThemeControlPopup';
import scenario from '@/config/mission-scenario.json';
import type { FieldBundle } from '@/data/loader';
import { scienceResources, zeroResources } from '@/engine/consumables';
import { liveFrontierMembership, summarizeFrontier } from '@/engine/frontier';
import { advanceMission, decideReplan, logStopObservation, proposeReturn, remainingActivePlan, startMission } from '@/engine/lifecycle-store';
import type { MissionExecution } from '@/engine/lifecycle-store';
import { archiveMarkdown, createArchive, missionClock } from '@/engine/mission-archive';
import { canApprove, landingCell, landingId, planInVisitOrder, stopLimit, targetCell } from '@/engine/multi-leg-planner';
import type { MissionPlan, RoutePreference } from '@/engine/multi-leg-planner';
import { recordNavigationEvent, routeChange } from '@/engine/navigation-revision';
import { cellIndex, hasModeledTerrain, isNeighborhoodCell } from '@/engine/traverse-graph';
import type { Cell } from '@/engine/traverse-graph';
import type { ScienceTarget } from '@/engine/types';
import './navigation.css';

const distanceText = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
const stopName = (name: string) => name.split(' · ')[0];
const sameCell = (a: Cell | null, b: Cell) => a?.[0] === b[0] && a[1] === b[1];

type Revision = { before: MissionPlan; after: MissionPlan; reason: string; eventId: number };
type Session = { execution: MissionExecution; revisions: Revision[]; alert: boolean; reviewBefore: MissionPlan | null };
const routeOptions = [
  { value: 'fastest', label: 'Fastest modeled travel' },
  { value: 'lowerSlope', label: 'Prefer gentler grades' },
  { value: 'firmGround', label: 'Prefer higher thermal inertia' },
];

function planStatus(plan: MissionPlan): string {
  if (canApprove(plan)) return 'Keeps return reserves at all modeled paces';
  if (plan.state === 'UNKNOWN') return 'Terrain or location evidence is missing';
  if (plan.legs.some(leg => leg.route.status !== 'READY')) return 'No supported route for at least one leg';
  return plan.state === 'MARGINAL' ? 'Return reserves fit only at some modeled paces' : 'Below the modeled return reserves';
}

function saveFile(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function comparisonText(before: MissionPlan, after: MissionPlan) {
  const changedPath = routeChange(before, after);
  const result = [changedPath.added.length || changedPath.previous.length ? 'Path changed' : 'Same path'];
  const previousIds = before.stops.map(stop => stop.id);
  const nextIds = after.stops.map(stop => stop.id);
  for (const stop of before.stops) {
    const next = after.stops.find(candidate => candidate.id === stop.id);
    if (!next) result.push(`Skipped ${stopName(stop.name)}`);
    else if (next.activity.minutes !== stop.activity.minutes) {
      result.push(`${stopName(stop.name)}: ${stop.activity.minutes} → ${next.activity.minutes} min of fieldwork`);
    }
  }
  for (const stop of after.stops) {
    if (!previousIds.includes(stop.id)) result.push(`Added ${stopName(stop.name)}`);
  }
  if (previousIds.filter(id => nextIds.includes(id)).join('|') !== nextIds.filter(id => previousIds.includes(id)).join('|')) {
    result.push('Stop order changed');
  }
  return result.join(' · ');
}

export function NavigationWorkbench({ bundle }: { bundle: FieldBundle }) {
  const {manifest} = bundle;
  const neighborhood = manifest.mapDisplay?.neighborhood;
  const hasNeighborhood = Boolean(neighborhood && bundle.contextData?.neighborhoodMask && bundle.contextData.neighborhoodElevation);
  const panel = useRef<HTMLElement>(null);
  const [delay, setDelay] = useState(0);
  const base = useMemo(() => landingCell(bundle), [bundle]);
  const catalog = manifest.scienceTargets ?? [];
  const [stops, setStops] = useState<ScienceTarget[]>([]);
  const [query, setQuery] = useState('');
  const [mapPoint, setMapPoint] = useState<MapPointInspection | null>(null);
  const [preference, setPreference] = useState<RoutePreference>('fastest');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [selectedLeg, setSelectedLeg] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [fit, setFit] = useState<{key: number; cells?: Cell[]}>({key: 0});
  const [resetKey, setResetKey] = useState(0);
  const [layerPanel, showLayerPanel] = useState(false);
  const [optical, setOptical] = useState(Boolean(manifest.optical));
  const [elevation, setElevation] = useState(false);
  const [geology, setGeology] = useState(false);
  const [thermal, setThermal] = useState(false);
  const [frontier, setFrontier] = useState(false);
  const [is3D, set3D] = useState(false);
  const [historyRevision, setHistoryRevision] = useState<Revision | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const storageKey = `seshat-navigation:${manifest.sourceFileSha256}:${manifest.baseIndex}`;
  const execution = session?.execution;
  const completed = execution?.status === 'COMPLETED';
  const reviewing = execution?.status === 'REVIEW' || execution?.status === 'HOLD';

  const [saved] = useState<{session: Session | null; unavailable?: boolean}>(() => {
    if (typeof window === 'undefined') return {session: null};
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Session | null;
      return {session: stored?.execution?.active && Array.isArray(stored.revisions) ? stored : null, unavailable: Boolean(stored && !stored.execution?.active)};
    } catch { return {session: null, unavailable: true}; }
  });

  function saveSession(next: Session) {
    setSession(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice('Local saving is unavailable. Download the route from History.'); }
  }

  const draft = useMemo(() => stops.length
    ? planInVisitOrder({bundle, origin: base, stops, spent: zeroResources, routePreference: preference})
    : null, [bundle, base, stops, preference]);
  const active = useMemo(() => execution ? remainingActivePlan(execution, bundle) : null, [execution, bundle]);
  const returning = useMemo(() => execution && !completed ? proposeReturn(execution, bundle) : null, [execution, bundle, completed]);
  const fieldBranch = selectedBranch === 'finish-stop' ? execution?.finishProposal : selectedBranch === 'leave-stop' ? execution?.leaveStopProposal : null;
  const branch = execution?.triageBranches?.find(option => option.id === selectedBranch);
  const selectedPlan = reviewing ? fieldBranch ?? branch?.plan ?? execution?.proposal : null;
  const delayedDraft = useMemo(() => draft && delay > 0 ? planInVisitOrder({
    bundle, origin: base, stops, spent: scienceResources(delay), routePreference: preference,
  }) : null, [bundle, base, stops, draft, delay, preference]);
  const mapPlan = historyRevision && !reviewing ? historyRevision.after : selectedPlan ?? active ?? draft;
  const legIndex = selectedLeg ?? 0;
  const nextLeg = active?.legs[0];
  const viewedLeg = mapPlan?.legs[legIndex];
  const progress = execution?.activeStopId ? execution.stopProgress?.[execution.activeStopId] : null;
  const latest = session?.revisions.at(-1);
  const visibleRevision = historyRevision ?? (session?.alert ? latest : null);
  const comparing = visibleRevision ? routeChange(visibleRevision.before, visibleRevision.after)
    : reviewing && session?.reviewBefore && selectedPlan ? routeChange(session.reviewBefore, selectedPlan) : null;
  const position = execution?.position ?? base;
  const lastEvent = execution?.events.at(-1);
  const blockedStop = lastEvent?.category === 'DESTINATION_ACCESSIBILITY_CHANGE'
    ? active?.stops.find(stop => stop.id === lastEvent.targetId)
    : undefined;
  const centralPosition = cellIndex(position, bundle) >= 0;
  const membership = useMemo(() => frontier && centralPosition ? liveFrontierMembership(bundle, {
    origin: position, spent: execution?.spent ?? zeroResources, hazards: execution?.hazards,
    speedFactor: execution?.speedFactor, preference: execution?.active.routePreference ?? preference,
  }) : null, [bundle, frontier, centralPosition, position, execution, preference]);
  const coverage = membership && summarizeFrontier(membership, manifest.cellWidthMeters, manifest.cellHeightMeters);
  const point = mapPoint?.cell;
  const pointIndex = point ? cellIndex(point, bundle) : -1;
  const pointInCoverage = point && (pointIndex >= 0 || isNeighborhoodCell(bundle, point));
  const pointEligible = point && pointIndex !== manifest.baseIndex && hasModeledTerrain(bundle, point);
  const shownStops = catalog.filter(stop => !stops.some(prior => prior.id === stop.id) &&
    stop.name.toLowerCase().includes(query.trim().toLowerCase()));

  function revealUpdate() {
    panel.current?.scrollTo({top: 0});
  }

  function fitRoute(cells?: Cell[]) {
    set3D(false);
    setFit(previous => ({key: previous.key + 1, cells}));
  }

  function addStop(stop: ScienceTarget) {
    const cell = targetCell(stop);
    if (!cell || !hasModeledTerrain(bundle, cell)) {
      setNotice('This point has no supported route location.');
      return;
    }
    if (cellIndex(cell, bundle) === manifest.baseIndex || stops.some(existing => sameCell(targetCell(existing), cell))) {
      setNotice('This location is already on the route.');
      return;
    }
    if (stops.length >= stopLimit) {
      setNotice(`The route can include up to ${stopLimit} stops. Remove one before adding another.`);
      return;
    }
    setStops([...stops, stop]);
    setQuery('');
    setNotice('');
    setSelectedLeg(stops.length);
    fitRoute();
  }

  function moveStop(index: number, direction: number) {
    const ordered = [...stops];
    [ordered[index], ordered[index + direction]] = [ordered[index + direction], ordered[index]];
    setStops(ordered);
    setSelectedLeg(index + direction);
  }

  function focusLeg(index: number) {
    setSelectedLeg(index);
    fitRoute(mapPlan?.legs[index]?.route.geometryGrid);
  }

  function applyRevision(next: MissionExecution, before: MissionPlan, reason: string) {
    if (!session) return;
    const after = remainingActivePlan(next, bundle);
    const revision = {before, after, reason, eventId: next.events.at(-1)?.id ?? 0};
    saveSession({...session, execution: next, revisions: [...session.revisions, revision], alert: true, reviewBefore: null});
    setSelectedBranch(null);
    setSelectedLeg(null);
    setHistoryRevision(null);
    revealUpdate();
    const delta = routeChange(before, after);
    if (delta.added.length || delta.previous.length) fitRoute([...delta.added.flat(), ...delta.previous.flat()]);
  }

  function submitEvent(event: EventSubmission) {
    if (!execution || !session) return;
    const outcome = recordNavigationEvent(execution, bundle, event.details, event.description);
    const reason = outcome.automatic && event.details.category === 'NEW_TERRAIN_HAZARD' &&
      routeChange(outcome.before, remainingActivePlan(outcome.execution, bundle)).added.length
      ? 'The route now avoids the reported terrain exclusion'
      : eventLabel(event.details.category);
    if (outcome.automatic) applyRevision(outcome.execution, outcome.before, reason);
    else {
      saveSession({...session, execution: outcome.execution, reviewBefore: outcome.before, alert: false});
      revealUpdate();
    }
    setSelectedBranch(null);
    setHistoryRevision(null);
    setEventOpen(false);
  }

  function choosePlan(plan: MissionPlan, choice: 'approved' | 'abort', stopAction?: 'finish-stop' | 'leave-stop') {
    if (!session || !execution || !active) return;
    const next = decideReplan(execution, plan, choice, stopAction ? {stopAction} : undefined);
    if (next === execution) return;
    const latestEvent = execution.events.at(-1);
    const reason = choice === 'abort' ? 'Direct return selected' : latestEvent ? eventLabel(latestEvent.category) : 'Route option selected';
    applyRevision(next, session.reviewBefore ?? active, reason);
  }

  function advance(action: 'arrive' | 'finish') {
    if (!session || !execution) return;
    saveSession({...session, execution: advanceMission(execution, bundle, action)});
    setSelectedLeg(null);
    setMapPoint(null);
    setNote('');
    revealUpdate();
  }

  function exportRoute(format: 'json' | 'md') {
    const plan = execution?.baseline ?? draft;
    if (!plan) return;
    const archive = createArchive(plan, manifest, execution, bundle.contextData);
    const body = format === 'json' ? JSON.stringify(archive, null, 2) : archiveMarkdown(archive);
    saveFile(`seshat-route.${format}`, body, format === 'json' ? 'application/json' : 'text/markdown');
  }

  const mapMission = {
    planned: mapPlan?.legs ?? [], previousSpans: comparing?.previous,
    traveled: execution?.travels, hazards: execution?.hazards,
    position: execution?.position, selected: pointEligible ? mapPoint?.cell : null,
    focusedLeg: legIndex, onSelectLeg: focusLeg, preview: reviewing,
  };

  return (
    <main className="nav-workbench">
      <header className="nav-header">
        <div className="nav-brand"><strong>SESHAT</strong><span>Jezero Crater</span></div>
        <div className="nav-header-actions"><ThemeControlPopup /><Link href="/dev/">Dev workbench</Link></div>
      </header>

      <aside ref={panel} className="nav-sidebar" aria-label="Route panel">
        <h1 tabIndex={-1}>{completed ? 'Back at the landing site' : reviewing ? 'Review your route' : execution ? progress ? stopName(progress.stopName) : `Head to ${stopName(nextLeg?.to ?? 'Landing Site')}` : 'Plan a traverse'}</h1>
        <p className="nav-muted">{execution ? `${missionClock(execution.spent.minutes)} elapsed · ${execution.completed.length} stops completed` : 'Start at the landing site, add science stops, and plan your way back.'}</p>

        {notice && <p className="nav-note nav-warning" role="status">{notice}</p>}

        {visibleRevision && !reviewing && <div className="nav-note">
          <div role="status">
            <strong>Route updated · {comparisonText(visibleRevision.before, visibleRevision.after)}</strong>
            <p className="nav-muted">{visibleRevision.reason}. {!historyRevision && nextLeg && `Follow the highlighted route to ${stopName(nextLeg.to)}.`}</p>
            {comparing?.previous.length ? <p className="nav-muted">Previous path shown as a faint dashed line.</p> : null}
          </div>
          <Collapsible defaultIsOpen={false} trigger="View changes">
            <p className="nav-muted">Before the event: {marginText(conservativeSummary(visibleRevision.before)?.margin ?? null)} above reserve.</p>
            <p className="nav-muted">Applied route: {marginText(conservativeSummary(visibleRevision.after)?.margin ?? null)} above reserve. Both use the slower modeled pace.</p>
          </Collapsible>
          <Button label="Dismiss update" size="sm" variant="ghost" onClick={() => {
            setHistoryRevision(null);
            if (session) saveSession({...session, alert: false});
          }} />
        </div>}

        {!execution && <section className="nav-section" aria-label="Choose stops">
          <TextInput label="Find a science stop" placeholder="Search Jezero sites" value={query} onChange={setQuery} />
          <ul className="nav-point-list">
            {shownStops.map(stop => <li key={stop.id}>
              <span>{stop.name}</span>
              <Button label={`Add ${stopName(stop.name)}`} size="sm" variant="ghost" onClick={() => addStop(stop)} />
            </li>)}
          </ul>
          {query && !shownStops.length && <p role="status" className="nav-muted">No matching science stops.</p>}
          {saved.unavailable && <p className="nav-muted" role="status">Saved route unavailable.</p>}
          {saved.session && !draft && <Button label="Resume saved route" size="sm" variant="secondary" onClick={() => {
            if (!saved.session) return;
            saveSession(saved.session);
            setSelectedLeg(null);
            fitRoute();
          }} />}
          <Collapsible defaultIsOpen={false} trigger="Choose by grid coordinates">
            <CoordinatePicker onChoose={cell => addStop(catalog.find(stop => sameCell(targetCell(stop), cell)) ?? scenarioPoint(cell))} />
          </Collapsible>
        </section>}

        {mapPoint && <section className="nav-section" aria-label="Selected map point">
          <h2>{pointIndex === manifest.baseIndex ? 'Landing site' : pointEligible ? 'Selected point' : pointInCoverage ? 'Terrain data unavailable here' : 'Outside modeled terrain'}</h2>
          <p className="nav-muted">{pointEligible || pointIndex === manifest.baseIndex
            ? `${mapPoint.label}${mapPoint.elevationMeters == null ? '' : ` · ${Math.round(mapPoint.elevationMeters)} m elevation`}`
            : 'Choose a point with terrain data to add a route stop.'}</p>
          <div className="nav-actions">
            {!execution && pointEligible && <Button label="Add this point" size="sm" onClick={() => {
              const cell = mapPoint.cell!;
              addStop(catalog.find(stop => sameCell(targetCell(stop), cell)) ?? scenarioPoint(cell, pointIndex >= 0 ? `Point (${cell.join(', ')})` : mapPoint.label));
            }} />}
            <Button label="Clear selection" size="sm" variant="ghost" onClick={() => setMapPoint(null)} />
          </div>
        </section>}

        {completed && <section className="nav-section">
          <h2>Traverse complete</h2>
          <p className="nav-muted">Recorded use: {Math.round(execution.spent.minutes)} min · {Math.round(execution.spent.oxygen)} L oxygen · {Math.round(execution.spent.energy)} Wh.</p>
          <Button label="Plan another route" size="sm" onClick={() => {
            setSession(null);
            setStops([]);
            setHistoryRevision(null);
            setDelay(0);
            fitRoute();
          }} />
        </section>}

        {reviewing && execution && session && lastEvent && <section className="nav-section" aria-label="Route options">
          <div className="nav-note nav-warning">
            <strong>{eventLabel(lastEvent.category)}</strong>
            <p className="nav-muted">{eventMeasurement(lastEvent)}. Choose how to continue.</p>
            {blockedStop && <p>Blocked stop: {stopName(blockedStop.name)}</p>}
          </div>
          {execution.status === 'HOLD' && <Button label="Resume review" size="sm" onClick={() => saveSession({
            ...session, execution: {...execution, status: 'REVIEW'},
          })} />}
          {execution.status === 'REVIEW' && selectedPlan && <Button label="Hold position" variant="ghost" size="sm"
            onClick={() => saveSession({...session, execution: decideReplan(execution, selectedPlan, 'held')})} />}
          {execution.status === 'REVIEW' && execution.finishProposal && execution.leaveStopProposal && selectedPlan && <>
            <Selector label="Fieldwork options" size="sm" value={selectedBranch ?? execution.recommendedProposal ?? 'leave-stop'}
              options={[{value: 'finish-stop', label: 'Finish planned fieldwork'}, {value: 'leave-stop', label: 'Leave with work recorded'}]}
              onChange={setSelectedBranch} />
            {session.reviewBefore && <p>{comparisonText(session.reviewBefore, selectedPlan)}</p>}
            <p className="nav-muted">{planStatus(selectedPlan)} · {marginText(conservativeSummary(selectedPlan)?.margin ?? null)} at slower modeled pace</p>
            <Button label={selectedPlan === execution.finishProposal ? 'Finish fieldwork and continue' : 'Leave with work recorded'}
              size="sm" isDisabled={!canApprove(selectedPlan)} onClick={() => choosePlan(selectedPlan, 'approved',
                selectedPlan === execution.finishProposal ? 'finish-stop' : 'leave-stop')} />
          </>}
          {execution.status === 'REVIEW' && !execution.finishProposal && selectedPlan && <>
            {execution.triageBranches && execution.triageBranches.length > 1 && <Selector label="Compare route options" size="sm"
              options={execution.triageBranches.map(option => ({value: option.id, label: option.label}))}
              value={branch?.id ?? execution.triageBranches[0].id} onChange={setSelectedBranch} />}
            {session.reviewBefore && <p>{comparisonText(session.reviewBefore, selectedPlan)}</p>}
            <p className="nav-muted">{planStatus(selectedPlan)} · {marginText(conservativeSummary(selectedPlan)?.margin ?? null)} at slower modeled pace</p>
            <Button label={selectedPlan.stops.length ? 'Use this route' : 'Return without more stops'} size="sm" isDisabled={!canApprove(selectedPlan)}
              onClick={() => choosePlan(selectedPlan, 'approved')} />
          </>}
        </section>}

        {execution && !reviewing && !completed && <section className="nav-section" aria-label="Next action">
          {progress ? <>
            <p>Fieldwork · {Math.round(progress.exploredMinutes)} of {Math.round(progress.plannedMinutes)} min recorded</p>
            <TextInput label="Observation" value={note} onChange={setNote} placeholder="Add a field note" />
            <div className="nav-actions">
              <Button label="Save note" size="sm" variant="secondary" isDisabled={!note.trim()} onClick={() => {
                if (session) saveSession({...session, execution: logStopObservation(execution, note.trim())});
                setNote('');
              }} />
              <Button label="Complete fieldwork" size="sm" onClick={() => advance('finish')} />
            </div>
          </> : nextLeg && <>
            <p>{distanceText(nextLeg.terrain.distance)} · {Math.round(nextLeg.arrival - nextLeg.departure)} min estimated</p>
            {nextLeg.terrain.steepEdges > 0 && <p className="nav-muted">Steeper terrain ahead. See the elevation profile for this leg.</p>}
            <div className="nav-actions">
              <Button label={nextLeg.targetId === landingId ? 'Mark return to landing site' : `Mark arrival at ${stopName(nextLeg.to)}`} onClick={() => advance('arrive')} />
            </div>
          </>}
          <Button label={eventOpen ? 'Close event form' : 'Report a change'} size="sm" variant="secondary" onClick={() => setEventOpen(value => !value)} />
          {eventOpen && <MissionEventRecorder manualOnly position={position} selected={pointEligible ? mapPoint?.cell ?? null : null}
            remaining={active?.stops ?? []} nextEvent={execution.events.length + 1} onRecord={submitEvent} />}
        </section>}

        {mapPlan?.legs.length ? <section className="nav-section" aria-label="Itinerary">
          <h2>{execution ? reviewing ? 'Proposed itinerary' : 'Remaining itinerary' : 'Round trip'}</h2>
          <div className="nav-summary">
            <strong>{mapPlan.used ? `${Math.round(mapPlan.used.minutes)} min` : 'Time unknown'}</strong>
            {mapPlan.used && <span>{distanceText(mapPlan.legs.reduce((sum, leg) => sum + leg.terrain.distance, 0))}</span>}
          </div>
          <p className="nav-muted">{planStatus(mapPlan)}</p>
          {!execution && mapPlan.used && <p className="nav-muted">{conservativeSummary(mapPlan)?.limitingLabel} is the tightest reserve at the slower modeled pace.</p>}
          {!execution && <div className="nav-actions">
            <Button label="Start route" isDisabled={!draft || !canApprove(draft)} onClick={() => {
              if (!draft) return;
              saveSession({execution: startMission(draft, stops), revisions: [], alert: false, reviewBefore: null});
              setSelectedLeg(null);
              revealUpdate();
              fitRoute(draft.legs[0]?.route.geometryGrid);
            }} />
          </div>}
          <ol className="nav-steps">
            {mapPlan.legs.map((leg, index) => <li className="nav-step" data-active={legIndex === index} key={leg.targetId}>
              <span className="nav-step-mark" aria-hidden="true">{leg.targetId === landingId ? '↩' : index + 1}</span>
              <div>
                <Button label={leg.targetId === landingId ? 'Return to Landing Site' : leg.to} size="sm" variant="ghost" onClick={() => focusLeg(index)} />
                <div className="nav-muted nav-step-copy">{leg.route.status === 'READY' ? `${distanceText(leg.terrain.distance)} · ${Math.round(leg.arrival - leg.departure)} min` : 'Route unavailable'}</div>
              </div>
              {!execution && stops[index] && <div className="nav-actions nav-edit-stop">
                <NumberInput label="Fieldwork (min)" size="sm" isIntegerOnly min={0} max={scenario.timeBudgetMinutes}
                  value={stops[index].activity.minutes} onChange={minutes => {
                    if (!Number.isFinite(minutes) || minutes < 0 || minutes > scenario.timeBudgetMinutes) return;
                    setStops(stops.map((stop, i) => i === index ? {...stop, activity: {...stop.activity, minutes}} : stop));
                  }} />
                <Button label="Earlier" size="sm" variant="ghost" isDisabled={!index} onClick={() => moveStop(index, -1)} />
                <Button label="Later" size="sm" variant="ghost" isDisabled={index === stops.length - 1} onClick={() => moveStop(index, 1)} />
                <Button label="Remove" size="sm" variant="ghost" onClick={() => {
                  setStops(stops.filter((_, i) => i !== index));
                  setSelectedLeg(null);
                }} />
              </div>}
            </li>)}
          </ol>
          {viewedLeg?.route.status === 'READY' && <Collapsible defaultIsOpen={false} trigger="Terrain along this leg">
            <ElevationProfile route={viewedLeg.route} cellWidthMeters={manifest.cellWidthMeters} cellHeightMeters={manifest.cellHeightMeters} label={stopName(viewedLeg.to)} />
            <p className="nav-muted">Peak modeled grade {viewedLeg.terrain.peakSlope.toFixed(1)}° · {viewedLeg.terrain.steepEdges} edges above 15°</p>
          </Collapsible>}
          <Collapsible defaultIsOpen={false} trigger="Return reserves">
            <p className="nav-muted">Surplus above the required time, oxygen and battery reserves.</p>
            {mapPlan.margins.map(({speed, margin}) => <p className="nav-muted" key={speed}>{speed}× pace · {marginText(margin)}</p>)}
          </Collapsible>
        </section> : null}

        {!execution && <section className="nav-section">
          <Collapsible defaultIsOpen={false} trigger="Route preference">
            <Selector label="Route preference" size="sm" options={bundle.contextData?.thermalInertia ? routeOptions : routeOptions.slice(0, 2)}
              value={preference} onChange={value => setPreference(value as RoutePreference)} />
          </Collapsible>
          {draft && <Collapsible defaultIsOpen={false} trigger="Try a departure delay">
            <NumberInput label="Delay preview (min)" size="sm" isIntegerOnly min={0} max={scenario.timeBudgetMinutes}
              value={delay} onChange={minutes => {
                if (Number.isFinite(minutes) && minutes >= 0 && minutes <= scenario.timeBudgetMinutes) setDelay(minutes);
              }} />
            {delayedDraft && <p className="nav-muted" role="status">
              {planStatus(delayedDraft)}. {marginText(conservativeSummary(delayedDraft)?.margin ?? null)} above reserves at the slower modeled pace.
            </p>}
          </Collapsible>}
        </section>}

        {returning && (reviewing || nextLeg?.targetId !== landingId) && <section className="nav-section">
          <Collapsible defaultIsOpen={false} trigger="Direct return">
            <p className="nav-muted">{planStatus(returning)} · {marginText(conservativeSummary(returning)?.margin ?? null)} at slower modeled pace</p>
            <Button label={canApprove(returning) ? 'Return to Landing Site' : 'Return with a reserve shortfall'} variant="secondary" size="sm"
              isDisabled={returning.legs.at(-1)?.route.status !== 'READY'} onClick={() => choosePlan(returning, 'abort')} />
          </Collapsible>
        </section>}

        <section className="nav-section">
          <Collapsible defaultIsOpen={false} trigger="Sources and coverage">
            <p className="nav-muted">{hasNeighborhood && neighborhood
              ? `Route planning covers all ${neighborhood.chunks.length} terrain chunks across ${neighborhood.spanMeters / 1000} × ${neighborhood.spanMeters / 1000} km, where elevation data supports a path. The return frontier is calculated for the central ${manifest.cellWidthMeters} m grid.`
              : `The ${manifest.cellWidthMeters} m terrain grid is available. Wider routing data is unavailable in this bundle.`}</p>
            <p className="nav-muted">{manifest.status === 'SOURCE_REVIEW_REQUIRED' ? 'Terrain and source-reported locations are pending review.' : 'Terrain source information is recorded in the dataset.'} Time, oxygen and battery estimates use the research scenario.</p>
            {manifest.sourceUrl && <Link href={manifest.sourceUrl} target="_blank" rel="noreferrer">USGS terrain source</Link>}
            {viewedLeg && catalog.find(stop => stop.id === viewedLeg.targetId)?.science.evidence.map(source => (
              <p key={source.url}><Link href={source.url} target="_blank" rel="noreferrer">{source.title}</Link></p>
            ))}
          </Collapsible>
        </section>

        {(execution || draft) && <section className="nav-section">
          <Collapsible defaultIsOpen={false} trigger="History and export">
            {execution?.events.map(event => <p className="nav-muted" key={event.id}>{missionClock(event.minute)} · {eventLabel(event.category)} · {eventMeasurement(event)}</p>)}
            {execution?.fieldObservations?.map(observation => <p className="nav-muted" key={observation.id}>{observation.stopName} · {observation.note}</p>)}
            {session?.revisions.map((revision, index) => <div key={index} className="nav-actions">
              <Button label={`View change ${index + 1}: ${revision.reason}`} size="sm" variant="ghost" onClick={() => {
                setHistoryRevision(revision);
                revealUpdate();
                const change = routeChange(revision.before, revision.after);
                if (change.added.length || change.previous.length) fitRoute([...change.added.flat(), ...change.previous.flat()]);
              }} />
            </div>)}
            <div className="nav-actions">
              <Button label="Download JSON" variant="secondary" size="sm" onClick={() => exportRoute('json')} />
              <Button label="Download Markdown" variant="secondary" size="sm" onClick={() => exportRoute('md')} />
              <Button label="Print" variant="ghost" size="sm" onClick={() => window.print()} />
            </div>
          </Collapsible>
        </section>}
      </aside>

      <section className="nav-map field-map" aria-label="Jezero route map">
        {reviewing && <p className="nav-map-preview">Proposed route</p>}
        <LeafletGrid bundle={bundle} selectedCell={null} onCellSelect={() => undefined} onInspectPoint={setMapPoint} neighborhoodOverview
          elapsedMinutes={execution?.spent.minutes ?? 0} missionBudgetMinutes={scenario.timeBudgetMinutes} reserveMinutes={scenario.reserveMinutes}
          showOptical={optical} showElevation={elevation} showGeology={geology} showThermal={thermal}
          show3D={is3D} onToggle3D={() => set3D(false)} showFrontier={frontier && centralPosition} liveFrontier={membership}
          fitRequestKey={fit.key} fitCells={fit.cells} resetViewRequestKey={resetKey} mission={mapMission} />
        <div className="nav-toolbar">
          <Button label="Layers" size="sm" variant="secondary" aria-expanded={layerPanel} onClick={() => showLayerPanel(value => !value)} />
          <Button label="Fit route" size="sm" variant="secondary" isDisabled={!mapPlan} onClick={() => fitRoute()} />
          <Button label="Back to Jezero" size="sm" variant="secondary" onClick={() => {set3D(false); setResetKey(key => key + 1);}} />
          <Button label={is3D ? 'Back to 2D' : '3D terrain'} size="sm" variant="secondary" onClick={() => set3D(value => !value)} />
        </div>
        {layerPanel && <div className="nav-layer-panel" aria-label="Map layers">
          <Selector label="Base map" size="sm" value={optical ? 'orbital' : 'terrain'} onChange={value => setOptical(value === 'orbital')}
            options={manifest.optical ? [{value: 'terrain', label: 'Terrain'}, {value: 'orbital', label: 'Orbital'}] : [{value: 'terrain', label: 'Terrain'}]} />
          <div className="nav-actions">
            <Button label="Elevation" size="sm" variant={elevation ? 'primary' : 'secondary'} aria-pressed={elevation} onClick={() => setElevation(value => !value)} />
            {bundle.contextData?.geologicUnits && <Button label="Geology" size="sm" variant={geology ? 'primary' : 'secondary'} aria-pressed={geology} onClick={() => setGeology(value => !value)} />}
            {bundle.contextData?.thermalInertia && <Button label="Thermal" size="sm" variant={thermal ? 'primary' : 'secondary'} aria-pressed={thermal} onClick={() => setThermal(value => !value)} />}
            {!is3D && <Button label="Return frontier" size="sm" variant={frontier ? 'primary' : 'secondary'} aria-pressed={frontier} onClick={() => setFrontier(value => !value)} />}
          </div>
          {!is3D && frontier && <p className="nav-muted">{coverage
            ? `${coverage.fullScienceKm2.toFixed(1)} km² for science and return · ${coverage.totalReachableKm2.toFixed(1)} km² including transit only (slower modeled pace)`
            : 'Return frontier coverage unavailable at this position.'}</p>}
        </div>}
        <p className="nav-credit">NASA / JPL · USGS</p>
      </section>
    </main>
  );
}

function CoordinatePicker({onChoose}: {onChoose: (cell: Cell) => void}) {
  const [row, setRow] = useState('');
  const [column, setColumn] = useState('');
  const valid = [row, column].every(value => /^-?\d+$/.test(value.trim()));
  return <form onSubmit={event => {
    event.preventDefault();
    if (valid) onChoose([Number(row), Number(column)]);
  }}>
    <TextInput label="Grid row" value={row} onChange={setRow} />
    <TextInput label="Grid column" value={column} onChange={setColumn} />
    <Button label="Add coordinates" type="submit" size="sm" isDisabled={!valid} />
  </form>;
}
