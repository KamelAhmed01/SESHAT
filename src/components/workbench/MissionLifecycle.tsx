'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Link } from '@astryxdesign/core/Link';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton';
import { LeafletGrid } from '@/components/cartography/LeafletGrid';
import type { MapPointInspection } from '@/components/cartography/LeafletGrid';
import type { BundleResult, FieldBundle } from '@/data/loader';
import { addResources, subtractResources, zeroResources } from '@/engine/consumables';
import { stateLabel } from '@/engine/formatting';
import { liveFrontierMembership, summarizeFrontier } from '@/engine/frontier';
import type { FrontierSummary } from '@/engine/frontier';
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
import {
  ASSUMED_ONE_WAY_LIGHT_MINUTES,
  archiveMarkdown,
  createArchive,
  missionClock,
  missionSequence,
  stationaryRoundTripWaitCost,
} from '@/engine/mission-archive';
import { canApprove, landingCell, landingId, previewMission, stopLimit, targetCell } from '@/engine/multi-leg-planner';
import type { MissionPlan, RoutePreference, TriageBranch } from '@/engine/multi-leg-planner';
import { evaluatePositionOpportunities } from '@/engine/opportunity-ledger';
import { cellIndex } from '@/engine/traverse-graph';
import type { Cell } from '@/engine/traverse-graph';
import type { MissionScenario, ScienceTarget } from '@/engine/types';
import scenario from '@/config/mission-scenario.json';
import { channelLabels, eventLabel, eventMeasurement, MissionEventRecorder, scenarioPoint } from './MissionEventRecorder';
import type { EventSubmission } from './MissionEventRecorder';
import {
  conservativeSummary,
  marginText,
  MissionPlanPreview,
  PlanComparison,
  stateBadgeVariant,
} from './MissionPlanPreview';
import { ThemeControlPopup } from './ThemeControlPopup';

const photos: Record<string, { file: string; caption: string }> = {
  'swift-run': { file: 'skinner-ridge.webp', caption: 'Thornton Gap abrasion, Skinner Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS' },
  hazeltop: { file: 'wildcat-ridge.webp', caption: 'Berry Hollow abrasion, Wildcat Ridge · Perseverance WATSON · NASA/JPL-Caltech/MSSS' },
  shuyak: { file: 'enchanted-lake.webp', caption: 'Enchanted Lake area · Perseverance Hazcam · NASA/JPL-Caltech' },
};

const baseRoutePreferenceOptions = [
  { value: 'fastest', label: 'Minimum travel time' },
  { value: 'lowerSlope', label: 'Prefer gentler terrain' },
];
const thermalRoutePreferenceOption = {
  value: 'firmGround',
  label: 'Prefer consolidated footing (thermal inertia)',
};

function download(filename: string, body: string, type: string) {
  const href = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function SiteEvidence({
  stop,
  unitLabel,
  thermalValue,
}: {
  stop: ScienceTarget;
  unitLabel?: string;
  thermalValue?: number | null;
}) {
  const photo = photos[stop.id];
  return (
    <Collapsible
      className="mission-disclosure site-evidence"
      defaultIsOpen={false}
      chevronPosition="end"
      trigger="Science & provenance"
    >
      <VStack gap={1.5}>
        <p>{stop.science.summary}</p>
        <p>{stop.location.originalCoordinateText}</p>
        {unitLabel && <p>Mapped geologic unit (Stack et al. 2020): {unitLabel}</p>}
        {thermalValue !== undefined && thermalValue !== null && (
          <p>Thermal inertia (Edwards &amp; Buz 2021): {thermalValue.toFixed(0)} J m⁻² K⁻¹ s⁻¹/²</p>
        )}
        <p>Unavailable fields: live weather, radiation &amp; sub-20 m boulder roughness.</p>
        {photo && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- local evidence images ship with the offline export */}
            <img loading="lazy" src={`/data/imagery/${photo.file}`} alt={photo.caption} />
            <figcaption>{photo.caption}</figcaption>
          </figure>
        )}
        {stop.science.evidence.map(item => (
          <p key={item.sourceId}>
            <Link href={item.url} target="_blank" rel="noreferrer">
              {item.title} ↗
            </Link>
          </p>
        ))}
      </VStack>
    </Collapsible>
  );
}

