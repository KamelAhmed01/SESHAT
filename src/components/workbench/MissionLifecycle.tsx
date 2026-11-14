'use client';

import Link from 'next/link';
import { useMemo, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import type { MapPointInspection } from '@/components/cartography/LeafletGrid';
import type { FieldBundle } from '@/data/loader';
import { addResources, subtractResources, zeroResources } from '@/engine/consumables';
import {
  advanceMission,
  decideReplan,
  logStopObservation,
  proposeReturn,
  recordEvent,
  recordPendingReading,
  remainingActivePlan,
  startMission,
  triggerSimulatedReading,
} from '@/engine/lifecycle-store';
import type { MissionExecution } from '@/engine/lifecycle-store';
import { archiveMarkdown, createArchive, missionClock, missionSequence } from '@/engine/mission-archive';
import { canApprove, landingCell, landingId, previewMission, stopLimit, targetCell } from '@/engine/multi-leg-planner';
import type { MissionPlan, RoutePreference } from '@/engine/multi-leg-planner';
import { cellIndex } from '@/engine/traverse-graph';
import type { Cell } from '@/engine/traverse-graph';
import type { ScienceTarget } from '@/engine/types';
import scenario from '@/config/mission-scenario.json';
import { channelLabels, eventLabel, eventMeasurement, MissionEventRecorder, scenarioPoint } from './MissionEventRecorder';
import type { EventSubmission } from './MissionEventRecorder';
import {
  conservativeSummary,
  marginText,
  MissionPlanPreview,
  PlanComparison,
} from './MissionPlanPreview';

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

function SiteEvidence({stop, unitLabel, thermalValue}: {stop: ScienceTarget; unitLabel?: string; thermalValue?: number | null}) {
  const photo = photos[stop.id];
  return <details className="mission-disclosure site-evidence">
    <summary>Science &amp; provenance</summary>
    <p>{stop.science.summary}</p>
    <p>{stop.location.originalCoordinateText}</p>
    {unitLabel && <p>Mapped geologic unit (Stack et al. 2020): {unitLabel}</p>}
    {thermalValue !== undefined && thermalValue !== null && (
      <p>Thermal inertia (Edwards &amp; Buz 2021): {thermalValue.toFixed(0)} J m⁻² K⁻¹ s⁻¹/²</p>
    )}
    <p>Unavailable fields: live weather, radiation &amp; sub-20 m boulder roughness.</p>
    {photo && <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- local evidence images ship with the offline export */}
      <img loading="lazy" src={`/data/imagery/${photo.file}`} alt={photo.caption} />
      <figcaption>{photo.caption}</figcaption>
    </figure>}
    {stop.science.evidence.map(item => <p key={item.sourceId}><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></p>)}
  </details>;
}

function SelectionPanel({
  catalog, selected, limit, width, height, customCol, customRow, bundle, headingRef, decision,
  onCustomCol, onCustomRow, onAddCustomPoint, onMode, onAdd, onChange, onReorder, onResume,
}: {
  catalog: ScienceTarget[]; selected: ScienceTarget[]; limit: number;
  width: number; height: number;
  customCol: string; customRow: string;
  bundle: FieldBundle;
  decision: React.ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onCustomCol: (v: string) => void; onCustomRow: (v: string) => void;
  onAddCustomPoint: () => void;
  onMode: (limit: number) => void; onAdd: (stop: ScienceTarget) => void;
  onChange: (stops: ScienceTarget[]) => void; onReorder: (index: number) => void;
  onResume: () => void;
}) {
  return <>
    <section className="field-section">
      <h1 ref={headingRef} tabIndex={-1}>Plan a science traverse</h1>
      <p>Choose science stops for a round trip from the landing site.</p>
      <div className="field-mode">
        <div className="mission-actions" role="group" aria-label="Destination mode">
          <button type="button" aria-pressed={limit === 1} onClick={() => onMode(1)}>Single</button>
          <button type="button" aria-pressed={limit > 1} onClick={() => onMode(stopLimit)}>Multiple</button>
        </div>
        <Button label="Resume saved mission" onClick={onResume}/>
      </div>
    </section>

    {selected.length > 0 && <section className="cc-panel-block cc-panel-compact">
      <div className="section-heading">
        <h2>Stop priorities</h2>
        <span className="section-index">{selected.length} / {limit}</span>
      </div>
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
    </section>}

    {decision}

    <section className="cc-panel-block cc-panel-compact mission-catalog">
      <h2>Science sites</h2>
      {catalog.length === 0 && <p className="context-note">No documented targets match the current filter.</p>}
      <div className="cc-catalog-grid">
        {catalog.map(stop => {
          const cell = targetCell(stop);
          const idx = cell ? cellIndex(cell, bundle) : -1;
          const unitLabel = bundle.contextData?.geologicUnits?.targetUnits?.[stop.id];
          const thermalVal = idx >= 0 && bundle.contextData?.thermalInertia && Number.isFinite(bundle.contextData.thermalInertia[idx])
            ? bundle.contextData.thermalInertia[idx]
            : null;
          return <div key={stop.id} className="cc-catalog-item">
            <Button label={`Add ${stop.name}`} onClick={() => onAdd(stop)}
              isDisabled={!cell || selected.some(item => item.id === stop.id) || (limit > 1 && selected.length >= limit)} />
            <SiteEvidence stop={stop} unitLabel={unitLabel} thermalValue={thermalVal}/>
          </div>;
        })}
      </div>
    </section>
    <details className="mission-disclosure field-coordinates">
      <summary>Use grid coordinates</summary>
      <form onSubmit={event => {event.preventDefault(); onAddCustomPoint();}}>
        <label>Column <input type="number" min={0} max={width - 1} value={customCol}
          onChange={event => onCustomCol(event.target.value)} aria-label="Target column X" required /></label>
        <label>Row <input type="number" min={0} max={height - 1} value={customRow}
          onChange={event => onCustomRow(event.target.value)} aria-label="Target row Y" required /></label>
        <Button label="Add custom coordinate point" type="submit" />
      </form>
    </details>
  </>;
}

