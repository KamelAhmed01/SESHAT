import type { FieldBundle } from '../data/loader';
import { addResources, atSpeed, budget, reserve, scienceResources, subtractResources, zeroResources } from './consumables';
import type { Resources } from './consumables';
import { canApprove, landingId, replanMission, stopLimit, targetCell } from './multi-leg-planner';
import type { MissionPlan } from './multi-leg-planner';
import { cellIndex, routeMetrics } from './traverse-graph';
import type { Cell, HazardZone } from './traverse-graph';
import { SPEED_FACTORS } from './types';
import type { ScienceTarget } from './types';

export const eventChannels = ['MANUAL_INPUT', 'AUTO_SENSOR_INPUT', 'INSTRUMENT_INTEGRATION'] as const;
export type EventChannel = typeof eventChannels[number];
export type EventDetails =
  | {category: 'MISSION_DELAY'; minutes: number}
  | {category: 'RESOURCE_CHANGE'; oxygen: number; energy: number}
  | {category: 'NEW_TERRAIN_HAZARD'; zone: HazardZone}
  | {category: 'ENVIRONMENTAL_OR_TERRAIN_CHANGE'; speedFactor: number}
  | {category: 'DESTINATION_ACCESSIBILITY_CHANGE'; targetId: string}
  | {category: 'NEW_SCIENTIFIC_DISCOVERY'; target: ScienceTarget};
export type MissionEvent = EventDetails & {
  id: number; minute: number; cell: Cell; channel: EventChannel; description: string;
};
export interface FieldObservation {
  id: string;
  stopId: string;
  stopName: string;
  timestampMinutes: number;
  note: string;
  measurement?: string;
  recordedDuring: 'exploration' | 'interrupted-stop';
}
export interface StopProgress {
  stopId: string;
  stopName: string;
  cell: Cell;
  plannedMinutes: number;
  exploredMinutes: number;
  status: 'pending' | 'arrived' | 'exploring' | 'interrupted' | 'completed' | 'departed-early';
  observations: FieldObservation[];
}
export interface SimulatedReading {
  id: string;
  sourceStopId: string;
  sourceStopName: string;
  cell: Cell;
  title: string;
  channel: EventChannel;
  description: string;
  measurement: string;
  suggestedTarget?: ScienceTarget;
  triggeredAtMinutes: number;
}
type Decision = { kind: 'approved' | 'held' | 'abort'; minute: number; plan: MissionPlan; stopAction?: 'finish-stop' | 'leave-stop' };
export interface TravelRecord { targetId: string; cells: Cell[]; used: Resources }

export interface MissionExecution {
  baseline: MissionPlan;
  active: MissionPlan;
  proposal: MissionPlan | null;
  status: 'EXECUTING' | 'REVIEW' | 'HOLD' | 'COMPLETED';
  position: Cell;
  spent: Resources;
  cursor: number;
  legIndex: number;
  completed: string[];
  travels: TravelRecord[];
  priorities: string[];
  stopCapacity?: number;
  events: MissionEvent[];
  decisions: Decision[];
  hazards: HazardZone[];
  speedFactor: number;
  activeStopId?: string | null;
  stopProgress?: Record<string, StopProgress>;
  fieldObservations?: readonly FieldObservation[];
  pendingReading?: SimulatedReading | null;
  finishProposal?: MissionPlan | null;
  leaveStopProposal?: MissionPlan | null;
  recommendedProposal?: 'finish-stop' | 'leave-stop' | null;
  proposalReason?: string | null;
}

function initialStopProgress(plan: MissionPlan): Record<string, StopProgress> {
  const map: Record<string, StopProgress> = {};
  for (const stop of plan.stops) {
    const cell = targetCell(stop);
    if (!cell) continue;
    map[stop.id] = {
      stopId: stop.id,
      stopName: stop.name,
      cell,
      plannedMinutes: stop.activity.minutes,
      exploredMinutes: 0,
      status: 'pending',
      observations: [],
    };
  }
  return map;
}

