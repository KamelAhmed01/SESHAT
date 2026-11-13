import type { FieldBundle } from '../data/loader';
import { indexToGrid } from '../cartography/coordinates';
import { addResources, atSpeed, budget, hasReserve, reserve, scienceResources, subtractResources, zeroResources } from './consumables';
import type { Resources } from './consumables';
import { cellIndex, createTraverseGraph, routeMetrics } from './traverse-graph';
import type { Cell, HazardZone } from './traverse-graph';
import { SPEED_FACTORS } from './types';
import type { FeasibilityState, RouteSummary, ScienceTarget, SpeedFactor } from './types';

export const landingId = 'LANDING_SITE';
export const landingName = 'Landing Site';
export const stopLimit = 4;
export type RoutePreference = 'fastest' | 'lowerSlope';

export interface MissionLeg {
  from: string;
  to: string;
  targetId: string;
  route: RouteSummary;
  terrain: ReturnType<typeof routeMetrics>;
  departure: number;
  arrival: number;
  leave: number;
  used: Resources;
  waypoints: { cell: Cell; slope: number; returnMinutes: number }[];
}

export interface MissionPlan {
  origin: Cell;
  stops: ScienceTarget[];
  legs: MissionLeg[];
  state: FeasibilityState;
  used: Resources | null;
  margins: { speed: SpeedFactor; margin: Resources | null }[];
  routePreference: RoutePreference;
  travelSpeed: number;
  deferred: ScienceTarget[];
}

export interface PlannerInput {
  bundle: FieldBundle;
  origin: Cell;
  stops: readonly ScienceTarget[];
  spent: Resources;
  speedPenalty?: number;
  hazards?: readonly HazardZone[];
  routePreference?: RoutePreference;
  maxStops?: number;
}

export function targetCell(target: ScienceTarget): Cell | null {
  const {gridRow, gridCol, confidence} = target.location;
  return gridRow === null || gridCol === null || confidence === 'APPROXIMATE_REGION' ? null : [gridRow, gridCol];
}

export function landingCell(bundle: FieldBundle): Cell {
  return indexToGrid(bundle.manifest.baseIndex, bundle.manifest.width);
}

function permutations(stops: readonly ScienceTarget[]): ScienceTarget[][] {
  if (stops.length < 2) return [[...stops]];
  return stops.flatMap((stop, i) => permutations(stops.filter((_, j) => i !== j)).map(rest => [stop, ...rest]));
}

function* preferredSubsets(stops: readonly ScienceTarget[], maxStops = stopLimit): Generator<ScienceTarget[]> {
  if (!stops.length || maxStops === 0) {
    yield [];
    return;
  }
  const [first, ...remaining] = stops;
  for (const subset of preferredSubsets(remaining, maxStops - 1)) yield [first, ...subset];
  yield* preferredSubsets(remaining, maxStops);
}

function summarize(margins: MissionPlan['margins'], legs: MissionLeg[]): FeasibilityState {
  if (legs.some(leg => leg.route.status === 'NO_SUPPORTED_PATH')) return 'INFEASIBLE';
  if (margins[0].margin === null) return 'UNKNOWN';
  const count = margins.filter(({margin}) => margin && hasReserve(margin)).length;
  return count === 3 ? 'ROBUST' : count ? 'MARGINAL' : 'INFEASIBLE';
}

export function canApprove(plan: MissionPlan): boolean {
  return plan.margins.length === SPEED_FACTORS.length && plan.margins.every(({margin}) => margin !== null && hasReserve(margin));
}

