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
type Decision = { kind: 'approved' | 'held' | 'abort'; minute: number; plan: MissionPlan };
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
}

export function startMission(plan: MissionPlan, priorities: readonly ScienceTarget[], stopCapacity = stopLimit): MissionExecution {
  if (!plan.stops.length || !canApprove(plan)) throw new Error('Approve a plan that meets every return reserve at all three speeds.');
  return {baseline: plan, active: plan, proposal: null, status: 'EXECUTING', position: plan.origin, spent: zeroResources,
    cursor: 0, legIndex: 0, completed: [], travels: [], priorities: priorities.map(stop => stop.id), stopCapacity, events: [], decisions: [],
    hazards: [], speedFactor: plan.travelSpeed};
}

export function advanceMission(mission: MissionExecution, bundle: FieldBundle, progress: 'part' | 'finish'): MissionExecution {
  if (mission.status !== 'EXECUTING') return mission;
  const leg = mission.active.legs[mission.legIndex];
  if (!leg || leg.route.status !== 'READY') return mission;
  const path = leg.route.geometryGrid, last = path.length - 1;
  const next = progress === 'finish' ? last : Math.min(last, mission.cursor + Math.max(1, Math.floor((last - mission.cursor) / 2)));
  if (next === mission.cursor && progress === 'part') return mission;
  const cells = path.slice(mission.cursor, next + 1);
  const travel = atSpeed(routeMetrics(bundle, cells).consumption, mission.speedFactor);
  const used = progress === 'finish' ? addResources(travel, scienceResources(leg.leave - leg.arrival)) : travel;
  const isReturn = leg.targetId === landingId && progress === 'finish';
  return {
    ...mission, position: path[next], cursor: progress === 'finish' ? 0 : next,
    legIndex: mission.legIndex + Number(progress === 'finish'),
    spent: addResources(mission.spent, used), status: isReturn ? 'COMPLETED' : 'EXECUTING',
    travels: [...mission.travels, {targetId: leg.targetId, cells, used}],
    completed: progress === 'finish' && !isReturn ? [...mission.completed, leg.targetId] : mission.completed,
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
  const revised = {...mission, events: [...mission.events, event]};
  if (details.category === 'MISSION_DELAY') revised.spent = addResources(revised.spent, scienceResources(details.minutes));
  if (details.category === 'RESOURCE_CHANGE') revised.spent = addResources(revised.spent,
    {minutes: 0, oxygen: details.oxygen, energy: details.energy});
  if (details.category === 'NEW_TERRAIN_HAZARD') revised.hazards = [...revised.hazards, details.zone];
  if (details.category === 'ENVIRONMENTAL_OR_TERRAIN_CHANGE') revised.speedFactor *= details.speedFactor;
  const proposal = replanMission({bundle, origin: revised.position, stops: remainingStops(revised), spent: revised.spent,
    hazards: revised.hazards, speedPenalty: revised.speedFactor, routePreference: revised.active.routePreference,
    maxStops: Math.max(0, (revised.stopCapacity ?? stopLimit) - revised.completed.length)});
  return {...revised, status: 'REVIEW', proposal};
}

export function decideReplan(mission: MissionExecution, plan: MissionPlan, decision: Decision['kind']): MissionExecution {
  if (mission.status === 'COMPLETED') return mission;
  if (decision !== 'abort' && (mission.status !== 'REVIEW' || plan !== mission.proposal)) return mission;
  if (decision === 'abort' && (plan.stops.length || plan.legs.at(-1)?.route.status !== 'READY')) return mission;
  if (decision === 'approved' && !canApprove(plan)) return mission;
  const decisions = [...mission.decisions, {kind: decision, minute: mission.spent.minutes, plan}];
  if (decision === 'held') return {...mission, decisions, status: 'HOLD'};
  return {...mission, active: plan, proposal: null, decisions, status: 'EXECUTING', cursor: 0, legIndex: 0};
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
    const activity = scienceResources(leg.leave - leg.arrival);
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