export function startMission(plan: MissionPlan, priorities: readonly ScienceTarget[], stopCapacity = stopLimit): MissionExecution {
  if (!plan.stops.length || !canApprove(plan)) throw new Error('Approve a plan that meets every return reserve at all three speeds.');
  return {
    baseline: plan, active: plan, proposal: null, status: 'EXECUTING', position: plan.origin, spent: zeroResources,
    cursor: 0, legIndex: 0, completed: [], travels: [], priorities: priorities.map(stop => stop.id), stopCapacity,
    events: [], decisions: [], hazards: [], speedFactor: plan.travelSpeed,
    activeStopId: null, stopProgress: initialStopProgress(plan), fieldObservations: [],
    pendingReading: null, finishProposal: null, leaveStopProposal: null, recommendedProposal: null, proposalReason: null,
  };
}

function findSuggestedReadingCell(bundle: FieldBundle, origin: Cell, stops: readonly ScienceTarget[]): Cell {
  const { width, height, baseIndex } = bundle.manifest;
  const taken = new Set<string>([
    `${Math.floor(baseIndex / width)},${baseIndex % width}`,
    `${origin[0]},${origin[1]}`,
    ...stops.flatMap(stop => {
      const c = targetCell(stop);
      return c ? [`${c[0]},${c[1]}`] : [];
    }),
  ]);
  for (let radius = 6; radius <= 18; radius += 2) {
    for (const [dr, dc] of [[radius, radius], [-radius, radius], [radius, -radius], [radius, 0], [0, radius], [-radius, 0]]) {
      const r = origin[0] + dr;
      const c = origin[1] + dc;
      if (r < 0 || r >= height || c < 0 || c >= width) continue;
      if (bundle.mask[r * width + c] === 1 && !taken.has(`${r},${c}`)) return [r, c];
    }
  }
  return origin;
}

export function triggerSimulatedReading(mission: MissionExecution, bundle: FieldBundle): MissionExecution {
  const stop = mission.active.stops.find(item => item.id === mission.activeStopId)
    ?? mission.active.stops.find(item => !(mission.completed ?? []).includes(item.id));
  const stopName = stop?.name ?? 'Current site';
  const contactCell = findSuggestedReadingCell(bundle, mission.position, mission.active.stops);
  const contactId = `sim-contact-${mission.events.length + 1}`;
  const suggestedTarget: ScienceTarget = {
    id: contactId,
    name: `Carbonate-olivine contact (${contactCell.join(', ')})`,
    objectiveTags: ['simulated-sensor', 'spectrometry'],
    location: {
      gridRow: contactCell[0],
      gridCol: contactCell[1],
      originalCoordinateText: `Simulated contact at grid cell (${contactCell.join(', ')})`,
      coordinateFrame: 'LOCAL_ANALYSIS_GRID',
      confidence: 'USER_SELECTED',
      locationSource: null,
    },
    science: {
      summary: 'Simulated spectrometer follow-up contact adjacent to current station (synthetic sensor prompt, not a PDS observation).',
      sourceIds: [],
      evidence: [],
      limitations: ['Simulated sensor trigger for mission-replan testing', 'Activity duration is assumed'],
    },
    activity: { minutes: 15, basis: 'SCENARIO_ASSUMPTION' },
  };
  const reading: SimulatedReading = {
    id: `reading-${mission.events.length + 1}`,
    sourceStopId: stop?.id ?? mission.active.legs[mission.legIndex]?.targetId ?? landingId,
    sourceStopName: stopName,
    cell: contactCell,
    title: 'Carbonate-olivine contact signature',
    channel: 'INSTRUMENT_INTEGRATION',
    description: `Spectrometer triggered while exploring ${stopName}; follow-up outcrop identified near (${contactCell.join(', ')}).`,
    measurement: '76% carbonate-olivine band depth at 2.31 μm (simulated sensor reading)',
    suggestedTarget,
    triggeredAtMinutes: mission.spent.minutes,
  };
  return { ...mission, pendingReading: reading };
}