function createEvaluator(input: PlannerInput) {
  const { bundle, origin, spent, speedPenalty = 1, routePreference = 'fastest', hazards = [] } = input;
  const originIndex = cellIndex(origin, bundle);
  const graph = createTraverseGraph(bundle, hazards, originIndex, routePreference === 'lowerSlope');
  const available = subtractResources(subtractResources(budget, spent), reserve);
  const routes = new Map<string, { route: RouteSummary; terrain: ReturnType<typeof routeMetrics> }>();

  function segment(from: number, to: number) {
    const key = `${from}/${to}`;
    let cached = routes.get(key);
    if (!cached) {
      const route = graph.route(from, to);
      cached = {route, terrain: routeMetrics(bundle, route.geometryGrid)};
      routes.set(key, cached);
    }
    return cached;
  }

  function itinerary(stops: ScienceTarget[]): MissionPlan {
    let current = originIndex, label = current === bundle.manifest.baseIndex ? landingName : 'Astronaut position';
    let travel = zeroResources, science = zeroResources, clock: number | null = spent.minutes;
    const legs = [...stops.map(stop => ({id: stop.id, name: stop.name, cell: targetCell(stop), duration: stop.activity.minutes})),
      {id: landingId, name: landingName, cell: landingCell(bundle), duration: 0}].map(destination => {
      const index = destination.cell ? cellIndex(destination.cell, bundle) : -1;
      const {route, terrain} = segment(current, index);
      const activity = scienceResources(destination.duration), moving = atSpeed(terrain.consumption, speedPenalty);
      const departure: number = clock ?? NaN;
      const arrival = route.status === 'READY' ? departure + moving.minutes : NaN;
      const leave = arrival + destination.duration;
      const leg: MissionLeg = {from: label, to: destination.name, targetId: destination.id, route, terrain,
        departure, arrival, leave, used: addResources(moving, activity), waypoints: []};
      current = index;
      label = destination.name;
      clock = Number.isFinite(leave) ? leave : null;
      travel = addResources(travel, moving);
      science = addResources(science, activity);
      return leg;
    });
    const ready = legs.every(leg => leg.route.status === 'READY');
    const margins = SPEED_FACTORS.map(speed => ({
      speed, margin: ready ? subtractResources(available, addResources(atSpeed(travel, speed), science)) : null,
    }));
    return {origin, stops, legs, state: summarize(margins, legs), used: ready ? addResources(travel, science) : null,
      margins, routePreference, travelSpeed: speedPenalty, deferred: input.stops.filter(stop => !stops.some(visit => visit.id === stop.id))};
  }

  function waypoint(leg: MissionLeg, elapsed: Resources) {
    const cells = leg.route.geometryGrid;
    const local = cells.map((cell, i) => ({cell, i, slope: graph.localSlope(cell)}))
      .filter(candidate => candidate.i > 0 && candidate.i < cells.length - 1 && candidate.slope !== null && candidate.slope < 4)
      .sort((a, b) => Math.abs(a.i - cells.length / 2) - Math.abs(b.i - cells.length / 2));
    for (const {cell, i, slope} of local) {
      const returnRoute = segment(cellIndex(cell, bundle), bundle.manifest.baseIndex);
      if (returnRoute.route.status !== 'READY' || slope === null) continue;
      const speed = 0.8 * speedPenalty;
      const prefix = atSpeed(routeMetrics(bundle, cells.slice(0, i + 1)).consumption, speed);
      const back = atSpeed(returnRoute.terrain.consumption, speed);
      const margin = subtractResources(available, addResources(elapsed, addResources(prefix, back)));
      if (hasReserve(margin)) return [{cell, slope, returnMinutes: back.minutes}];
    }
    return [];
  }

  function withWaypoints(plan: MissionPlan): MissionPlan {
    if (!plan.used) return plan;
    let elapsed = zeroResources;
    const legs = plan.legs.map((leg, index) => {
      const waypoints = waypoint(leg, elapsed);
      elapsed = addResources(elapsed, addResources(atSpeed(leg.terrain.consumption, 0.8 * speedPenalty),
        scienceResources(plan.stops[index]?.activity.minutes ?? 0)));
      return {...leg, waypoints};
    });
    return {...plan, legs};
  }

  return { itinerary, withWaypoints };
}

function rank(plan: MissionPlan) {
  return plan.state === 'ROBUST' ? 0 : plan.margins[1].margin && hasReserve(plan.margins[1].margin) ? 1 : plan.state === 'MARGINAL' ? 2 : plan.used ? 3 : 4;
}

function bestOrder(stops: readonly ScienceTarget[], evaluate: ReturnType<typeof createEvaluator>) {
  return permutations(stops).map(evaluate.itinerary).sort((a, b) =>
    rank(a) - rank(b) || (a.used?.minutes ?? Infinity) - (b.used?.minutes ?? Infinity))[0];
}

function abbreviated(stops: ScienceTarget[]) {
  return stops.map(stop => {
    const original = stop.activity.minutes;
    return {...stop, activity: {...stop.activity, minutes: Math.min(original, Math.max(10, Math.floor(original * 0.7)))}};
  });
}

export function previewMission(input: PlannerInput) {
  const evaluate = createEvaluator(input);
  const stops = input.stops.slice(0, stopLimit);
  const priority = evaluate.itinerary(stops);
  const optimized = bestOrder(stops, evaluate);
  let subset: MissionPlan | undefined;
  if (!canApprove(optimized) && stops.length > 1) {
    for (const order of preferredSubsets(stops)) {
      if (order.length === stops.length || !order.length) continue;
      const candidate = bestOrder(order, evaluate);
      if (canApprove(candidate)) {
        subset = candidate;
        break;
      }
    }
  }
  return { priority, optimized: evaluate.withWaypoints(optimized), subset: subset && evaluate.withWaypoints(subset) };
}

export function replanMission(input: PlannerInput) {
  const evaluate = createEvaluator(input);
  for (const subset of preferredSubsets(input.stops, input.maxStops)) {
    const plan = bestOrder(subset, evaluate);
    if (canApprove(plan)) return evaluate.withWaypoints(plan);
    const shortened = bestOrder(abbreviated(subset), evaluate);
    if (canApprove(shortened)) return evaluate.withWaypoints(shortened);
    if (!subset.length) return evaluate.withWaypoints(plan);
  }
  return evaluate.withWaypoints(evaluate.itinerary([]));
}