function ExecutionPanel({
  mission,
  onEvent,
  onExploreStep,
  onFinishStop,
  onLogObservation,
  onTriggerReading,
  onRecordReading,
  onDismissReading,
  selected,
  headingRef,
}: {
  mission: MissionExecution;
  onEvent: (entry: EventSubmission) => void;
  onExploreStep: () => void;
  onFinishStop: () => void;
  onLogObservation: (note: string) => void;
  onTriggerReading: () => void;
  onRecordReading: () => void;
  onDismissReading: () => void;
  selected: Cell | null;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [obsInput, setObsInput] = useState('');
  const leg = mission.active.legs[mission.legIndex];
  const complete = mission.status === 'COMPLETED';
  const remaining = mission.active.stops.filter(stop => !mission.completed.includes(stop.id) &&
    !mission.events.some(event => event.category === 'DESTINATION_ACCESSIBILITY_CHANGE' && event.targetId === stop.id));
  const baselineIndex = complete ? mission.baseline.legs.length - 1
    : mission.baseline.legs.findIndex(item => item.targetId === mission.completed.at(-1));
  const baselineClock = mission.baseline.legs[baselineIndex]?.leave;
  const baselineResources = baselineIndex < 0 ? null
    : mission.baseline.legs.slice(0, baselineIndex + 1).reduce((total, item) => addResources(total, item.used), zeroResources);
  const completedStopName = (id: string) => {
    const baseline = mission.baseline.stops.find(stop => stop.id === id);
    const discovered = mission.events.find(event => event.category === 'NEW_SCIENTIFIC_DISCOVERY' && event.target.id === id);
    return baseline?.name ?? (discovered?.category === 'NEW_SCIENTIFIC_DISCOVERY' ? discovered.target.name : id);
  };
  const activeProg = mission.activeStopId ? mission.stopProgress?.[mission.activeStopId] : undefined;
  const observations = mission.fieldObservations ?? [];
  const progressList = Object.values(mission.stopProgress ?? {});

  return <>
    <section className="cc-panel-block cc-panel-compact">
      <h1 ref={headingRef} tabIndex={-1}>
        {complete ? 'Returned to landing site' : activeProg ? activeProg.stopName : leg ? `Travel to ${leg.to}` : 'Mission in progress'}
      </h1>
      <p className="context-note">{missionClock(mission.spent.minutes)} elapsed · {mission.spent.oxygen.toFixed(1)} L O₂ used · {mission.spent.energy.toFixed(1)} Wh used</p>
      {baselineClock !== undefined && baselineResources && <p className="context-note">Baseline at {complete ? 'return' : 'latest completed stop'} · {missionClock(baselineClock)} · {baselineResources.oxygen.toFixed(1)} L O₂ · {baselineResources.energy.toFixed(1)} Wh</p>}
    </section>

    {!complete && mission.pendingReading && (
      <section className="cc-panel-block cc-panel-compact cc-reading-alert" aria-label="Incoming simulated reading">
        <div className="section-heading">
          <span>Incoming simulated reading</span>
          <span className="cc-reading-channel">{channelLabels[mission.pendingReading.channel]}</span>
        </div>
        <p><strong>{mission.pendingReading.title}</strong></p>
        <p className="context-note">{missionClock(mission.pendingReading.triggeredAtMinutes)} · {mission.pendingReading.measurement}</p>
        <p className="context-note">{mission.pendingReading.description}</p>
        <div className="mission-buttons">
          <Button label="Record reading & evaluate impact" variant="primary" onClick={onRecordReading} />
          <Button label="Dismiss reading" onClick={onDismissReading} />
        </div>
      </section>
    )}

    {mission.status === 'EXECUTING' && activeProg && !mission.pendingReading && (
      <section className="cc-panel-block cc-panel-compact cc-stop-ops" aria-label="Active stop exploration">
        <div className="section-heading">
          <span>Fieldwork</span>
          <span className="section-index">{activeProg.exploredMinutes.toFixed(0)} / {activeProg.plannedMinutes.toFixed(0)} min</span>
        </div>
        <p className="context-note">
          {activeProg.status === 'arrived'
            ? 'Arrived at site. Log observations or begin exploration time.'
            : `Exploring site · ${activeProg.observations.length} observation(s) preserved.`}
        </p>
        <form
          className="cc-obs-form"
          onSubmit={e => {
            e.preventDefault();
            if (!obsInput.trim()) return;
            onLogObservation(obsInput);
            setObsInput('');
          }}
        >
          <input
            type="text"
            value={obsInput}
            maxLength={140}
            aria-label="Observation note"
            placeholder="Record geology / mineralogy note…"
            onChange={e => setObsInput(e.target.value)}
          />
          <Button label="Record observation" type="submit" isDisabled={!obsInput.trim()} />
        </form>
        <div className="mission-buttons">
          <Button
            label={activeProg.plannedMinutes - activeProg.exploredMinutes < 10 ? 'Explore remaining time' : 'Explore +10 min'}
            variant="primary"
            isDisabled={activeProg.exploredMinutes >= activeProg.plannedMinutes}
            onClick={onExploreStep}
          />
          {!mission.pendingReading && (
            <Button label="Simulate incoming reading" onClick={onTriggerReading} />
          )}
          <Button label="Complete stop" isDisabled={activeProg.exploredMinutes < activeProg.plannedMinutes} onClick={onFinishStop} />
        </div>
      </section>
    )}

    <details className="mission-disclosure field-history">
      <summary>Mission history</summary>
      <p className="context-note" role="status">{complete ? 'Returned · archive ready'
        : mission.status === 'REVIEW' ? 'Event analyzed · revised plan awaiting approval'
        : mission.status === 'HOLD' ? 'Holding · record a new event or review direct return'
        : mission.activeStopId ? 'At stop · exploring and logging observations'
        : mission.decisions.length ? 'Continuing on the approved revision' : 'Baseline approved · tracking progress'}</p>
      <ol className="mission-history">
        {progressList.filter(item => item.status !== 'pending').map(item => (
          <li key={`prog-${item.stopId}`}>
            {item.status === 'completed' ? '✓' : item.status === 'departed-early' ? '◐' : '•'} {item.stopName}
            <small>{item.status} · {item.exploredMinutes.toFixed(0)}/{item.plannedMinutes.toFixed(0)} min · {item.observations.length} note(s)</small>
          </li>
        ))}
        {mission.completed.filter(id => !progressList.some(p => p.stopId === id && p.status !== 'pending')).map(id => (
          <li key={id}>✓ {completedStopName(id)}</li>
        ))}
        {observations.map(obs => (
          <li key={obs.id}>{missionClock(obs.timestampMinutes)} · Observation at {obs.stopName}
            <small>{obs.note} ({obs.recordedDuring})</small></li>
        ))}
        {mission.events.map(event => <li key={event.id}>{missionClock(event.minute)} · {eventLabel(event.category)}
          <small>{channelLabels[event.channel]} · {eventMeasurement(event)} · ({event.cell.join(', ')})
            {event.description && ` · ${event.description}`}</small></li>)}
        {mission.decisions.map((decision, i) => (
          <li key={i}>{missionClock(decision.minute)} · Revision {decision.kind}{decision.stopAction ? ` (${decision.stopAction})` : ''}</li>
        ))}
      </ol>
    </details>

    {!complete && <details className="mission-disclosure cc-event-disclosure">
      <summary>Record an event</summary>
      <MissionEventRecorder position={mission.position} selected={selected} remaining={remaining}
        nextEvent={mission.events.length + 1} onRecord={onEvent} />
    </details>}
  </>;
}

function ChangeReview({execution, baselineRemaining, onDecision, returnPlan, headingRef, onReopen}: {
  execution: MissionExecution; baselineRemaining: MissionPlan; returnPlan: MissionPlan | null;
  onDecision: (plan: MissionPlan, decision: 'approved' | 'held' | 'abort', stopAction?: 'finish-stop' | 'leave-stop') => void;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onReopen: () => void;
}) {
  const proposed = execution.proposal;
  if (!proposed) return null;
  const finishBranch = execution.finishProposal;
  const leaveBranch = execution.leaveStopProposal;
  const hasDualStopBranches = Boolean(finishBranch && leaveBranch && execution.activeStopId);
  const activeProg = execution.activeStopId ? execution.stopProgress?.[execution.activeStopId] : undefined;

  const omitted = baselineRemaining.stops.filter(stop => !proposed.stops.some(candidate => candidate.id === stop.id));
  const previousMargin = conservativeSummary(baselineRemaining)?.margin, proposedMargin = conservativeSummary(proposed)?.margin;
  const delta = previousMargin && proposedMargin && subtractResources(proposedMargin, previousMargin);
  const added = proposed.stops.filter(stop => !baselineRemaining.stops.some(prior => prior.id === stop.id));
  const shortened = proposed.stops.filter(stop => baselineRemaining.stops.some(prior =>
    prior.id === stop.id && prior.activity.minutes > stop.activity.minutes));

  return <section className="mission-review" aria-label="Replan review">
    <h1 ref={headingRef} tabIndex={-1}>{execution.status === 'HOLD' ? 'Holding position' : 'Review the revised plan'}</h1>
    {execution.events.at(-1) && <p className="field-event-title">{eventLabel(execution.events.at(-1)!.category)}</p>}
    {execution.status === 'HOLD' && <Button label="Resume review" variant="primary" onClick={onReopen} />}
    {!hasDualStopBranches && execution.proposalReason && <p>{execution.proposalReason}</p>}

    {hasDualStopBranches && finishBranch && leaveBranch ? (
      <>
        {execution.proposalReason && <p className="context-note"><strong>Recommendation:</strong> {execution.proposalReason}</p>}
        {activeProg && (
          <p className="context-note">
            Interrupted at <strong>{activeProg.stopName}</strong>: {activeProg.exploredMinutes.toFixed(0)} / {activeProg.plannedMinutes.toFixed(0)} min explored · {activeProg.observations.length} observation(s) preserved.
          </p>
        )}
        <div className="mission-comparison">
          <div data-recommended={execution.recommendedProposal === 'finish-stop'}>
            <small>Option A · Finish stop &amp; continue {execution.recommendedProposal === 'finish-stop' ? '(Recommended)' : ''}</small>
            <p>{missionSequence(finishBranch)}</p>
            <p>{marginText(conservativeSummary(finishBranch)?.margin ?? null)} at 0.8×</p>
            {!canApprove(finishBranch) && <small>Breaks 0.8×–1.2× reserve envelope.</small>}
          </div>
          <div data-recommended={execution.recommendedProposal === 'leave-stop'}>
            <small>Option B · Leave stop now (keep partial science) {execution.recommendedProposal === 'leave-stop' ? '(Recommended)' : ''}</small>
            <p>{missionSequence(leaveBranch)}</p>
            <p>{marginText(conservativeSummary(leaveBranch)?.margin ?? null)} at 0.8×</p>
            {!canApprove(leaveBranch) && <small>Breaks 0.8×–1.2× reserve envelope.</small>}
          </div>
        </div>
        <div className="mission-buttons">
          {execution.status === 'REVIEW' && <>
            <Button
              label="Approve: finish stop & continue"
              variant={execution.recommendedProposal === 'finish-stop' ? 'primary' : 'secondary'}
              isDisabled={!canApprove(finishBranch)}
              onClick={() => onDecision(finishBranch, 'approved', 'finish-stop')}
            />
            <Button
              label="Approve: leave stop & continue"
              variant={execution.recommendedProposal === 'leave-stop' ? 'primary' : 'secondary'}
              isDisabled={!canApprove(leaveBranch)}
              onClick={() => onDecision(leaveBranch, 'approved', 'leave-stop')}
            />
            <Button label="Hold position" onClick={() => onDecision(proposed, 'held')} />
          </>}
          {returnPlan && <Button label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
            isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'} onClick={() => onDecision(returnPlan, 'abort')} />}
        </div>
      </>
    ) : (
      <>
        <PlanComparison previous={baselineRemaining} proposed={proposed} label="Previous remaining plan" speed={0.8} />
        {omitted.length > 0 && <p>Deferred: {omitted.map(stop => stop.name).join(', ')}.</p>}
        {added.length > 0 && <p>Added: {added.map(stop => stop.name).join(', ')}.</p>}
        {delta && <p>Reserve change at 0.8× · {marginText(delta)}.</p>}
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
      </>
    )}
  </section>;
}

export function MissionLifecycle({bundle}: {bundle: FieldBundle}) {
  const [selected, setSelected] = useState<ScienceTarget[]>([]);
  const [limit, setLimit] = useState(stopLimit);
  const [preference, setPreference] = useState<RoutePreference>('fastest');
  const [useAlternative, setUseAlternative] = useState<'primary' | 'subset' | 'priority' | 'lowerSlope'>('primary');
  const [execution, setExecution] = useState<MissionExecution | null>(null);
  const [mapSelection, setMapSelection] = useState<Cell | null>(null);
  const [optical, setOptical] = useState(Boolean(bundle.manifest.optical));
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [showElevation, setShowElevation] = useState(false);
  const [showGeology, setShowGeology] = useState(false);
  const [showThermal, setShowThermal] = useState(false);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [resetViewRequestKey, setResetViewRequestKey] = useState(0);
  const [inspectedPoint, setInspectedPoint] = useState<MapPointInspection | null>(null);

  const {manifest} = bundle;
  const origin = useMemo(() => landingCell(bundle), [bundle]);
  const [customCol, setCustomCol] = useState(String(origin[1]));
  const [customRow, setCustomRow] = useState(String(origin[0]));

  const planning = useMemo(() => {
    if (execution || !selected.length) return null;
    const input = {bundle, origin, stops: selected, spent: zeroResources, routePreference: preference};
    return {primary: previewMission(input), lowerSlope: selected.length === 1 ? previewMission({...input, routePreference: 'lowerSlope'}) : null};
  }, [bundle, execution, origin, preference, selected]);

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

  const catalog = manifest.scienceTargets ?? [];
  const activeExecutionLeg = execution?.active.legs[execution.legIndex];
  const baselineGate = useMemo(() => conservativeSummary(plan), [plan]);
  const activeStopProgress = execution?.activeStopId ? execution.stopProgress?.[execution.activeStopId] : undefined;
  const phaseKey = !execution
    ? locked ? 'LOCKED' : 'PLAN'
    : execution.status === 'REVIEW'
      ? 'REVIEW'
      : execution.status === 'HOLD'
        ? 'HOLD'
        : execution.status === 'COMPLETED'
          ? 'COMPLETED'
          : execution.activeStopId
            ? activeStopProgress?.status === 'exploring' ? 'EXPLORE' : 'ARRIVED'
            : 'MOVING';
  const reviewing = Boolean(execution?.proposal && previous);
  const meda = bundle.contextData?.meda;

  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevPhaseRef = useRef(phaseKey);

  useEffect(() => {
    if (prevPhaseRef.current === phaseKey) return;
    prevPhaseRef.current = phaseKey;
    requestAnimationFrame(() => {
      const heading = phaseKey === 'REVIEW' || phaseKey === 'HOLD' ? reviewHeadingRef : phaseHeadingRef;
      heading.current?.focus();
    });
  }, [phaseKey]);

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
    setLocked(false);
    setUseAlternative('primary');
    setNotice('');
    const last = stops.at(-1);
    if (last && last.location.gridCol !== null && last.location.gridRow !== null) {
      setCustomCol(String(last.location.gridCol));
      setCustomRow(String(last.location.gridRow));
    }
  }

  function addStop(stop: ScienceTarget) {
    if (selected.some(item => item.id === stop.id)) return;
    if (limit === 1) return changeStops([stop]);
    if (selected.length >= limit) return setNotice('Remove a stop before adding another. Four stops is the planning limit.');
    changeStops([...selected, stop]);
  }

  function selectCell(row: number, col: number) {
    const point: Cell = [row, col];
    setCustomCol(String(col));
    setCustomRow(String(row));
    if (execution) return setMapSelection(point);
    if (locked) return;
    const index = cellIndex(point, bundle);
    if (bundle.mask[index] !== 1 || index === manifest.baseIndex) return setNotice('Choose a covered terrain cell away from the landing site.');
    const documented = manifest.scienceTargets?.find(stop => stop.location.gridRow === row && stop.location.gridCol === col);
    addStop(documented ?? scenarioPoint(point, `Custom point (${row}, ${col})`));
  }

  function addManualCell() {
    if (!customRow.trim() || !customCol.trim()) return setNotice('Enter both grid coordinates.');
    const row = Number(customRow);
    const col = Number(customCol);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= manifest.height || col < 0 || col >= manifest.width) {
      return setNotice(`Coordinates must be integers within 0–${manifest.width - 1} (X) and 0–${manifest.height - 1} (Y).`);
    }
    selectCell(row, col);
  }

  function exportPlan(format: 'json' | 'md') {
    if (!plan) return;
    const archive = createArchive(execution?.baseline ?? plan, manifest, execution ?? undefined, bundle.contextData, execution ? undefined : limit);
    download(`seshat-${execution?.status === 'COMPLETED' ? 'mission-archive' : 'baseline'}.${format}`,
      format === 'json' ? JSON.stringify(archive, null, 2) : archiveMarkdown(archive),
      format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8');
  }

  function advance(progress: 'part' | 'arrive' | 'explore' | 'finish') {
    setExecution(current => current && advanceMission(current, bundle, progress));
    setMapSelection(null);
  }

  function inspectPoint(info: MapPointInspection) {
    setInspectedPoint(info);
    setMapSelection(info.status === 'COVERED' ? info.cell : null);
    setNotice('');
  }

  function clearInspection() {
    setInspectedPoint(null);
    setMapSelection(null);
  }

  function decide(updated: MissionPlan, decision: 'approved' | 'held' | 'abort', stopAction?: 'finish-stop' | 'leave-stop') {
    setExecution(current => current && decideReplan(current, updated, decision, stopAction ? {stopAction} : undefined));
  }

  const travelControls = execution?.status === 'EXECUTING' && !execution.activeStopId && !execution.pendingReading && activeExecutionLeg;
  const baselineDecision = plan && <section className="field-section field-decision" aria-label="Baseline decision">
    <h2>Return reserves <small>at 0.8× pace</small></h2>
    <p className="cc-baseline-gate">
      {baselineGate?.margin ? `0.8× margin: ${marginText(baselineGate.margin)}` : 'Return margin unavailable'}
    </p>
    {baselineGate?.margin && <small>Limiting resource · {baselineGate.limitingLabel}</small>}
    <p>{missionSequence(plan)}</p>
    {plan.deferred.length > 0 && <p>Deferred: {plan.deferred.map(stop => stop.name).join(', ')}.</p>}
    <Button label="Approve & lock baseline plan" variant="primary" isDisabled={!canApprove(plan)} onClick={() => setLocked(true)} />
    {!canApprove(plan) && <p>Approval requires all reserves at 0.8×, 1× and 1.2×.</p>}
  </section>;

  return (
    <main className="field-workbench">
      <header className="field-header">
        <div><strong>SESHAT</strong><span>Jezero western fan</span></div>
        <Button label="Sources" onClick={() => setShowSources(value => !value)} aria-expanded={showSources} />
      </header>
      <div className="field-layout">
        <section className="field-map" aria-label="Planetary terrain map">
          <LeafletGrid
            bundle={bundle}
            selectedCell={null}
            onCellSelect={selectCell}
            onInspectPoint={inspectPoint}
            elapsedMinutes={0}
            missionBudgetMinutes={scenario.timeBudgetMinutes}
            reserveMinutes={scenario.reserveMinutes}
            showOptical={optical}
            showElevation={showElevation}
            showGeology={showGeology}
            showThermal={showThermal}
            fitRequestKey={fitRequestKey}
            resetViewRequestKey={resetViewRequestKey}
            mission={overlay}
          />
          <div className="field-map-tools">
            <details className="field-layers" open={!manifest.mapDisplay}>
              <summary>Layers</summary>
              <div>
                <div className="field-layer-options" role="group" aria-label="Surface layer">
                  <button type="button" aria-pressed={!optical} onClick={() => setOptical(false)}>Terrain</button>
                  {manifest.optical && <button type="button" aria-pressed={optical} onClick={() => setOptical(true)}>Orbital</button>}
                  <button type="button" aria-pressed={showElevation} onClick={() => setShowElevation(value => !value)}>Elevation</button>
                  {bundle.contextData?.geologicUnits && <button type="button" aria-pressed={showGeology} onClick={() => setShowGeology(value => !value)}>Geology</button>}
                  {bundle.contextData?.thermalInertia && <button type="button" aria-pressed={showThermal} onClick={() => setShowThermal(value => !value)}>Thermal</button>}
                </div>
              </div>
            </details>
            <button type="button" onClick={() => setResetViewRequestKey(key => key + 1)}>Back to Jezero</button>
            <button type="button" onClick={() => setFitRequestKey(key => key + 1)}>Fit mission</button>
          </div>
          {inspectedPoint && <div className="cc-point-inspector field-point" aria-label="Map point inspection">
            <div className="field-point-title">
              <strong>{inspectedPoint.label}</strong>
              <button type="button" onClick={clearInspection} aria-label="Close map point inspection">×</button>
            </div>
            {inspectedPoint.lat != null && inspectedPoint.lon != null && <p>
              {Math.abs(inspectedPoint.lat).toFixed(4)}°{inspectedPoint.lat < 0 ? 'S' : 'N'}, {Math.abs(inspectedPoint.lon).toFixed(4)}°{inspectedPoint.lon < 0 ? 'W' : 'E'}
            </p>}
            {inspectedPoint.status === 'COVERED' && inspectedPoint.elevationMeters != null && <p>{inspectedPoint.elevationMeters.toFixed(0)} m elevation</p>}
            {inspectedPoint.status === 'COVERED' && inspectedPoint.geologicUnit && showGeology && (
              <p>Geologic unit: {inspectedPoint.geologicUnit}</p>
            )}
            {inspectedPoint.status === 'COVERED' && inspectedPoint.thermalInertia != null && showThermal && (
              <p>Thermal inertia: {inspectedPoint.thermalInertia.toFixed(1)} J m⁻² K⁻¹ s⁻¹/²</p>
            )}
            {inspectedPoint.status === 'COVERED' && inspectedPoint.cell && !locked && !execution && (
              <Button label="Add this stop" variant="primary" onClick={() => {selectCell(...inspectedPoint.cell!); clearInspection();}} />
            )}
            {inspectedPoint.status === 'COVERED' && execution && <p>Selected location for your next event.</p>}
          </div>}
          {manifest.mapDisplay && <div className="field-map-credit">NASA / JPL · USGS</div>}
        </section>
        <aside className="field-panel" aria-label={execution ? 'Mission execution' : 'Mission planning'}>
          {showSources && <section className="field-section field-sources" aria-label="Data and assumptions">
            <h2>Sources</h2>
            <p>Research prototype · {manifest.status === 'VERIFIED' ? 'Team-reviewed terrain' : 'Terrain review pending'}</p>
            <ul>
              <li><a href={manifest.sourceUrl}>CTX terrain</a></li>
              {manifest.optical && <li><a href={manifest.optical.sourceUrl}>CTX orbital imagery</a></li>}
              <li><a href="https://trek.nasa.gov/mars/">NASA Mars Trek</a></li>
              {bundle.contextData?.geologicUnits && <li><a href={bundle.contextData.geologicUnits.sourceUrl}>Jezero bedrock · Stack et al.</a></li>}
              {manifest.contextLayers?.thermalInertia && <li><a href={manifest.contextLayers.thermalInertia.sourceUrl}>Thermal inertia · Edwards and Buz</a></li>}
              {meda && <li><a href={meda.sourceUrl}>Historical MEDA pressure</a></li>}
            </ul>
            {meda?.sols?.[0] && <p>Historical MEDA pressure · sol {meda.sols[0].sol} · {Math.round(meda.sols[0].medianPa)} Pa median</p>}
            <p>{Object.values(scenario.environmentalContext).join(' ')}</p>
            <p><Link href="/?opportunities=1" prefetch={false}>Opportunity frontier</Link> · <Link href="/?demo=1" prefetch={false}>Synthetic test scene</Link></p>
          </section>}
          {reviewing && execution && previous ? (
            <ChangeReview
              execution={execution}
              baselineRemaining={previous}
              returnPlan={returnPlan}
              headingRef={reviewHeadingRef}
              onDecision={decide}
              onReopen={() => setExecution(current => current?.status === 'HOLD' ? {...current, status: 'REVIEW'} : current)}
            />
          ) : execution ? (
            <>
              <ExecutionPanel
                mission={execution}
                selected={mapSelection}
                headingRef={phaseHeadingRef}
                onEvent={entry => {setExecution(recordEvent(execution, bundle, entry)); setMapSelection(null);}}
                onExploreStep={() => advance('explore')}
                onFinishStop={() => advance('finish')}
                onLogObservation={note => setExecution(current => current && logStopObservation(current, note))}
                onTriggerReading={() => setExecution(current => current && triggerSimulatedReading(current, bundle))}
                onRecordReading={() => setExecution(current => current && recordPendingReading(current, bundle))}
                onDismissReading={() => setExecution(current => current && {...current, pendingReading: null})}
              />
              {travelControls && <div className="field-actions field-travel">
                <Button label={activeExecutionLeg.targetId === landingId ? 'Return to Landing Site' : 'Arrive at stop'} variant="primary" onClick={() => advance('arrive')} />
                <Button label="Move along active leg" onClick={() => advance('part')} isDisabled={execution.cursor >= activeExecutionLeg.route.geometryGrid.length - 1} />
              </div>}
            </>
          ) : locked && plan ? (
            <section className="field-section">
              <h1 ref={phaseHeadingRef} tabIndex={-1}>Baseline approved</h1>
              <p>{missionSequence(plan)}</p>
              {baselineGate?.margin && <p>Return margin at 0.8× · {marginText(baselineGate.margin)}</p>}
              <div className="field-actions">
                <Button label="Start traverse" variant="primary" onClick={() => setExecution(startMission(plan, selected, limit))} />
                <Button label="Edit plan" onClick={() => setLocked(false)} />
              </div>
            </section>
          ) : (
            <SelectionPanel
              catalog={catalog}
              selected={selected}
              limit={limit}
              width={manifest.width}
              height={manifest.height}
              customCol={customCol}
              customRow={customRow}
              bundle={bundle}
              headingRef={phaseHeadingRef}
              decision={baselineDecision}
              onCustomCol={setCustomCol}
              onCustomRow={setCustomRow}
              onAddCustomPoint={addManualCell}
              onMode={newLimit => {
                if (newLimit === 1 && selected.length > 1) return setNotice('Remove stops until one remains, then choose Single.');
                setLimit(newLimit);
                setNotice('');
              }}
              onAdd={addStop}
              onChange={changeStops}
              onReorder={index => {
                const ordered = [...selected];
                [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
                changeStops(ordered);
              }}
              onResume={resumeMission}
            />
          )}
          {notice && <p role="status" className="field-notice">{notice}</p>}
          {execution?.status === 'COMPLETED' && <h2 className="field-complete">Mission complete</h2>}
          {returnPlan && !reviewing && <section className="field-section">
            <h2>Direct return</h2>
            <p>{marginText(conservativeSummary(returnPlan)?.margin ?? null)} at 0.8×</p>
            {activeExecutionLeg?.targetId !== landingId && <Button label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
              isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'} onClick={() => decide(returnPlan, 'abort')} />}
            {returnPlan.legs.at(-1)?.route.status !== 'READY' && <p>No modeled route to the landing site is available.</p>}
          </section>}
          {!execution && !locked && primary && <details className="mission-disclosure field-details">
            <summary>Route options</summary>
            {selected.length > 1 && <label className="mission-field field-route-preference">
              Route preference
              <select value={preference} onChange={event => {setPreference(event.target.value as RoutePreference); setUseAlternative('primary');}}>
                <option value="fastest">Minimum travel time</option>
                <option value="lowerSlope">Prefer gentler terrain</option>
              </select>
            </label>}
            <div className="field-actions">
              <Button label="Show optimized order" onClick={() => setUseAlternative('primary')} />
              {planning?.primary.subset && <Button label="Show feasible subset" onClick={() => setUseAlternative('subset')} />}
              {planning?.lowerSlope && <Button label="Show lower-slope option" onClick={() => setUseAlternative('lowerSlope')} />}
            </div>
            {selected.length > 1 && planning && <PlanComparison previous={planning.primary.priority} proposed={primary}
              label="Astronaut priority order" action="Use priority order" onChoose={() => setUseAlternative('priority')} />}
          </details>}
          {currentPlan && execution?.status !== 'COMPLETED' && <details className="mission-disclosure field-details">
            <summary>{reviewing ? 'Revised itinerary and resources' : execution || locked ? 'Approved route' : 'Itinerary and resources'}</summary>
            <MissionPlanPreview plan={currentPlan} spent={execution?.spent ?? zeroResources} manifest={manifest}
              label={reviewing ? 'Proposed remaining route' : execution || locked ? 'Baseline and schedule' : 'Selected plan'} />
          </details>}
          {plan && (execution || locked) && <div className="field-actions field-export">
            <Button label="Download JSON" onClick={() => exportPlan('json')} />
            <Button label="Download Markdown" onClick={() => exportPlan('md')} />
            <Button label="Print plan" onClick={() => window.print()} />
            {execution?.status === 'COMPLETED' && <Button label="Plan another mission" onClick={() => {
              setExecution(null); changeStops([]); setMapSelection(null); setInspectedPoint(null);
            }} />}
          </div>}
        </aside>
      </div>
    </main>
  );
}