export function logStopObservation(mission: MissionExecution, note: string, measurement?: string): MissionExecution {
  const trimmed = note.trim();
  if (!trimmed) return mission;
  const progressMap = { ...(mission.stopProgress ?? {}) };
  const leg = mission.active.legs[mission.legIndex];
  const stopId = mission.activeStopId
    ?? Object.values(progressMap).find(item => item.status === 'interrupted' || item.status === 'exploring' || item.status === 'arrived')?.stopId
    ?? leg?.targetId
    ?? landingId;
  const existing = progressMap[stopId];
  const stopName = existing?.stopName ?? leg?.to ?? 'Field station';
  const obs: FieldObservation = {
    id: `obs-${(mission.fieldObservations?.length ?? 0) + 1}`,
    stopId,
    stopName,
    timestampMinutes: mission.spent.minutes,
    note: trimmed,
    measurement: measurement?.trim() || undefined,
    recordedDuring: mission.status === 'REVIEW' || existing?.status === 'interrupted' ? 'interrupted-stop' : 'exploration',
  };
  const nextProgress = existing
    ? { ...progressMap, [stopId]: { ...existing, observations: [...existing.observations, obs] } }
    : progressMap;
  return {
    ...mission,
    stopProgress: nextProgress,
    fieldObservations: [...(mission.fieldObservations ?? []), obs],
  };
}

export function advanceMission(
  mission: MissionExecution,
  bundle: FieldBundle,
  progress: 'part' | 'arrive' | 'explore' | 'finish',
  exploreStepMinutes = 10,
): MissionExecution {
  if (mission.status !== 'EXECUTING') return mission;
  const leg = mission.active.legs[mission.legIndex];
  if (!leg || leg.route.status !== 'READY') return mission;
  const progressMap = { ...(mission.stopProgress ?? initialStopProgress(mission.active)) };

  // Currently stationed at an arrived/exploring science stop
  if (mission.activeStopId) {
    if (progress === 'part' || progress === 'arrive') return mission;
    const stopId = mission.activeStopId;
    const plannedMinutes = Math.max(0, leg.leave - leg.arrival);
    const currentProg: StopProgress = progressMap[stopId] ?? {
      stopId,
      stopName: leg.to,
      cell: mission.position,
      plannedMinutes,
      exploredMinutes: 0,
      status: 'arrived',
      observations: [],
    };
    if (progress === 'explore') {
      const remaining = Math.max(0, currentProg.plannedMinutes - currentProg.exploredMinutes);
      const step = Math.min(Math.max(1, exploreStepMinutes), remaining);
      if (step <= 0) return mission;
      const used = scienceResources(step);
      const nextExplored = currentProg.exploredMinutes + step;
      const updatedProg: StopProgress = {
        ...currentProg,
        exploredMinutes: nextExplored,
        status: 'exploring',
      };
      let nextMission: MissionExecution = {
        ...mission,
        spent: addResources(mission.spent, used),
        stopProgress: { ...progressMap, [stopId]: updatedProg },
      };
      if (
        !nextMission.pendingReading &&
        nextMission.events.length === 0 &&
        nextMission.completed.length === 0 &&
        nextExplored >= Math.min(10, currentProg.plannedMinutes)
      ) {
        nextMission = triggerSimulatedReading(nextMission, bundle);
      }
      return nextMission;
    }
    // progress === 'finish' from arrived/exploring state finishes remaining stop time cleanly
    const remaining = Math.max(0, currentProg.plannedMinutes - currentProg.exploredMinutes);
    const used = remaining > 0 ? scienceResources(remaining) : zeroResources;
    const updatedProg: StopProgress = {
      ...currentProg,
      exploredMinutes: currentProg.plannedMinutes,
      status: 'completed',
    };
    const nextLegIndex = mission.legIndex + 1;
    const nextCompleted = mission.completed.includes(stopId) ? mission.completed : [...mission.completed, stopId];
    const hasMore = nextLegIndex < mission.active.legs.length;
    return {
      ...mission,
      cursor: 0,
      legIndex: nextLegIndex,
      activeStopId: null,
      spent: addResources(mission.spent, used),
      status: hasMore ? 'EXECUTING' : 'COMPLETED',
      completed: nextCompleted,
      stopProgress: { ...progressMap, [stopId]: updatedProg },
    };
  }

  if (progress === 'explore') return mission;
  const path = leg.route.geometryGrid, last = path.length - 1;

  if (progress === 'arrive') {
    const cells = path.slice(mission.cursor, last + 1);
    const travel = cells.length > 1 ? atSpeed(routeMetrics(bundle, cells).consumption, mission.speedFactor) : zeroResources;
    const isReturn = leg.targetId === landingId;
    if (isReturn) {
      return {
        ...mission,
        position: path[last],
        cursor: 0,
        legIndex: mission.legIndex + 1,
        activeStopId: null,
        spent: addResources(mission.spent, travel),
        status: 'COMPLETED',
        travels: [...mission.travels, { targetId: leg.targetId, cells, used: travel }],
      };
    }
    const existingProg = progressMap[leg.targetId];
    const stopProg: StopProgress = existingProg
      ? { ...existingProg, status: 'arrived', cell: path[last] }
      : {
          stopId: leg.targetId,
          stopName: leg.to,
          cell: path[last],
          plannedMinutes: Math.max(0, leg.leave - leg.arrival),
          exploredMinutes: 0,
          status: 'arrived',
          observations: [],
        };
    return {
      ...mission,
      position: path[last],
      cursor: last,
      activeStopId: leg.targetId,
      spent: addResources(mission.spent, travel),
      travels: [...mission.travels, { targetId: leg.targetId, cells, used: travel }],
      stopProgress: { ...progressMap, [leg.targetId]: stopProg },
    };
  }

  const next = progress === 'finish' ? last : Math.min(last, mission.cursor + Math.max(1, Math.floor((last - mission.cursor) / 2)));
  if (next === mission.cursor && progress === 'part') return mission;
  const cells = path.slice(mission.cursor, next + 1);
  const travel = atSpeed(routeMetrics(bundle, cells).consumption, mission.speedFactor);
  const used = progress === 'finish' ? addResources(travel, scienceResources(leg.leave - leg.arrival)) : travel;
  const isReturn = leg.targetId === landingId && progress === 'finish';
  if (progress === 'finish' && !isReturn) {
    const existingProg = progressMap[leg.targetId];
    progressMap[leg.targetId] = {
      stopId: leg.targetId,
      stopName: leg.to,
      cell: path[last],
      plannedMinutes: Math.max(0, leg.leave - leg.arrival),
      exploredMinutes: Math.max(0, leg.leave - leg.arrival),
      status: 'completed',
      observations: existingProg?.observations ?? [],
    };
  }
  return {
    ...mission, position: path[next], cursor: progress === 'finish' ? 0 : next,
    legIndex: mission.legIndex + Number(progress === 'finish'),
    activeStopId: null,
    spent: addResources(mission.spent, used), status: isReturn ? 'COMPLETED' : 'EXECUTING',
    travels: [...mission.travels, {targetId: leg.targetId, cells, used}],
    completed: progress === 'finish' && !isReturn ? [...mission.completed, leg.targetId] : mission.completed,
    stopProgress: progressMap,
  };
}

