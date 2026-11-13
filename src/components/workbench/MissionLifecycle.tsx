'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import type { FieldBundle } from '@/data/loader';
import { addResources, subtractResources, zeroResources } from '@/engine/consumables';
import { advanceMission, decideReplan, proposeReturn, recordEvent, remainingActivePlan, startMission } from '@/engine/lifecycle-store';
import type { MissionExecution } from '@/engine/lifecycle-store';
import { archiveMarkdown, createArchive, missionClock } from '@/engine/mission-archive';
import { canApprove, landingCell, landingId, previewMission, stopLimit, targetCell } from '@/engine/multi-leg-planner';
import type { MissionPlan, RoutePreference } from '@/engine/multi-leg-planner';
import { cellIndex } from '@/engine/traverse-graph';
import type { Cell } from '@/engine/traverse-graph';
import type { ScienceTarget } from '@/engine/types';
import scenario from '@/config/mission-scenario.json';
import { channelLabels, eventLabel, eventMeasurement, MissionEventRecorder, scenarioPoint } from './MissionEventRecorder';
import type { EventSubmission } from './MissionEventRecorder';
import { marginText, MissionPlanPreview, nominalMargin, PlanComparison } from './MissionPlanPreview';

const photos: Record<string, {file: string; caption: string}> = {
  'swift-run': {file: 'skinner-ridge.webp', caption: 'Thornton Gap abrasion, Skinner Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
  hazeltop: {file: 'wildcat-ridge.webp', caption: 'Berry Hollow abrasion, Wildcat Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS'},
  shuyak: {file: 'enchanted-lake.webp', caption: 'Enchanted Lake area · Perseverance Hazcam · NASA/JPL-Caltech'},
};

function download(filename: string, body: string, type: string) {
  const href = URL.createObjectURL(new Blob([body], {type}));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function SiteEvidence({stop}: {stop: ScienceTarget}) {
  const photo = photos[stop.id];
  return <details className="mission-disclosure site-evidence">
    <summary>Science & provenance</summary>
    <p>{stop.science.summary}</p>
    <p>{stop.location.originalCoordinateText}</p>
    {photo && <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- local evidence images ship with the offline export */}
      <img loading="lazy" src={`/data/imagery/${photo.file}`} alt={photo.caption} />
      <figcaption>{photo.caption}</figcaption>
    </figure>}
    {stop.science.evidence.map(item => <p key={item.sourceId}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></p>)}
  </details>;
}

function SelectionPanel({catalog, selected, limit, onMode, onAdd, onChange, onReorder}: {
  catalog: ScienceTarget[]; selected: ScienceTarget[]; limit: number;
  onMode: (limit: number) => void; onAdd: (stop: ScienceTarget) => void;
  onChange: (stops: ScienceTarget[]) => void; onReorder: (index: number) => void;
}) {
  return <>
    <section className="rail-intro">
      <h1>Plan a science traverse</h1>
      <p>Compare sedimentary exposures on Jezero’s western fan and return to the scenario landing site.</p>
      <div className="mission-actions" role="group" aria-label="Destination mode">
        <button type="button" aria-pressed={limit === 1} onClick={() => onMode(1)}>Single</button>
        <button type="button" aria-pressed={limit > 1} onClick={() => onMode(stopLimit)}>Multiple</button>
      </div>
    </section>
    <section className="rail-section">
      <h2>Stop priorities</h2>
      <p className="context-note">Top priority is kept first when stops must be deferred. Select a science site or click the map to add a point.</p>
      <ol className="mission-stop-list">
        {selected.map((stop, index) => <li key={stop.id}>
          <div><strong>{stop.name}</strong><button type="button" aria-label={`Remove ${stop.name}`}
            onClick={() => onChange(selected.filter(item => item.id !== stop.id))}>×</button></div>
          <div><label>Activity (min)<input type="number" min="0" max="120" value={stop.activity.minutes}
            onChange={event => onChange(selected.map(item => item.id === stop.id ? {...stop,
              activity: {...stop.activity, minutes: Math.max(0, Math.min(120, Number(event.target.value)))}} : item))} /></label>
            {index > 0 && <button type="button" aria-label={`Raise priority of ${stop.name}`} onClick={() => onReorder(index)}>↑ Priority</button>}</div>
        </li>)}
      </ol>
    </section>
    <section className="rail-section mission-catalog">
      <h2>Science sites</h2>
      {catalog.map(stop => <div key={stop.id}>
        <Button label={`Add ${stop.name}`} onClick={() => onAdd(stop)}
          isDisabled={!targetCell(stop) || selected.some(item => item.id === stop.id) || (limit > 1 && selected.length >= limit)} />
        <SiteEvidence stop={stop}/>
      </div>)}
    </section>
  </>;
}

function ExecutionPanel({mission, onAdvance, onEvent, selected}: {
  mission: MissionExecution; onAdvance: (progress: 'part' | 'finish') => void;
  onEvent: (entry: EventSubmission) => void; selected: Cell | null;
}) {
  const leg = mission.active.legs[mission.legIndex];
  const complete = mission.status === 'COMPLETED';
  const remaining = mission.active.stops.filter(stop => !mission.completed.includes(stop.id) &&
    !mission.events.some(event => event.category === 'DESTINATION_ACCESSIBILITY_CHANGE' && event.targetId === stop.id));
  const baselineIndex = complete ? mission.baseline.legs.length - 1
    : mission.baseline.legs.findIndex(leg => leg.targetId === mission.completed.at(-1));
  const baselineClock = mission.baseline.legs[baselineIndex]?.leave;
  const baselineResources = baselineIndex < 0 ? null
    : mission.baseline.legs.slice(0, baselineIndex + 1).reduce((total, leg) => addResources(total, leg.used), zeroResources);
  const completedStopName = (id: string) => {
    const baseline = mission.baseline.stops.find(stop => stop.id === id);
    const discovered = mission.events.find(event => event.category === 'NEW_SCIENTIFIC_DISCOVERY' && event.target.id === id);
    return baseline?.name ?? (discovered?.category === 'NEW_SCIENTIFIC_DISCOVERY' ? discovered.target.name : id);
  };
  return <>
    <section className="rail-intro">
      <h1>{complete ? 'Returned to landing site' : 'Execute the approved plan'}</h1>
      <p>Simulated position ({mission.position.join(', ')}) · {missionClock(mission.spent.minutes)}</p>
      <p>{mission.spent.oxygen.toFixed(1)} L O₂ and {mission.spent.energy.toFixed(1)} Wh consumed.</p>
      {baselineClock !== undefined && baselineResources && <p>Baseline at {complete ? 'return' : 'the latest completed baseline stop'} · {missionClock(baselineClock)} · {baselineResources.oxygen.toFixed(1)} L O₂ · {baselineResources.energy.toFixed(1)} Wh</p>}
      {leg && <p>Next: {leg.to}</p>}
      {!complete && <div className="mission-buttons">
        <Button label="Move along active leg" onClick={() => onAdvance('part')}
          isDisabled={mission.status !== 'EXECUTING' || mission.cursor >= (leg?.route.geometryGrid.length ?? 1) - 1} />
        <Button label={leg?.targetId === landingId ? 'Return to Landing Site' : 'Complete next stop'}
          variant="primary" onClick={() => onAdvance('finish')} isDisabled={mission.status !== 'EXECUTING'} />
      </div>}
    </section>
    <section className="rail-section">
      <h2>Mission history</h2>
      <p className="context-note" role="status">{complete ? 'Returned · archive ready'
        : mission.status === 'REVIEW' ? 'Event analyzed · revised plan awaiting approval'
        : mission.status === 'HOLD' ? 'Holding · record a new event or review direct return'
        : mission.decisions.length ? 'Continuing on the approved revision' : 'Baseline approved · tracking progress'}</p>
      <ol className="mission-history">
        {mission.completed.map(id => <li key={id}>✓ {completedStopName(id)}</li>)}
        {mission.events.map(event => <li key={event.id}>{missionClock(event.minute)} · {eventLabel(event.category)}
          <small>{channelLabels[event.channel]} · {eventMeasurement(event)} · ({event.cell.join(', ')})
            {event.description && ` · ${event.description}`}</small></li>)}
        {mission.decisions.map((decision, i) => <li key={i}>{missionClock(decision.minute)} · Revision {decision.kind}</li>)}
      </ol>
      {!mission.completed.length && !mission.events.length && <p className="context-note">Baseline locked. Progress appears here as the mission advances.</p>}
    </section>
    {!complete && <section className="rail-section">
      <h2>Record an event</h2>
      <MissionEventRecorder position={mission.position} selected={selected} remaining={remaining}
        nextEvent={mission.events.length + 1} onRecord={onEvent} />
    </section>}
  </>;
}

function ChangeReview({execution, baselineRemaining, onDecision, returnPlan}: {
  execution: MissionExecution; baselineRemaining: MissionPlan; returnPlan: MissionPlan | null;
  onDecision: (plan: MissionPlan, decision: 'approved' | 'held' | 'abort') => void;
}) {
  const proposed = execution.proposal;
  if (!proposed) return null;
  const omitted = baselineRemaining.stops.filter(stop => !proposed.stops.some(candidate => candidate.id === stop.id));
  const previousMargin = nominalMargin(baselineRemaining), proposedMargin = nominalMargin(proposed);
  const delta = previousMargin && proposedMargin && subtractResources(proposedMargin, previousMargin);
  const added = proposed.stops.filter(stop => !baselineRemaining.stops.some(prior => prior.id === stop.id));
  const shortened = proposed.stops.filter(stop => baselineRemaining.stops.some(prior =>
    prior.id === stop.id && prior.activity.minutes > stop.activity.minutes));
  return <section className="mission-review" aria-label="Replan review">
    <h2>{execution.status === 'HOLD' ? 'Holding position' : 'Review the revised plan'}</h2>
    <PlanComparison previous={baselineRemaining} proposed={proposed} label="Previous remaining plan" />
    {omitted.length > 0 && <p>Deferred: {omitted.map(stop => stop.name).join(', ')}.</p>}
    {added.length > 0 && <p>Added: {added.map(stop => stop.name).join(', ')}.</p>}
    {delta && <p>Reserve margin change: {marginText(delta)}.</p>}
    {shortened.length > 0 && <p>Shortened activity: {shortened.map(stop => stop.name).join(', ')}.</p>}
    {!canApprove(proposed) && <p role="status">Approval requires all three reserves at every modeled speed.</p>}
    <div className="mission-buttons">
      {execution.status === 'REVIEW' && <>
        <Button label="Approve revision & continue" variant="primary" isDisabled={!canApprove(proposed)}
          onClick={() => onDecision(proposed, 'approved')} />
        <Button label="Hold position" onClick={() => onDecision(proposed, 'held')} />
      </>}
      {returnPlan && <Button label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
        isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'} onClick={() => onDecision(returnPlan, 'abort')} />}
    </div>
  </section>;
}

export function MissionLifecycle({bundle}: {bundle: FieldBundle}) {
  const [selected, setSelected] = useState<ScienceTarget[]>([]);
  const [limit, setLimit] = useState(stopLimit);
  const [preference, setPreference] = useState<RoutePreference>('fastest');
  const [useAlternative, setUseAlternative] = useState<'primary' | 'subset' | 'priority' | 'lowerSlope'>('primary');
  const [execution, setExecution] = useState<MissionExecution | null>(null);
  const [mapSelection, setMapSelection] = useState<Cell | null>(null);
  const [optical, setOptical] = useState(false);
  const [notice, setNotice] = useState('');
  const [showSources, setShowSources] = useState(false);
  const {manifest} = bundle;
  const planning = useMemo(() => {
    if (execution || !selected.length) return null;
    const input = {bundle, origin: landingCell(bundle), stops: selected, spent: zeroResources, routePreference: preference};
    return {primary: previewMission(input), lowerSlope: selected.length === 1 ? previewMission({...input, routePreference: 'lowerSlope'}) : null};
  }, [bundle, execution, preference, selected]);
  const primary = planning?.primary.optimized;
  const plan = execution?.proposal ?? execution?.active ?? (useAlternative === 'subset' ? planning?.primary.subset : undefined)
    ?? (useAlternative === 'priority' ? planning?.primary.priority : undefined)
    ?? (useAlternative === 'lowerSlope' ? planning?.lowerSlope?.optimized : undefined) ?? primary;
  const returnPlan = useMemo(() => execution && execution.status !== 'COMPLETED'
    ? proposeReturn(execution, bundle) : null, [bundle, execution]);
  const previous = useMemo(() => execution && remainingActivePlan(execution, bundle), [bundle, execution]);
  const currentPlan = execution && !execution.proposal && previous ? previous : plan;
  const displayed = currentPlan?.legs;
  const overlay = useMemo(() => ({planned: displayed ?? [], previous: execution?.proposal ? previous?.legs : undefined,
    traveled: execution?.travels, hazards: execution?.hazards, position: execution?.position, selected: mapSelection}),
  [displayed, execution, previous, mapSelection]);
  const storageKey = `seshat-execution-v1:${manifest.sourceFileSha256 ?? manifest.sourceId}:${manifest.baseIndex}`;

  useEffect(() => {
    if (!execution) return;
    try { localStorage.setItem(storageKey, JSON.stringify(execution)); }
    catch (error) { console.warn('Mission history could not be saved on this browser.', error); }
  }, [execution, storageKey]);

  function resumeMission() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as MissionExecution | null;
      if (!saved?.baseline || !saved.active || !Array.isArray(saved.events) || !Array.isArray(saved.position)) {
        return setNotice('There is no saved mission for this terrain bundle.');
      }
      setExecution(saved);
      setNotice('');
    } catch {
      setNotice('The saved mission could not be read.');
    }
  }

  function changeStops(stops: ScienceTarget[]) {
    setSelected(stops);
    setUseAlternative('primary');
    setNotice('');
  }

  function addStop(stop: ScienceTarget) {
    if (selected.some(item => item.id === stop.id)) return;
    if (limit === 1) return changeStops([stop]);
    if (selected.length >= limit) return setNotice('Remove a stop before adding another. Four stops is the planning limit.');
    changeStops([...selected, stop]);
  }

  function selectCell(row: number, col: number) {
    const point: Cell = [row, col];
    if (execution) return setMapSelection(point);
    const index = cellIndex(point, bundle);
    if (bundle.mask[index] !== 1 || index === manifest.baseIndex) return setNotice('Choose a covered terrain cell away from the landing site.');
    const documented = manifest.scienceTargets?.find(stop => stop.location.gridRow === row && stop.location.gridCol === col);
    addStop(documented ?? scenarioPoint(point, `Custom point (${row}, ${col})`));
  }

  function exportPlan(format: 'json' | 'md') {
    if (!plan) return;
    const archive = createArchive(execution?.baseline ?? plan, manifest, execution ?? undefined);
    download(`seshat-${execution?.status === 'COMPLETED' ? 'mission-archive' : 'baseline'}.${format}`,
      format === 'json' ? JSON.stringify(archive, null, 2) : archiveMarkdown(archive),
      format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8');
  }

  return <main className="workbench lifecycle">
    <header className="mission-header">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">S<span>·</span></div>
        <div className="brand-text"><strong>SESHAT</strong><span>MARS SURFACE SCIENCE</span></div></div>
      <nav className="mission-phases" aria-label="Mission phase">
        <span aria-current={!execution ? 'step' : undefined}>Plan</span>
        <span aria-current={execution?.status === 'EXECUTING' ? 'step' : undefined}>Execute</span>
        <span aria-current={execution && execution.status !== 'EXECUTING' ? 'step' : undefined}>Adapt & return</span>
      </nav>
      <div className="header-right"><Link href="/?opportunities=1" className="text-action" prefetch={false}>Opportunity frontier</Link>
        <button type="button" className="text-action" onClick={() => setShowSources(value => !value)} aria-expanded={showSources}>Data & assumptions</button></div>
    </header>
    {showSources && <section className="mission-source-strip" aria-label="Data and assumptions">
      <p><strong>Research prototype.</strong> Orbital terrain, imagery and published rover observations are historical. All mobility and consumable parameters are scenario assumptions.</p>
      <p><a href={manifest.sourceUrl}>CTX terrain</a> · {manifest.optical && <><a href={manifest.optical.sourceUrl}>CTX orbital mosaic</a> · </>}
        <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/">Perseverance raw imagery</a> · <a href="https://trek.nasa.gov/mars/">NASA Mars Trek</a></p>
      <p>{Object.values(scenario.environmentalContext).join(' ')}</p>
    </section>}
    <div className="content-grid lifecycle-grid">
      <aside className="left-rail" aria-label={execution ? 'Mission execution' : 'Mission planning'}>
        {execution ? <ExecutionPanel mission={execution} selected={mapSelection}
          onAdvance={progress => {setExecution(current => current && advanceMission(current, bundle, progress)); setMapSelection(null);}}
          onEvent={entry => {setExecution(recordEvent(execution, bundle, entry)); setMapSelection(null);}} /> :
          <SelectionPanel catalog={manifest.scienceTargets ?? []} selected={selected} limit={limit}
            onMode={newLimit => {setLimit(newLimit); changeStops(selected.slice(0, newLimit));}}
            onAdd={addStop} onChange={changeStops} onReorder={index => {
              const ordered = [...selected];
              [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
              changeStops(ordered);
            }}/>}
        {!execution && <div className="rail-section"><Button label="Resume saved mission" onClick={resumeMission}/></div>}
        {notice && <p role="status" className="mission-error">{notice}</p>}
      </aside>
      <section className="map-stage" aria-label="Planetary terrain map">
        <div className="map-topline"><span className="map-title">Jezero western fan</span>
          <span className="eyebrow">{manifest.status === 'VERIFIED' ? 'Team-reviewed Mars terrain' : 'Real Mars terrain · review pending'}</span>
          {manifest.optical && <div className="map-layer-switch" role="group" aria-label="Surface layer">
            <button aria-pressed={!optical} onClick={() => setOptical(false)}>Terrain</button>
            <button aria-pressed={optical} onClick={() => setOptical(true)}>Orbital</button>
          </div>}
        </div>
        <LeafletGrid bundle={bundle} selectedCell={null} onCellSelect={selectCell} elapsedMinutes={0}
          missionBudgetMinutes={scenario.timeBudgetMinutes} reserveMinutes={scenario.reserveMinutes} showOptical={optical}
          mission={overlay} />
        <span className="map-north" aria-hidden="true">↑ N</span>
        <div className="lifecycle-map-key"><span>● Scenario landing site</span><span>● Contingency stop</span>
          {execution?.proposal && <span>┄ Previous route</span>}<span>20 m analysis cells</span></div>
      </section>
      <aside className="right-rail" aria-label="Mission preview">
        <section className="rail-section">
          <h2>{execution?.status === 'COMPLETED' ? 'Mission complete' : execution ? 'Mission status' : 'Mission preview'}</h2>
          {!execution && selected.length > 1 && <label className="mission-field">Route preference
            <select value={preference} onChange={event => {setPreference(event.target.value as RoutePreference); setUseAlternative('primary');}}>
              <option value="fastest">Minimum travel time</option><option value="lowerSlope">Prefer gentler terrain</option>
            </select></label>}
          {returnPlan && <p className="context-note">Direct return margin at 1× · {marginText(nominalMargin(returnPlan))}</p>}
          {execution?.proposal && previous && <ChangeReview execution={execution} baselineRemaining={previous}
            returnPlan={returnPlan} onDecision={(updated, decision) => setExecution(decideReplan(execution, updated, decision))} />}
          {currentPlan ? <MissionPlanPreview plan={currentPlan} spent={execution?.spent ?? zeroResources} manifest={manifest}
            label={execution?.proposal ? 'Proposed remaining route' : execution ? 'Approved route' : 'Selected plan'} /> :
            <p className="context-note">Select a destination to preview the round trip and its return reserves.</p>}
          {!execution && plan && plan.deferred.length > 0 && <p className="context-note">
            Deferred from this option: {plan.deferred.map(stop => stop.name).join(', ')}.
          </p>}
          {!execution && primary && <div className="mission-alternatives">
            <Button label="Show optimized order" onClick={() => setUseAlternative('primary')} />
            {planning?.primary.subset && <Button label="Show feasible subset" onClick={() => setUseAlternative('subset')} />}
            {planning?.lowerSlope && <Button label="Show lower-slope option" onClick={() => setUseAlternative('lowerSlope')} />}
            {selected.length > 1 && planning && <PlanComparison previous={planning.primary.priority} proposed={primary}
              label="Astronaut priority order" action="Use priority order" onChoose={() => setUseAlternative('priority')} />}
          </div>}
          {plan && <div className="mission-buttons mission-export">
            {!execution && <>
              <Button label="Approve & lock baseline plan" variant="primary" isDisabled={!canApprove(plan)}
                onClick={() => setExecution(startMission(plan, selected, limit))} />
              {!canApprove(plan) && <p className="context-note">Approval requires all three reserves at every modeled speed.</p>}
            </>}
            {execution && <><Button label="Download JSON" onClick={() => exportPlan('json')} />
              <Button label="Download Markdown" onClick={() => exportPlan('md')} />
              <Button label="Print plan" onClick={() => window.print()} /></>}
            {execution?.status === 'COMPLETED' && <Button label="Plan another mission" onClick={() => {
              setExecution(null); changeStops([]); setMapSelection(null);
            }} />}
          </div>}
        </section>
      </aside>
    </div>
    <footer className="site-footer"><span>SESHAT / SPACE APPS 2026</span><span>Research prototype · not safety-certified</span></footer>
  </main>;
}