function SelectionPanel({
  catalog,
  selected,
  limit,
  width,
  height,
  customCol,
  customRow,
  bundle,
  headingRef,
  decision,
  onCustomCol,
  onCustomRow,
  onAddCustomPoint,
  onMode,
  onAdd,
  onChange,
  onReorder,
  onResume,
}: {
  catalog: ScienceTarget[];
  selected: ScienceTarget[];
  limit: number;
  width: number;
  height: number;
  customCol: string;
  customRow: string;
  bundle: FieldBundle;
  decision: React.ReactNode;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onCustomCol: (v: string) => void;
  onCustomRow: (v: string) => void;
  onAddCustomPoint: () => void;
  onMode: (limit: number) => void;
  onAdd: (stop: ScienceTarget) => void;
  onChange: (stops: ScienceTarget[]) => void;
  onReorder: (index: number) => void;
  onResume: () => void;
}) {
  return (
    <>
      <section className="field-section">
        <h1 ref={headingRef} tabIndex={-1}>
          Plan a science traverse
        </h1>
        <Text type="supporting">Choose science stops for a round trip from the landing site.</Text>
        <div className="field-mode">
          <SegmentedControl
            label="Destination mode"
            size="sm"
            value={limit === 1 ? 'single' : 'multiple'}
            onChange={value => onMode(value === 'single' ? 1 : stopLimit)}
          >
            <SegmentedControlItem value="single" label="Single" />
            <SegmentedControlItem value="multiple" label="Multiple" />
          </SegmentedControl>
          <Button label="Resume saved mission" variant="secondary" size="sm" onClick={onResume} />
        </div>
      </section>

      {selected.length > 0 && (
        <section className="field-section">
          <div className="section-heading">
            <h2>Stop priorities</h2>
            <span className="section-index">
              {selected.length} / {limit}
            </span>
          </div>
          <ol className="mission-stop-list">
            {selected.map((stop, index) => (
              <li key={stop.id}>
                <div className="mission-stop-row">
                  <strong>{stop.name}</strong>
                  <IconButton
                    label={`Remove ${stop.name}`}
                    icon={<Icon icon="close" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(selected.filter(item => item.id !== stop.id))}
                  />
                </div>
                <HStack gap={2} vAlign="end" wrap="wrap">
                  <NumberInput
                    label="Activity (min)"
                    size="sm"
                    width={140}
                    min={0}
                    max={120}
                    step={1}
                    isIntegerOnly
                    hasNumberSteppers
                    value={stop.activity.minutes}
                    onChange={value =>
                      onChange(
                        selected.map(item =>
                          item.id === stop.id
                            ? {
                                ...item,
                                activity: {
                                  ...item.activity,
                                  minutes: Math.max(0, Math.min(120, Math.round(value))),
                                },
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  {index > 0 && (
                    <Button
                      label="↑ Priority"
                      variant="ghost"
                      size="sm"
                      aria-label={`Raise priority of ${stop.name}`}
                      onClick={() => onReorder(index)}
                    />
                  )}
                </HStack>
              </li>
            ))}
          </ol>
        </section>
      )}

      {decision}

      <section className="field-section mission-catalog">
        <div className="section-heading">
          <h2>Science sites</h2>
          {limit > 1 && catalog.length > 1 && selected.length < Math.min(limit, catalog.length) && (
            <Button
              label="Load all sites"
              variant="ghost"
              size="sm"
              onClick={() => onChange(catalog.filter(stop => Boolean(targetCell(stop))).slice(0, limit))}
            />
          )}
        </div>
        <div className="field-catalog-grid">
          {catalog.map(stop => {
            const cell = targetCell(stop);
            const idx = cell ? cellIndex(cell, bundle) : -1;
            const unitLabel = bundle.contextData?.geologicUnits?.targetUnits?.[stop.id];
            const thermalVal =
              idx >= 0 && bundle.contextData?.thermalInertia && Number.isFinite(bundle.contextData.thermalInertia[idx])
                ? bundle.contextData.thermalInertia[idx]
                : null;
            return (
              <div key={stop.id} className="field-catalog-item">
                <Button
                  label={`Add ${stop.name}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => onAdd(stop)}
                  isDisabled={!cell || selected.some(item => item.id === stop.id) || (limit > 1 && selected.length >= limit)}
                />
                <SiteEvidence stop={stop} unitLabel={unitLabel} thermalValue={thermalVal} />
              </div>
            );
          })}
        </div>
      </section>

      <Collapsible
        className="mission-disclosure field-coordinates"
        defaultIsOpen={false}
        chevronPosition="end"
        trigger="Use grid coordinates"
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            onAddCustomPoint();
          }}
        >
          <HStack gap={2} vAlign="end" wrap="wrap">
            <TextInput
              label="Target column X"
              size="sm"
              inputMode="numeric"
              width={116}
              value={customCol}
              onChange={onCustomCol}
              description={`0–${width - 1}`}
              isRequired
            />
            <TextInput
              label="Target row Y"
              size="sm"
              inputMode="numeric"
              width={116}
              value={customRow}
              onChange={onCustomRow}
              description={`0–${height - 1}`}
              isRequired
            />
            <Button label="Add custom coordinate point" type="submit" variant="secondary" size="sm" />
          </HStack>
        </form>
      </Collapsible>
    </>
  );
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
  const remaining = mission.active.stops.filter(
    stop =>
      !mission.completed.includes(stop.id) &&
      !mission.events.some(event => event.category === 'DESTINATION_ACCESSIBILITY_CHANGE' && event.targetId === stop.id),
  );
  const baselineIndex = complete
    ? mission.baseline.legs.length - 1
    : mission.baseline.legs.findIndex(item => item.targetId === mission.completed.at(-1));
  const baselineClock = mission.baseline.legs[baselineIndex]?.leave;
  const baselineResources =
    baselineIndex < 0
      ? null
      : mission.baseline.legs.slice(0, baselineIndex + 1).reduce((total, item) => addResources(total, item.used), zeroResources);
  const completedStopName = (id: string) => {
    const baseline = mission.baseline.stops.find(stop => stop.id === id);
    const discovered = mission.events.find(event => event.category === 'NEW_SCIENTIFIC_DISCOVERY' && event.target.id === id);
    return baseline?.name ?? (discovered?.category === 'NEW_SCIENTIFIC_DISCOVERY' ? discovered.target.name : id);
  };
  const activeProg = mission.activeStopId ? mission.stopProgress?.[mission.activeStopId] : undefined;
  const observations = mission.fieldObservations ?? [];
  const progressList = Object.values(mission.stopProgress ?? {});

  return (
    <>
      <section className="field-section">
        <h1 ref={headingRef} tabIndex={-1}>
          {complete ? 'Returned to landing site' : activeProg ? activeProg.stopName : leg ? `Travel to ${leg.to}` : 'Mission in progress'}
        </h1>
        <p className="context-note">
          {missionClock(mission.spent.minutes)} elapsed · {mission.spent.oxygen.toFixed(1)} L O₂ used · {mission.spent.energy.toFixed(1)} Wh used
        </p>
        {baselineClock !== undefined && baselineResources && (
          <p className="context-note">
            Baseline at {complete ? 'return' : 'latest completed stop'} · {missionClock(baselineClock)} · {baselineResources.oxygen.toFixed(1)} L O₂ · {baselineResources.energy.toFixed(1)} Wh
          </p>
        )}
      </section>

      {!complete && mission.pendingReading && (
        <section className="field-section" aria-label="Incoming simulated reading">
          <VStack gap={2}>
            <Banner
              status="warning"
              role="alert"
              collapsible={false}
              title={`Incoming simulated reading · ${mission.pendingReading.title}`}
              description={`${missionClock(mission.pendingReading.triggeredAtMinutes)} · ${mission.pendingReading.measurement} — ${mission.pendingReading.description}`}
              endContent={<Badge variant="warning" label={channelLabels[mission.pendingReading.channel]} />}
            />
            <div className="mission-buttons">
              <Button label="Record reading & evaluate impact" variant="primary" size="sm" onClick={onRecordReading} />
              <Button label="Dismiss reading" variant="secondary" size="sm" onClick={onDismissReading} />
            </div>
          </VStack>
        </section>
      )}

      {mission.status === 'EXECUTING' && activeProg && !mission.pendingReading && (
        <section className="field-section" aria-label="Active stop exploration">
          <Card padding={3}>
            <VStack gap={2}>
              <div className="section-heading">
                <span>Fieldwork</span>
                <span className="section-index">
                  {activeProg.exploredMinutes.toFixed(0)} / {activeProg.plannedMinutes.toFixed(0)} min
                </span>
              </div>
              <p className="context-note">
                {activeProg.status === 'arrived'
                  ? 'Arrived at site. Log observations or begin exploration time.'
                  : `Exploring site · ${activeProg.observations.length} observation(s) preserved.`}
              </p>
              <form
                className="field-obs-form"
                onSubmit={e => {
                  e.preventDefault();
                  if (!obsInput.trim()) return;
                  onLogObservation(obsInput);
                  setObsInput('');
                }}
              >
                <TextInput
                  label="Observation note"
                  isLabelHidden
                  size="sm"
                  width="100%"
                  value={obsInput}
                  placeholder="Record geology / mineralogy note…"
                  onChange={val => setObsInput(val.slice(0, 140))}
                />
                <Button label="Record observation" type="submit" size="sm" variant="secondary" isDisabled={!obsInput.trim()} />
              </form>
              <div className="mission-buttons">
                <Button
                  label={activeProg.plannedMinutes - activeProg.exploredMinutes < 10 ? 'Explore remaining time' : 'Explore +10 min'}
                  variant="primary"
                  size="sm"
                  isDisabled={activeProg.exploredMinutes >= activeProg.plannedMinutes}
                  onClick={onExploreStep}
                />
                <Button label="Simulate incoming reading" variant="secondary" size="sm" onClick={onTriggerReading} />
                <Button
                  label="Complete stop"
                  variant="secondary"
                  size="sm"
                  isDisabled={activeProg.exploredMinutes < activeProg.plannedMinutes}
                  onClick={onFinishStop}
                />
              </div>
            </VStack>
          </Card>
        </section>
      )}

      <Collapsible
        className="mission-disclosure field-history"
        defaultIsOpen={false}
        chevronPosition="end"
        trigger="Mission history"
      >
        <p className="context-note" role="status">
          {complete
            ? 'Returned · archive ready'
            : mission.activeStopId
              ? 'At stop · exploring and logging observations'
              : mission.decisions.length
                ? 'Continuing on the approved revision'
                : 'Baseline approved · tracking progress'}
        </p>
        <ol className="mission-history">
          {progressList
            .filter(item => item.status !== 'pending')
            .map(item => (
              <li key={`prog-${item.stopId}`}>
                {item.status === 'completed' ? '✓' : item.status === 'departed-early' ? '◐' : '•'} {item.stopName}
                <small>
                  {item.status} · {item.exploredMinutes.toFixed(0)}/{item.plannedMinutes.toFixed(0)} min · {item.observations.length} note(s)
                </small>
              </li>
            ))}
          {mission.completed
            .filter(id => !progressList.some(p => p.stopId === id && p.status !== 'pending'))
            .map(id => (
              <li key={id}>✓ {completedStopName(id)}</li>
            ))}
          {observations.map(obs => (
            <li key={obs.id}>
              {missionClock(obs.timestampMinutes)} · Observation at {obs.stopName}
              <small>
                {obs.note} ({obs.recordedDuring})
              </small>
            </li>
          ))}
          {mission.events.map(event => (
            <li key={event.id}>
              {missionClock(event.minute)} · {eventLabel(event.category)}
              <small>
                {channelLabels[event.channel]} · {eventMeasurement(event)} · ({event.cell.join(', ')})
                {event.description && ` · ${event.description}`}
              </small>
            </li>
          ))}
          {mission.decisions.map((decision, i) => (
            <li key={i}>
              {missionClock(decision.minute)} · Revision {decision.kind}
              {decision.stopAction ? ` (${decision.stopAction})` : ''}
            </li>
          ))}
        </ol>
      </Collapsible>

      {!complete && (
        <Collapsible
          className="mission-disclosure"
          defaultIsOpen={false}
          chevronPosition="end"
          trigger="Record an event"
        >
          <MissionEventRecorder
            position={mission.position}
            selected={selected}
            remaining={remaining}
            nextEvent={mission.events.length + 1}
            onRecord={onEvent}
          />
        </Collapsible>
      )}
    </>
  );
}

function ChangeReview({
  execution,
  baselineRemaining,
  onDecision,
  returnPlan,
  headingRef,
  onReopen,
  activeProposal,
  selectedBranchId,
  onSelectBranch,
  initialFrontier,
  currentFrontier,
}: {
  execution: MissionExecution;
  baselineRemaining: MissionPlan;
  returnPlan: MissionPlan | null;
  onDecision: (plan: MissionPlan, decision: 'approved' | 'held' | 'abort', stopAction?: 'finish-stop' | 'leave-stop') => void;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onReopen: () => void;
  activeProposal: MissionPlan;
  selectedBranchId: TriageBranch['id'];
  onSelectBranch: (id: TriageBranch['id']) => void;
  initialFrontier: FrontierSummary;
  currentFrontier: FrontierSummary;
}) {
  const proposed = activeProposal;
  const finishBranch = execution.finishProposal;
  const leaveBranch = execution.leaveStopProposal;
  const hasDualStopBranches = Boolean(finishBranch && leaveBranch && execution.activeStopId);
  const activeProg = execution.activeStopId ? execution.stopProgress?.[execution.activeStopId] : undefined;
  const triageBranches = !hasDualStopBranches ? (execution.triageBranches ?? []) : [];

  const omitted = baselineRemaining.stops.filter(stop => !proposed.stops.some(candidate => candidate.id === stop.id));
  const previousMargin = conservativeSummary(baselineRemaining)?.margin;
  const proposedMargin = conservativeSummary(proposed)?.margin;
  const delta = previousMargin && proposedMargin && subtractResources(proposedMargin, previousMargin);
  const added = proposed.stops.filter(stop => !baselineRemaining.stops.some(prior => prior.id === stop.id));
  const shortened = proposed.stops.filter(stop =>
    baselineRemaining.stops.some(prior => prior.id === stop.id && prior.activity.minutes > stop.activity.minutes),
  );
  const roundTripBurn = stationaryRoundTripWaitCost();
  const frontierPct = initialFrontier.fullScienceKm2 > 0
    ? Math.round((currentFrontier.fullScienceKm2 / initialFrontier.fullScienceKm2) * 100)
    : 100;

  return (
    <section className="mission-review" aria-label="Replan review">
      <h1 ref={headingRef} tabIndex={-1}>
        {execution.status === 'HOLD' ? 'Holding position' : 'Review the revised plan'}
      </h1>
      {execution.events.at(-1) && <p className="field-event-title">{eventLabel(execution.events.at(-1)!.category)}</p>}
      <div className="cc-comms-callout" role="note">
        <div className="cc-comms-callout-head">
          <strong>Onboard crew triage · Earth delay bypassed</strong>
          <Badge variant="info" label={`${ASSUMED_ONE_WAY_LIGHT_MINUTES.toFixed(1)} min OWLT`} />
        </div>
        <p>
          Acting now avoids ~{(ASSUMED_ONE_WAY_LIGHT_MINUTES * 2).toFixed(0)} min round-trip Earth wait (~{roundTripBurn.oxygen.toFixed(0)} L O₂ / {roundTripBurn.energy.toFixed(0)} Wh stationary burn, scenario assumption).
        </p>
        <small>
          Safe-return science frontier: {currentFrontier.fullScienceKm2.toFixed(2)} km² ({frontierPct}% of baseline) · {currentFrontier.totalReachableKm2.toFixed(2)} km² transit-safe
        </small>
      </div>
      {execution.status === 'HOLD' && <Button label="Resume review" variant="primary" onClick={onReopen} />}
      {!hasDualStopBranches && execution.proposalReason && <p>{execution.proposalReason}</p>}

      {hasDualStopBranches && finishBranch && leaveBranch ? (
        <>
          {execution.proposalReason && (
            <p className="context-note">
              <strong>Recommendation:</strong> {execution.proposalReason}
            </p>
          )}
          {activeProg && (
            <p className="context-note">
              Interrupted at <strong>{activeProg.stopName}</strong>: {activeProg.exploredMinutes.toFixed(0)} /{' '}
              {activeProg.plannedMinutes.toFixed(0)} min explored · {activeProg.observations.length} observation(s) preserved.
            </p>
          )}
          <div className="mission-comparison">
            <Card padding={3} data-recommended={execution.recommendedProposal === 'finish-stop'}>
              <VStack gap={1}>
                <HStack hAlign="between" vAlign="center" gap={1.5} wrap="wrap">
                  <small>
                    Option A · Finish stop &amp; continue {execution.recommendedProposal === 'finish-stop' ? '(Recommended)' : ''}
                  </small>
                  <Badge variant={stateBadgeVariant(finishBranch.state)} label={stateLabel(finishBranch.state)} />
                </HStack>
                <p>{missionSequence(finishBranch)}</p>
                <p>{marginText(conservativeSummary(finishBranch)?.margin ?? null)} at 0.8×</p>
                {!canApprove(finishBranch) && <small>Breaks 0.8×–1.2× reserve envelope.</small>}
              </VStack>
            </Card>
            <Card padding={3} data-recommended={execution.recommendedProposal === 'leave-stop'}>
              <VStack gap={1}>
                <HStack hAlign="between" vAlign="center" gap={1.5} wrap="wrap">
                  <small>
                    Option B · Leave stop now (keep partial science){' '}
                    {execution.recommendedProposal === 'leave-stop' ? '(Recommended)' : ''}
                  </small>
                  <Badge variant={stateBadgeVariant(leaveBranch.state)} label={stateLabel(leaveBranch.state)} />
                </HStack>
                <p>{missionSequence(leaveBranch)}</p>
                <p>{marginText(conservativeSummary(leaveBranch)?.margin ?? null)} at 0.8×</p>
                {!canApprove(leaveBranch) && <small>Breaks 0.8×–1.2× reserve envelope.</small>}
              </VStack>
            </Card>
          </div>
          <div className="mission-buttons">
            {execution.status === 'REVIEW' && (
              <>
                <Button
                  label="Approve: finish stop & continue"
                  variant={execution.recommendedProposal === 'finish-stop' ? 'primary' : 'secondary'}
                  size="sm"
                  isDisabled={!canApprove(finishBranch)}
                  onClick={() => onDecision(finishBranch, 'approved', 'finish-stop')}
                />
                <Button
                  label="Approve: leave stop & continue"
                  variant={execution.recommendedProposal === 'leave-stop' ? 'primary' : 'secondary'}
                  size="sm"
                  isDisabled={!canApprove(leaveBranch)}
                  onClick={() => onDecision(leaveBranch, 'approved', 'leave-stop')}
                />
                <Button label="Hold position" variant="secondary" size="sm" onClick={() => onDecision(proposed, 'held')} />
              </>
            )}
            {returnPlan && (
              <Button
                label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
                variant="secondary"
                size="sm"
                isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'}
                onClick={() => onDecision(returnPlan, 'abort')}
              />
            )}
          </div>
        </>
      ) : (
        <>
          {triageBranches.length > 1 && (
            <div className="cc-triage-options" role="radiogroup" aria-label="Tactical triage options">
              {triageBranches.map(branch => {
                const isSelected = branch.id === selectedBranchId;
                const branchMargin = conservativeSummary(branch.plan)?.margin ?? null;
                return (
                  <Card
                    key={branch.id}
                    padding={2}
                    data-recommended={isSelected}
                  >
                    <VStack gap={1}>
                      <HStack hAlign="between" vAlign="center" gap={1.5} wrap="wrap">
                        <strong>{branch.label}</strong>
                        <Badge variant={stateBadgeVariant(branch.plan.state)} label={stateLabel(branch.plan.state)} />
                      </HStack>
                      <small>{branch.summary}</small>
                      <small>{marginText(branchMargin)} at 0.8×</small>
                      <Button
                        label={isSelected ? 'Selected for preview' : 'Preview this option'}
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        isDisabled={isSelected}
                        onClick={() => onSelectBranch(branch.id)}
                      />
                    </VStack>
                  </Card>
                );
              })}
            </div>
          )}
          <PlanComparison previous={baselineRemaining} proposed={proposed} label="Previous remaining plan" speed={0.8} />
          {omitted.length > 0 && <p>Deferred: {omitted.map(stop => stop.name).join(', ')}.</p>}
          {added.length > 0 && <p>Added: {added.map(stop => stop.name).join(', ')}.</p>}
          {delta && <p>Reserve change at 0.8× · {marginText(delta)}.</p>}
          {shortened.length > 0 && <p>Shortened activity: {shortened.map(stop => stop.name).join(', ')}.</p>}
          {!canApprove(proposed) && <p role="status">Approval requires all three reserves at every modeled speed.</p>}
          <div className="mission-buttons">
            {execution.status === 'REVIEW' && (
              <>
                <Button
                  label="Approve revision & continue"
                  variant="primary"
                  size="sm"
                  isDisabled={!canApprove(proposed)}
                  onClick={() => onDecision(proposed, 'approved')}
                />
                <Button label="Hold position" variant="secondary" size="sm" onClick={() => onDecision(proposed, 'held')} />
              </>
            )}
            {returnPlan && (
              <Button
                label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
                variant="secondary"
                size="sm"
                isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'}
                onClick={() => onDecision(returnPlan, 'abort')}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function MissionLifecycle({
  bundle,
  dataState,
}: {
  bundle: FieldBundle;
  dataState?: Extract<BundleResult['state'], 'VERIFIED' | 'SOURCE_REVIEW_REQUIRED' | 'DEMO'>;
}) {
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
  const [show3D, setShow3D] = useState(false);
  const [showFrontier, setShowFrontier] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<TriageBranch['id']>('optimal');
  const [pendingSingleSwitch, setPendingSingleSwitch] = useState(false);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [resetViewRequestKey, setResetViewRequestKey] = useState(0);
  const [inspectedPoint, setInspectedPoint] = useState<MapPointInspection | null>(null);

  const { manifest } = bundle;
  const isDemo = dataState === 'DEMO' || manifest.status === 'DEMO_SYNTHETIC';
  const origin = useMemo(() => landingCell(bundle), [bundle]);
  const [customCol, setCustomCol] = useState(String(origin[1]));
  const [customRow, setCustomRow] = useState(String(origin[0]));

  const initialFrontier = useMemo(
    () => liveFrontierMembership(bundle, { origin, spent: zeroResources }),
    [bundle, origin],
  );
  const initialFrontierSummary = useMemo(
    () => summarizeFrontier(initialFrontier, manifest.cellWidthMeters, manifest.cellHeightMeters),
    [initialFrontier, manifest.cellHeightMeters, manifest.cellWidthMeters],
  );
  const liveFrontier = useMemo(
    () =>
      execution
        ? liveFrontierMembership(bundle, {
            origin: execution.position,
            spent: execution.spent,
            hazards: execution.hazards,
            speedFactor: execution.speedFactor,
            preference: execution.active.routePreference,
          })
        : initialFrontier,
    [bundle, execution, initialFrontier],
  );
  const currentFrontierSummary = useMemo(
    () => summarizeFrontier(liveFrontier, manifest.cellWidthMeters, manifest.cellHeightMeters),
    [liveFrontier, manifest.cellHeightMeters, manifest.cellWidthMeters],
  );

  const routePreferenceOptions = useMemo(
    () =>
      bundle.contextData?.thermalInertia
        ? [...baseRoutePreferenceOptions, thermalRoutePreferenceOption]
        : baseRoutePreferenceOptions,
    [bundle.contextData?.thermalInertia],
  );

  const planning = useMemo(() => {
    if (execution || !selected.length) return null;
    const input = { bundle, origin, stops: selected, spent: zeroResources, routePreference: preference };
    return {
      primary: previewMission(input),
      lowerSlope: selected.length === 1 ? previewMission({ ...input, routePreference: 'lowerSlope' }) : null,
    };
  }, [bundle, execution, origin, preference, selected]);

  const activeTriagePlan = useMemo(() => {
    if (!execution?.proposal) return null;
    if (execution.activeStopId || !execution.triageBranches?.length) return execution.proposal;
    return execution.triageBranches.find(b => b.id === selectedBranchId)?.plan ?? execution.proposal;
  }, [execution, selectedBranchId]);

  const primary = planning?.primary.optimized;
  const plan =
    activeTriagePlan ??
    execution?.active ??
    (useAlternative === 'subset' ? planning?.primary.subset : undefined) ??
    (useAlternative === 'priority' ? planning?.primary.priority : undefined) ??
    (useAlternative === 'lowerSlope' ? planning?.lowerSlope?.optimized : undefined) ??
    primary;
  const returnPlan = useMemo(
    () => (execution && execution.status !== 'COMPLETED' ? proposeReturn(execution, bundle) : null),
    [bundle, execution],
  );
  const previous = useMemo(() => execution && remainingActivePlan(execution, bundle), [bundle, execution]);
  const currentPlan = execution && !execution.proposal && previous ? previous : plan;
  const displayed = currentPlan?.legs;
  const overlay = useMemo(
    () => ({
      planned: displayed ?? [],
      previous: execution?.proposal ? previous?.legs : undefined,
      traveled: execution?.travels,
      hazards: execution?.hazards,
      position: execution?.position,
      selected: mapSelection,
    }),
    [displayed, execution, previous, mapSelection],
  );
  const storageKey = `seshat-execution-v1:${manifest.sourceFileSha256 ?? manifest.sourceId}:${manifest.baseIndex}`;

  const catalog = useMemo(() => manifest.scienceTargets ?? [], [manifest.scienceTargets]);
  const activeExecutionLeg = execution?.active.legs[execution.legIndex];
  const baselineGate = useMemo(() => conservativeSummary(plan), [plan]);
  const activeStopProgress = execution?.activeStopId ? execution.stopProgress?.[execution.activeStopId] : undefined;

  const opportunityAssessments = useMemo(() => {
    if (!catalog.length) return {};
    const liveScenario: MissionScenario = {
      id: scenario.id,
      label: scenario.label,
      timeBudgetMinutes: scenario.timeBudgetMinutes,
      elapsedMinutes: execution ? execution.spent.minutes : 0,
      reserveMinutes: scenario.reserveMinutes,
      referenceSpeedMetersPerSecond: scenario.referenceSpeedMetersPerSecond,
      speedMultipliers: [0.8, 1, 1.2],
      gradeModelId: scenario.gradeModelId,
      datasetRevision: manifest.modelId ?? scenario.id,
    };
    return evaluatePositionOpportunities(
      bundle,
      execution ? execution.position : origin,
      liveScenario,
      catalog,
      execution?.hazards ?? [],
    );
  }, [bundle, catalog, execution, manifest.modelId, origin]);

  const phaseKey = !execution
    ? locked
      ? 'LOCKED'
      : 'PLAN'
    : execution.status === 'REVIEW'
      ? 'REVIEW'
      : execution.status === 'HOLD'
        ? 'HOLD'
        : execution.status === 'COMPLETED'
          ? 'COMPLETED'
          : execution.activeStopId
            ? activeStopProgress?.status === 'exploring'
              ? 'EXPLORE'
              : 'ARRIVED'
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
    try {
      localStorage.setItem(storageKey, JSON.stringify(execution));
    } catch (error) {
      console.warn('Mission history could not be saved on this browser.', error);
    }
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
    setPendingSingleSwitch(false);
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
    const inCentral = index !== -1;
    const nbMeta = manifest.mapDisplay?.neighborhood;
    let isValidTerrain = false;

    if (inCentral) {
      isValidTerrain = bundle.mask[index] === 1 && index !== manifest.baseIndex;
    } else if (nbMeta && bundle.contextData?.neighborhoodMask) {
      const nbCol = Math.min(nbMeta.width - 1, Math.max(0, Math.floor(220 + col / 2)));
      const nbRow = Math.min(nbMeta.height - 1, Math.max(0, Math.floor(220 + row / 2)));
      const nbIdx = nbRow * nbMeta.width + nbCol;
      isValidTerrain = bundle.contextData.neighborhoodMask[nbIdx] === 1;
    }

    if (!isValidTerrain) {
      return setNotice('Choose a covered terrain cell away from the landing site.');
    }

    const documented = manifest.scienceTargets?.find(stop => stop.location.gridRow === row && stop.location.gridCol === col);
    const chunkSpan = 220;
    const cCol = Math.floor(col / chunkSpan);
    const cRow = Math.floor(row / chunkSpan);
    const chDesc = nbMeta?.chunks.find(c => c.rowOffset === cRow && c.colOffset === cCol);
    const defaultName = chDesc ? `${chDesc.label} · (${row}, ${col})` : `Point (${row}, ${col})`;
    addStop(documented ?? scenarioPoint(point, defaultName));
  }

  function addManualCell() {
    if (!customRow.trim() || !customCol.trim()) return setNotice('Enter both grid coordinates.');
    const row = Number(customRow);
    const col = Number(customCol);
    const minCoord = manifest.mapDisplay?.neighborhood ? -440 : 0;
    const maxCoord = manifest.mapDisplay?.neighborhood ? 660 : manifest.width;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < minCoord || row >= maxCoord || col < minCoord || col >= maxCoord) {
      return setNotice(`Coordinates must be integers within ${minCoord}–${maxCoord - 1}.`);
    }
    selectCell(row, col);
  }

  function exportPlan(format: 'json' | 'md') {
    if (!plan) return;
    const archive = createArchive(
      execution?.baseline ?? plan,
      manifest,
      execution ?? undefined,
      bundle.contextData,
      execution ? undefined : limit,
      { initial: initialFrontierSummary, current: currentFrontierSummary },
    );
    download(
      `seshat-${execution?.status === 'COMPLETED' ? 'mission-archive' : 'baseline'}.${format}`,
      format === 'json' ? JSON.stringify(archive, null, 2) : archiveMarkdown(archive),
      format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8',
    );
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
    setExecution(current => current && decideReplan(current, updated, decision, stopAction ? { stopAction } : undefined));
  }

  const activeOverlays = [
    ...(showFrontier ? ['frontier'] : []),
    ...(showElevation ? ['elevation'] : []),
    ...(showGeology ? ['geology'] : []),
    ...(showThermal ? ['thermal'] : []),
  ];

  const handleOverlayToggle = (next: string[]) => {
    setShowFrontier(next.includes('frontier'));
    setShowElevation(next.includes('elevation'));
    setShowGeology(next.includes('geology'));
    setShowThermal(next.includes('thermal'));
  };

  const travelControls = execution?.status === 'EXECUTING' && !execution.activeStopId && !execution.pendingReading && activeExecutionLeg;
  const baselineDecision = plan && (
    <section className="field-section field-decision" aria-label="Baseline decision">
      <h2>
        Return reserves <small>at 0.8× pace</small>
      </h2>
      <p className="field-baseline-gate">
        {baselineGate?.margin ? `0.8× margin: ${marginText(baselineGate.margin)}` : 'Return margin unavailable'}
      </p>
      {baselineGate?.margin && <small>Limiting resource · {baselineGate.limitingLabel}</small>}
      <p>{missionSequence(plan)}</p>
      {plan.deferred.length > 0 && <p>Deferred: {plan.deferred.map(stop => stop.name).join(', ')}.</p>}
      <Button label="Approve & lock baseline plan" variant="primary" isDisabled={!canApprove(plan)} onClick={() => setLocked(true)} />
      {!canApprove(plan) && <p>Approval requires all reserves at 0.8×, 1× and 1.2×.</p>}
    </section>
  );

  return (
    <main className="field-workbench">
      <header className="field-header">
        <div className="field-header-brand">
          <strong>SESHAT</strong>
          <span>{isDemo ? 'Synthetic acceptance terrain' : 'Jezero western fan'}</span>
        </div>
        <div className="field-header-actions">
          <ThemeControlPopup />
          <Button
            label="Sources"
            variant="secondary"
            size="sm"
            onClick={() => setShowSources(value => !value)}
            aria-expanded={showSources}
          />
        </div>
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
            show3D={show3D}
            onToggle3D={() => setShow3D(v => !v)}
            showFrontier={showFrontier}
            liveFrontier={liveFrontier}
            fitRequestKey={fitRequestKey}
            resetViewRequestKey={resetViewRequestKey}
            mission={overlay}
          />
          <div className="field-map-tools">
            <Collapsible
              className="field-layers"
              defaultIsOpen={!manifest.mapDisplay}
              chevronPosition="end"
              trigger="Layers"
            >
              <HStack gap={1.5} wrap="wrap">
                <ToggleButtonGroup
                  type="single"
                  size="sm"
                  label="Base surface layer"
                  value={manifest.optical && optical ? 'orbital' : 'terrain'}
                  onChange={val => {
                    if (val) setOptical(val === 'orbital');
                  }}
                >
                  <ToggleButton value="terrain" label="Terrain" />
                  {manifest.optical && <ToggleButton value="orbital" label="Orbital" />}
                </ToggleButtonGroup>
                <ToggleButtonGroup
                  type="multiple"
                  size="sm"
                  label="Scientific overlays"
                  value={activeOverlays}
                  onChange={handleOverlayToggle}
                >
                  <ToggleButton value="frontier" label="Frontier" />
                  <ToggleButton value="elevation" label="Elevation" />
                  {bundle.contextData?.geologicUnits && <ToggleButton value="geology" label="Geology" />}
                  {bundle.contextData?.thermalInertia && <ToggleButton value="thermal" label="Thermal" />}
                </ToggleButtonGroup>
              </HStack>
            </Collapsible>
            <Button
              label={show3D ? '2D Map' : '3D Terrain'}
              variant={show3D ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShow3D(v => !v)}
            />
            <Button
              label="Back to Jezero"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShow3D(false);
                setResetViewRequestKey(key => key + 1);
              }}
            />
            <Button
              label="Fit mission"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShow3D(false);
                setFitRequestKey(key => key + 1);
              }}
            />
          </div>
          {inspectedPoint && (
            <div className="cc-point-inspector field-point" aria-label="Map point inspection">
              <div className="field-point-title">
                <strong>{inspectedPoint.label}</strong>
                <IconButton
                  label="Close map point inspection"
                  icon={<Icon icon="close" />}
                  variant="ghost"
                  size="sm"
                  onClick={clearInspection}
                />
              </div>
              {inspectedPoint.lat != null && inspectedPoint.lon != null && (
                <p>
                  {Math.abs(inspectedPoint.lat).toFixed(4)}°{inspectedPoint.lat < 0 ? 'S' : 'N'},{' '}
                  {Math.abs(inspectedPoint.lon).toFixed(4)}°{inspectedPoint.lon < 0 ? 'W' : 'E'}
                </p>
              )}
              {inspectedPoint.elevationMeters != null && (
                <p>{inspectedPoint.elevationMeters.toFixed(0)} m elevation</p>
              )}
              {inspectedPoint.status === 'COVERED' && inspectedPoint.frontierStatus && (
                <p className="cc-inspector-frontier">{inspectedPoint.frontierStatus}</p>
              )}
              {inspectedPoint.status === 'COVERED' && inspectedPoint.geologicUnit && (showGeology || inspectedPoint.geologicUnit !== 'Unknown / unmapped') && (
                <p>Geologic unit: {inspectedPoint.geologicUnit}</p>
              )}
              {inspectedPoint.status === 'COVERED' && inspectedPoint.thermalInertia != null && (
                <p>
                  Thermal inertia: {inspectedPoint.thermalInertia.toFixed(1)} J m⁻² K⁻¹ s⁻¹/²{' '}
                  {inspectedPoint.thermalInertia >= 220 ? '(consolidated bedrock)' : inspectedPoint.thermalInertia < 200 ? '(loose sand/dust)' : '(mixed regolith)'}
                </p>
              )}
              {inspectedPoint.status === 'COVERED' && inspectedPoint.cell && !locked && !execution && (
                <Button
                  label="Add this stop"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    selectCell(...inspectedPoint.cell!);
                    clearInspection();
                  }}
                />
              )}
              {inspectedPoint.status === 'COVERED' && execution && <p>Selected location for your next event.</p>}
            </div>
          )}
          {manifest.mapDisplay && <div className="field-map-credit">NASA / JPL · USGS</div>}
        </section>
        <aside className="field-panel" aria-label={execution ? 'Mission execution' : 'Mission planning'}>
          {isDemo && (
            <div className="field-section">
              <Banner
                status="warning"
                collapsible={false}
                title="SYNTHETIC — NOT MARS"
                description="Artificially generated acceptance landscape for testing traverse UI and graphs. Routes do not depict Mars."
              />
            </div>
          )}
          {showSources && (
            <section className="field-section field-sources" aria-label="NASA Space Apps Challenge Data and Provenance">
              <div className="field-sources-header">
                <span className="field-sources-badge">NASA Space Apps Challenge 2026</span>
                <h2>Challenge Resources &amp; NASA Data Utilization</h2>
                <p className="field-sources-sub">
                  Directly incorporating datasets listed under the official{' '}
                  <a
                    href="https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Interplanetary Survival Guide: Martian Map Resources tab ↗
                  </a>
                  . All telemetry, routing, elevation, and imagery derive from verified NASA mission archives.
                </p>
              </div>

              <div className="field-sources-stats">
                <div className="field-stat-card">
                  <strong>48,400</strong>
                  <span>NASA CTX DTM elevation cells (20 m/px)</span>
                </div>
                <div className="field-stat-card">
                  <strong>90,376</strong>
                  <span>PDS MEDA pressure records (Sols 490, 509, 575)</span>
                </div>
                <div className="field-stat-card">
                  <strong>3 Sites</strong>
                  <span>Verified PDS sample targets &amp; WATSON rock textures</span>
                </div>
                <div className="field-stat-card">
                  <strong>200+ Tiles</strong>
                  <span>Mars Trek CTX 6 m &amp; Viking 232 m pyramid</span>
                </div>
              </div>

              <div className="field-sources-breakdown">
                <h3>Utilized NASA Challenge Datasets</h3>
                <ul className="field-dataset-list">
                  <li className="field-dataset-item">
                    <div className="field-dataset-meta">
                      <strong>NASA/JPL Mars Trek · MRO CTX 20 m DTM</strong>
                      <span className="field-dataset-role">
                        Powers Dijkstra directed traversal graph, slope grade cost modeling, elevation profile, 20 m/5 m contours, and hypsometric heatmap.
                      </span>
                      <a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer">
                        JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m ↗
                      </a>
                    </div>
                  </li>

                  {manifest.optical && (
                    <li className="field-dataset-item">
                      <div className="field-dataset-meta">
                        <strong>NASA/JPL Mars Trek · MRO CTX 6 m Controlled Mosaic</strong>
                        <span className="field-dataset-role">
                          High-resolution orbital basemap pyramid (levels 8–13) aligned to local spherical Mars AEQD reference frame.
                        </span>
                        <a href={manifest.optical.sourceUrl} target="_blank" rel="noopener noreferrer">
                          JEZ_ctx_B_soc_008_orthoMosaic_6m ↗
                        </a>
                      </div>
                    </li>
                  )}

                  <li className="field-dataset-item">
                    <div className="field-dataset-meta">
                      <strong>NASA/JPL Mars Trek · USGS Viking MDIM 2.1 Color Mosaic</strong>
                      <span className="field-dataset-role">
                        Global Mars 232 m color imagery covering planetary zoom levels 0–2 and Jezero regional corridor levels 3–7.
                      </span>
                      <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener noreferrer">
                        NASA Mars Trek Portal ↗
                      </a>
                    </div>
                  </li>

                  {meda && (
                    <li className="field-dataset-item">
                      <div className="field-dataset-meta">
                        <strong>NASA PDS Mars 2020 · MEDA Atmospheric Pressure Sensor</strong>
                        <span className="field-dataset-role">
                          90,376 calibrated ground measurements across Sols 490, 509, 575 ({Math.round(meda.sols[0]?.medianPa ?? 798)} Pa median); provides in-situ Martian barometric context in mission archives.
                        </span>
                        <a href={meda.sourceUrl} target="_blank" rel="noopener noreferrer">
                          NASA PDS Atmospheres Node (urn:nasa:pds:mars2020_meda) ↗
                        </a>
                      </div>
                    </li>
                  )}

                  <li className="field-dataset-item">
                    <div className="field-dataset-meta">
                      <strong>NASA PDS Mars 2020 · Sample Dossiers &amp; Landing Registry</strong>
                      <span className="field-dataset-role">
                        Ground truth planetocentric coordinates for Octavia E. Butler landing site and core sampling targets: Swift Run (Skinner Ridge), Hazeltop (Wildcat Ridge), Shuyak (Cape Nukshak).
                      </span>
                      <a
                        href="https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        PDS Geosciences Mars 2020 Initial Reports Vol. 2 (Ch. 11, 14, 16) ↗
                      </a>
                    </div>
                  </li>

                  <li className="field-dataset-item">
                    <div className="field-dataset-meta">
                      <strong>NASA Mars 2020 Perseverance · Surface Camera Archive</strong>
                      <span className="field-dataset-role">
                        In-situ WATSON microscopic abrasion rock textures and Hazcam workspace context photographs for Skinner Ridge, Wildcat Ridge, and Enchanted Lake.
                      </span>
                      <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/" target="_blank" rel="noopener noreferrer">
                        NASA Mars 2020 Raw Image Portal ↗
                      </a>
                    </div>
                  </li>

                  {bundle.contextData?.geologicUnits && (
                    <li className="field-dataset-item">
                      <div className="field-dataset-meta">
                        <strong>USGS–NASA Planetary Geologic Mapping Program &amp; Stack et al. (2020)</strong>
                        <span className="field-dataset-role">
                          6-unit photogeologic bedrock classification (SIM 3464) mapping olivine-rich crater floor, pyroxene floor, and delta front formations.
                        </span>
                        <a href={bundle.contextData.geologicUnits.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Jezero Bedrock Photogeology (Stack et al. / USGS SIM 3464) ↗
                        </a>
                      </div>
                    </li>
                  )}

                  {manifest.contextLayers?.thermalInertia && (
                    <li className="field-dataset-item">
                      <div className="field-dataset-meta">
                        <strong>Edwards &amp; Buz (2021) · Jezero Thermal Inertia Map V1</strong>
                        <span className="field-dataset-role">
                          Surface thermophysical property overlay (142–304 TIU) indicating fine aeolian dust vs dense indurated bedrock pavement.
                        </span>
                        <a href={manifest.contextLayers.thermalInertia.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Thermal Inertia V1 (Zenodo 4931348) ↗
                        </a>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              <div className="field-sources-footer">
                <p>
                  <strong>Coordinate Reference Frame:</strong> Locally centered spherical Mars AEQD (R = 3,396,190 m, origin 18.452°N, 77.414°E). No invented coordinates or synthetic telemetry in production mode.
                </p>
                <p>{Object.values(scenario.environmentalContext).join(' ')}</p>
                <p>
                  <Link href={isDemo ? '/dev/' : '/dev/?demo=1'}>
                    {isDemo ? 'Switch to Jezero Mars dataset' : 'Synthetic test scene'}
                  </Link>
                </p>
              </div>
            </section>
          )}
          {reviewing && execution && previous && activeTriagePlan ? (
            <ChangeReview
              execution={execution}
              baselineRemaining={previous}
              returnPlan={returnPlan}
              headingRef={reviewHeadingRef}
              onDecision={decide}
              onReopen={() => setExecution(current => (current?.status === 'HOLD' ? { ...current, status: 'REVIEW' } : current))}
              activeProposal={activeTriagePlan}
              selectedBranchId={selectedBranchId}
              onSelectBranch={setSelectedBranchId}
              initialFrontier={initialFrontierSummary}
              currentFrontier={currentFrontierSummary}
            />
          ) : execution ? (
            <>
              <ExecutionPanel
                mission={execution}
                selected={mapSelection}
                headingRef={phaseHeadingRef}
                onEvent={entry => {
                  setSelectedBranchId('optimal');
                  setExecution(recordEvent(execution, bundle, entry));
                  setMapSelection(null);
                }}
                onExploreStep={() => advance('explore')}
                onFinishStop={() => advance('finish')}
                onLogObservation={note => setExecution(current => current && logStopObservation(current, note))}
                onTriggerReading={() => setExecution(current => current && triggerSimulatedReading(current, bundle))}
                onRecordReading={() => {
                  setSelectedBranchId('optimal');
                  setExecution(current => current && recordPendingReading(current, bundle));
                }}
                onDismissReading={() => setExecution(current => current && { ...current, pendingReading: null })}
              />
              {travelControls && (
                <div className="field-actions field-travel">
                  <Button
                    label={activeExecutionLeg.targetId === landingId ? 'Return to Landing Site' : 'Arrive at stop'}
                    variant="primary"
                    onClick={() => advance('arrive')}
                  />
                  <Button
                    label="Move along active leg"
                    variant="secondary"
                    onClick={() => advance('part')}
                    isDisabled={execution.cursor >= activeExecutionLeg.route.geometryGrid.length - 1}
                  />
                </div>
              )}
            </>
          ) : locked && plan ? (
            <section className="field-section">
              <h1 ref={phaseHeadingRef} tabIndex={-1}>
                Baseline approved
              </h1>
              <p>{missionSequence(plan)}</p>
              {baselineGate?.margin && <p>Return margin at 0.8× · {marginText(baselineGate.margin)}</p>}
              <div className="field-actions">
                <Button label="Start traverse" variant="primary" onClick={() => setExecution(startMission(plan, selected, limit))} />
                <Button label="Edit plan" variant="secondary" onClick={() => setLocked(false)} />
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
                if (newLimit === 1 && selected.length > 1) {
                  setPendingSingleSwitch(true);
                  return setNotice('Multiple stops selected. Trim to your top-priority stop to switch to Single mode.');
                }
                setPendingSingleSwitch(false);
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
          {notice && (
            <div role="status" className="field-notice-box">
              <p className="field-notice">{notice}</p>
              {pendingSingleSwitch && selected.length > 1 && (
                <Button
                  label={`Keep ${selected[0].name.split(' · ')[0]} only & switch to Single`}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLimit(1);
                    changeStops([selected[0]]);
                  }}
                />
              )}
            </div>
          )}
          {execution?.status !== 'COMPLETED' && (
            <section className="field-section cc-frontier-strip" aria-label="Live safe-return frontier">
              <div className="section-heading">
                <span>Safe-return frontier (0.8×)</span>
                <Button
                  label={showFrontier ? 'Hide map overlay' : 'Show on map'}
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFrontier(v => !v)}
                />
              </div>
              <p className="context-note">
                {currentFrontierSummary.fullScienceKm2.toFixed(2)} km² full-science ·{' '}
                {currentFrontierSummary.totalReachableKm2.toFixed(2)} km² transit-safe
                {execution && initialFrontierSummary.fullScienceKm2 > 0
                  ? ` (${Math.round((currentFrontierSummary.fullScienceKm2 / initialFrontierSummary.fullScienceKm2) * 100)}% of start)`
                  : ''}
              </p>
            </section>
          )}
          {execution?.status === 'COMPLETED' && <h2 className="field-complete">Mission complete</h2>}
          {returnPlan && !reviewing && (
            <section className="field-section">
              <h2>Direct return</h2>
              <p>{marginText(conservativeSummary(returnPlan)?.margin ?? null)} at 0.8×</p>
              {activeExecutionLeg?.targetId !== landingId && (
                <Button
                  label={canApprove(returnPlan) ? 'Abort & return directly' : 'Abort & return with reserve risk'}
                  variant="secondary"
                  size="sm"
                  isDisabled={returnPlan.legs.at(-1)?.route.status !== 'READY'}
                  onClick={() => decide(returnPlan, 'abort')}
                />
              )}
              {returnPlan.legs.at(-1)?.route.status !== 'READY' && <p>No modeled route to the landing site is available.</p>}
            </section>
          )}
          {!execution && !locked && primary && (
            <Collapsible
              className="mission-disclosure field-details"
              defaultIsOpen={false}
              chevronPosition="end"
              trigger="Route options"
            >
              <VStack gap={2}>
                <Selector
                  label="Route preference"
                  size="sm"
                  width="100%"
                  options={routePreferenceOptions}
                  value={preference}
                  onChange={value => {
                    setPreference(value as RoutePreference);
                    setUseAlternative('primary');
                  }}
                />
                <div className="field-actions">
                  <Button label="Show optimized order" variant="secondary" size="sm" onClick={() => setUseAlternative('primary')} />
                  {planning?.primary.subset && (
                    <Button label="Show feasible subset" variant="secondary" size="sm" onClick={() => setUseAlternative('subset')} />
                  )}
                  {planning?.lowerSlope && (
                    <Button label="Show lower-slope option" variant="secondary" size="sm" onClick={() => setUseAlternative('lowerSlope')} />
                  )}
                </div>
                {selected.length > 1 && planning && (
                  <PlanComparison
                    previous={planning.primary.priority}
                    proposed={primary}
                    label="Astronaut priority order"
                    action="Use priority order"
                    onChoose={() => setUseAlternative('priority')}
                  />
                )}
              </VStack>
            </Collapsible>
          )}
          {catalog.length > 0 && execution?.status !== 'COMPLETED' && (
            <Collapsible
              className="mission-disclosure field-details"
              defaultIsOpen={false}
              chevronPosition="end"
              trigger="Nearby target opportunities"
            >
              <div className="opportunity-list">
                {catalog.map(target => {
                  const assessment = opportunityAssessments[target.id];
                  const margin = assessment?.nominalMarginMinutes;
                  return (
                    <div key={target.id} className="opportunity-row">
                      <div className="opportunity-row-meta">
                        <strong>{target.name}</strong>
                        <small>
                          {margin == null ? 'Margin unavailable' : `${margin >= 0 ? '+' : ''}${margin.toFixed(1)} min at 1×`}
                        </small>
                      </div>
                      {assessment && (
                        <Badge variant={stateBadgeVariant(assessment.state)} label={stateLabel(assessment.state)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          )}
          {currentPlan && execution?.status !== 'COMPLETED' && (
            <Collapsible
              className="mission-disclosure field-details"
              defaultIsOpen={false}
              chevronPosition="end"
              trigger={reviewing ? 'Revised itinerary and resources' : execution || locked ? 'Approved route' : 'Itinerary and resources'}
            >
              <MissionPlanPreview
                plan={currentPlan}
                spent={execution?.spent ?? zeroResources}
                manifest={manifest}
                label={reviewing ? 'Proposed remaining route' : execution || locked ? 'Baseline and schedule' : 'Selected plan'}
              />
            </Collapsible>
          )}
          {plan && (execution || locked) && (
            <div className="field-actions field-export">
              <Button label="Download JSON" variant="secondary" size="sm" onClick={() => exportPlan('json')} />
              <Button label="Download Markdown" variant="secondary" size="sm" onClick={() => exportPlan('md')} />
              <Button label="Print plan" variant="secondary" size="sm" onClick={() => window.print()} />
              {execution?.status === 'COMPLETED' && (
                <Button
                  label="Plan another mission"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExecution(null);
                    changeStops([]);
                    setMapSelection(null);
                    setInspectedPoint(null);
                  }}
                />
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