function eventError(details: EventDetails, bundle: FieldBundle): string | null {
  const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
  switch (details.category) {
    case 'MISSION_DELAY':
      return nonnegative(details.minutes) && details.minutes > 0 ? null : 'Enter a positive delay.';
    case 'RESOURCE_CHANGE':
      return nonnegative(details.oxygen) && nonnegative(details.energy) && details.oxygen + details.energy > 0
        ? null : 'Enter a positive oxygen or battery loss.';
    case 'ENVIRONMENTAL_OR_TERRAIN_CHANGE':
      return details.speedFactor > 0 && details.speedFactor < 1 ? null : 'Enter a pace above 0% and below 100%.';
    case 'NEW_TERRAIN_HAZARD':
      return cellIndex(details.zone.cell, bundle) >= 0 && Number.isInteger(details.zone.radius) && details.zone.radius >= 0 && details.zone.radius <= 20
        ? null : 'Choose a map cell and a radius from 0 to 20 cells.';
    case 'NEW_SCIENTIFIC_DISCOVERY': {
      const cell = targetCell(details.target);
      return cell && bundle.mask[cellIndex(cell, bundle)] === 1 && nonnegative(details.target.activity.minutes) && details.target.name.trim()
        ? null : 'Choose a covered science location and a valid activity duration.';
    }
    default:
      return null;
  }
}

function remainingStops(mission: MissionExecution) {
  const remaining = new Map(mission.active.stops.filter(stop => !mission.completed.includes(stop.id)).map(stop => [stop.id, stop]));
  const unavailable = new Set(mission.events.flatMap(event =>
    event.category === 'DESTINATION_ACCESSIBILITY_CHANGE' ? [event.targetId] : []));
  for (const event of mission.events) {
    if (event.category !== 'NEW_SCIENTIFIC_DISCOVERY') continue;
    const alreadyConsidered = mission.decisions.some(decision => decision.kind !== 'held' && decision.minute >= event.minute
      && decision.plan.deferred.some(stop => stop.id === event.target.id));
    if (!alreadyConsidered && !mission.completed.includes(event.target.id) && !remaining.has(event.target.id)) {
      remaining.set(event.target.id, event.target);
    }
  }
  return [...mission.priorities, ...remaining.keys()].filter((id, index, all) => all.indexOf(id) === index)
    .flatMap(id => !unavailable.has(id) && remaining.has(id) ? [remaining.get(id)!] : []);
}

export function proposeReturn(mission: MissionExecution, bundle: FieldBundle) {
  return replanMission({bundle, origin: mission.position, stops: [], spent: mission.spent,
    hazards: mission.hazards, speedPenalty: mission.speedFactor});
}

export function recordEvent(mission: MissionExecution, bundle: FieldBundle,
  entry: {details: EventDetails; channel: EventChannel; description: string}): MissionExecution {
  if (mission.status === 'COMPLETED') return mission;
  const {details, channel, description} = entry;
  const error = eventError(details, bundle);
  if (error) throw new Error(error);
  if (details.category === 'DESTINATION_ACCESSIBILITY_CHANGE' && !remainingStops(mission).some(stop => stop.id === details.targetId)) {
    throw new Error('Choose an available upcoming stop.');
  }
  const location = details.category === 'NEW_TERRAIN_HAZARD' ? details.zone.cell
    : details.category === 'NEW_SCIENTIFIC_DISCOVERY' ? targetCell(details.target)! : mission.position;
  const event: MissionEvent = {...details, id: mission.events.length + 1,
    minute: mission.spent.minutes, cell: location, channel, description};
  const nextProgress = { ...(mission.stopProgress ?? initialStopProgress(mission.active)) };
  if (details.category === 'NEW_SCIENTIFIC_DISCOVERY' && !nextProgress[details.target.id]) {
    nextProgress[details.target.id] = {
      stopId: details.target.id,
      stopName: details.target.name,
      cell: location,
      plannedMinutes: details.target.activity.minutes,
      exploredMinutes: 0,
      status: 'pending',
      observations: [],
    };
  }
  const revised: MissionExecution = {...mission, events: [...mission.events, event], stopProgress: nextProgress};
  if (details.category === 'MISSION_DELAY') revised.spent = addResources(revised.spent, scienceResources(details.minutes));
  if (details.category === 'RESOURCE_CHANGE') revised.spent = addResources(revised.spent,
    {minutes: 0, oxygen: details.oxygen, energy: details.energy});
  if (details.category === 'NEW_TERRAIN_HAZARD') revised.hazards = [...revised.hazards, details.zone];
  if (details.category === 'ENVIRONMENTAL_OR_TERRAIN_CHANGE') revised.speedFactor *= details.speedFactor;

  const activeId = revised.activeStopId ?? null;
  if (activeId) {
    const activeProg = nextProgress[activeId];
    const remainingStopMin = activeProg ? Math.max(0, activeProg.plannedMinutes - activeProg.exploredMinutes) : 0;
    if (activeProg) {
      nextProgress[activeId] = { ...activeProg, status: 'interrupted' };
    }
    const downstreamStops = remainingStops(revised).filter(stop => stop.id !== activeId);
    const maxFinishStops = Math.max(0, (revised.stopCapacity ?? stopLimit) - revised.completed.length - 1);
    const maxLeaveStops = Math.max(0, (revised.stopCapacity ?? stopLimit) - revised.completed.length);
    const leaveStopProposal = replanMission({
      bundle,
      origin: revised.position,
      stops: downstreamStops,
      spent: revised.spent,
      hazards: revised.hazards,
      speedPenalty: revised.speedFactor,
      routePreference: revised.active.routePreference,
      maxStops: maxLeaveStops,
    });
    if (remainingStopMin > 0) {
      const finishProposal = replanMission({
        bundle,
        origin: revised.position,
        stops: downstreamStops,
        spent: addResources(revised.spent, scienceResources(remainingStopMin)),
        hazards: revised.hazards,
        speedPenalty: revised.speedFactor,
        routePreference: revised.active.routePreference,
        maxStops: maxFinishStops,
      });
      const finishOk = canApprove(finishProposal);
      const leaveOk = canApprove(leaveStopProposal);
      const preferFinish = finishOk && (!leaveOk || finishProposal.deferred.length <= leaveStopProposal.deferred.length);
      const recommendedProposal: 'finish-stop' | 'leave-stop' = preferFinish ? 'finish-stop' : 'leave-stop';
      const stopName = activeProg?.stopName ?? activeId;
      const proposalReason = preferFinish
        ? `Finishing ${stopName} (+${remainingStopMin.toFixed(0)} min remaining science) still preserves reserves across all three modeled speeds without dropping downstream science.`
        : leaveOk
          ? `Leaving ${stopName} now (${activeProg.exploredMinutes.toFixed(0)} min partial science preserved; saves ${remainingStopMin.toFixed(0)} min) protects return reserves and downstream stops.`
          : `Neither branch preserves full reserves across all modeled speeds; leaving ${stopName} preserves ${activeProg.exploredMinutes.toFixed(0)} min explored so far — review direct abort return.`;
      return {
        ...revised,
        status: 'REVIEW',
        proposal: preferFinish ? finishProposal : leaveStopProposal,
        finishProposal,
        leaveStopProposal,
        recommendedProposal,
        proposalReason,
      };
    }
    return {
      ...revised,
      status: 'REVIEW',
      proposal: leaveStopProposal,
      finishProposal: null,
      leaveStopProposal: null,
      recommendedProposal: null,
      proposalReason: null,
    };
  }

  const proposal = replanMission({bundle, origin: revised.position, stops: remainingStops(revised), spent: revised.spent,
    hazards: revised.hazards, speedPenalty: revised.speedFactor, routePreference: revised.active.routePreference,
    maxStops: Math.max(0, (revised.stopCapacity ?? stopLimit) - revised.completed.length)});
  return {...revised, status: 'REVIEW', proposal, finishProposal: null, leaveStopProposal: null, recommendedProposal: null, proposalReason: null};
}

export function recordPendingReading(mission: MissionExecution, bundle: FieldBundle): MissionExecution {
  const reading = mission.pendingReading;
  if (!reading) return mission;
  const cleared: MissionExecution = { ...mission, pendingReading: null };
  const details: EventDetails = reading.suggestedTarget
    ? { category: 'NEW_SCIENTIFIC_DISCOVERY', target: reading.suggestedTarget }
    : { category: 'MISSION_DELAY', minutes: 5 };
  return recordEvent(cleared, bundle, {
    details,
    channel: reading.channel,
    description: `${reading.title} · ${reading.measurement}`,
  });
}

export function decideReplan(
  mission: MissionExecution,
  plan: MissionPlan,
  decision: Decision['kind'],
  options?: { stopAction?: 'finish-stop' | 'leave-stop' },
): MissionExecution {
  if (mission.status === 'COMPLETED') return mission;
  const validReviewPlan =
    plan === mission.proposal ||
    (mission.finishProposal !== undefined && plan === mission.finishProposal) ||
    (mission.leaveStopProposal !== undefined && plan === mission.leaveStopProposal);
  if (decision !== 'abort' && (mission.status !== 'REVIEW' || !validReviewPlan)) return mission;
  if (decision === 'abort' && (plan.stops.length || plan.legs.at(-1)?.route.status !== 'READY')) return mission;
  if (decision === 'approved' && !canApprove(plan)) return mission;

  const progressMap = { ...(mission.stopProgress ?? initialStopProgress(mission.active)) };
  let nextSpent = mission.spent;
  let nextCompleted = mission.completed;
  let stopAction: Decision['stopAction'];

  if (mission.activeStopId) {
    const activeId = mission.activeStopId;
    const prog = progressMap[activeId];
    const remainingStopMin = prog ? Math.max(0, prog.plannedMinutes - prog.exploredMinutes) : 0;
    if (decision === 'approved') {
      stopAction = options?.stopAction
        ?? (plan === mission.leaveStopProposal ? 'leave-stop' : plan === mission.finishProposal ? 'finish-stop' : mission.recommendedProposal ?? 'leave-stop');
      if (stopAction === 'finish-stop') {
        if (remainingStopMin > 0) nextSpent = addResources(nextSpent, scienceResources(remainingStopMin));
        if (prog) progressMap[activeId] = { ...prog, exploredMinutes: prog.plannedMinutes, status: 'completed' };
        if (!nextCompleted.includes(activeId)) nextCompleted = [...nextCompleted, activeId];
      } else if (prog) {
        progressMap[activeId] = { ...prog, status: 'departed-early' };
      }
    } else if (decision === 'abort' && prog) {
      progressMap[activeId] = { ...prog, status: prog.exploredMinutes > 0 ? 'departed-early' : 'interrupted' };
    }
  }

  const decisions: Decision[] = [
    ...mission.decisions,
    {kind: decision, minute: nextSpent.minutes, plan, ...(stopAction ? { stopAction } : {})},
  ];
  if (decision === 'held') return {...mission, decisions, status: 'HOLD', stopProgress: progressMap};
  return {
    ...mission,
    active: plan,
    proposal: null,
    finishProposal: null,
    leaveStopProposal: null,
    recommendedProposal: null,
    proposalReason: null,
    activeStopId: null,
    spent: nextSpent,
    completed: nextCompleted,
    stopProgress: progressMap,
    decisions,
    status: 'EXECUTING',
    cursor: 0,
    legIndex: 0,
  };
}

export function remainingActivePlan(mission: MissionExecution, bundle: FieldBundle): MissionPlan {
  const active = mission.active;
  let clock = mission.spent.minutes, travel = zeroResources, science = zeroResources;
  const stops = active.stops.filter(stop => !mission.completed.includes(stop.id));
  const legs = active.legs.slice(mission.legIndex).map((leg, index) => {
    const geometryGrid = index === 0 ? leg.route.geometryGrid.slice(mission.cursor) : leg.route.geometryGrid;
    const sampledElevationsMeters = index === 0 ? leg.route.sampledElevationsMeters.slice(mission.cursor) : leg.route.sampledElevationsMeters;
    const terrain = routeMetrics(bundle, geometryGrid);
    const moving = atSpeed(terrain.consumption, active.travelSpeed);
    const alreadyExplored = index === 0 && mission.activeStopId === leg.targetId
      ? (mission.stopProgress?.[leg.targetId]?.exploredMinutes ?? 0)
      : 0;
    const remainingStopMin = Math.max(0, (leg.leave - leg.arrival) - alreadyExplored);
    const activity = scienceResources(remainingStopMin);
    const departure = clock, arrival = departure + moving.minutes;
    clock = arrival + activity.minutes;
    travel = addResources(travel, moving);
    science = addResources(science, activity);
    return {...leg, departure, arrival, leave: clock, terrain, used: addResources(moving, activity),
      route: {...leg.route, geometryGrid, sampledElevationsMeters, nominalTravelMinutes: terrain.consumption.minutes,
        distanceMeters: terrain.distance},
      waypoints: index === 0 && mission.cursor > 0 ? [] : leg.waypoints};
  });
  const available = subtractResources(subtractResources(budget, mission.spent), reserve);
  const margins = SPEED_FACTORS.map(speed => ({
    speed, margin: subtractResources(available, addResources(atSpeed(travel, speed), science)),
  }));
  const count = margins.filter(({margin}) => margin.minutes >= 0 && margin.oxygen >= 0 && margin.energy >= 0).length;
  return {...active, origin: mission.position, legs, stops, margins,
    state: count === 3 ? 'ROBUST' : count > 0 ? 'MARGINAL' : 'INFEASIBLE', used: addResources(travel, science)};
}
