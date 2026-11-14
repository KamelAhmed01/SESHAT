import type { FieldBundle } from '../data/loader';
import { indexToGrid } from '../cartography/coordinates';
import { addResources, atSpeed, budget, hasReserve, reserve, scienceResources, subtractResources, zeroResources } from './consumables';
import type { Resources } from './consumables';
import { cellIndex, createTraverseGraph, routeMetrics, routeNeighborhood } from './traverse-graph';
import type { Cell, GraphPreference, HazardZone } from './traverse-graph';
import { SPEED_FACTORS } from './types';
import type { FeasibilityState, RouteSummary, ScienceTarget, SpeedFactor } from './types';

export const landingId = 'LANDING_SITE';
export const landingName = 'Landing Site';
export const stopLimit = 4;
export type RoutePreference = GraphPreference;

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
  const graph = createTraverseGraph(bundle, hazards, originIndex, routePreference);
  const available = subtractResources(subtractResources(budget, spent), reserve);
  const routes = new Map<string, { route: RouteSummary; terrain: ReturnType<typeof routeMetrics> }>();

  function segment(fromCell: Cell, toCell: Cell) {
    const fromIdx = cellIndex(fromCell, bundle);
    const toIdx = cellIndex(toCell, bundle);
    const key = `${fromCell[0]},${fromCell[1]}/${toCell[0]},${toCell[1]}`;
    let cached = routes.get(key);
    if (!cached) {
      let route: RouteSummary;
      if (fromIdx !== -1 && toIdx !== -1) {
        route = graph.route(fromIdx, toIdx);
      } else {
        route = routeNeighborhood(bundle, fromCell, toCell, hazards, routePreference === 'lowerSlope');
      }
      cached = { route, terrain: routeMetrics(bundle, route.geometryGrid) };
      routes.set(key, cached);
    }
    return cached;
  }

  function itinerary(stops: ScienceTarget[]): MissionPlan {
    let currentCell = origin;
    let label = (currentCell[0] === origin[0] && currentCell[1] === origin[1]) ? landingName : 'Astronaut position';
    let travel = zeroResources, science = zeroResources, clock: number | null = spent.minutes;
    const legs = [...stops.map(stop => ({id: stop.id, name: stop.name, cell: targetCell(stop), duration: stop.activity.minutes})),
      {id: landingId, name: landingName, cell: landingCell(bundle), duration: 0}].map(destination => {
      const targetPt = destination.cell ?? currentCell;
      const {route, terrain} = segment(currentCell, targetPt);
      const activity = scienceResources(destination.duration), moving = atSpeed(terrain.consumption, speedPenalty);
      const departure: number = clock ?? NaN;
      const arrival = route.status === 'READY' ? departure + moving.minutes : NaN;
      const leave = arrival + destination.duration;
      const leg: MissionLeg = {from: label, to: destination.name, targetId: destination.id, route, terrain,
        departure, arrival, leave, used: addResources(moving, activity), waypoints: []};
      currentCell = targetPt;
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
      const idx = cellIndex(cell, bundle);
      if (idx === -1) continue;
      const returnRoute = segment(cell, landingCell(bundle));
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

export interface TriageBranch {
  id: 'optimal' | 'rapid-salvage' | 'low-slope' | 'firm-ground';
  label: string;
  summary: string;
  plan: MissionPlan;
  approvable: boolean;
}

function planSignature(plan: MissionPlan): string {
  const stopsSig = plan.stops.map(s => `${s.id}:${s.activity.minutes}`).join('|');
  const routeSig = plan.legs
    .map(l => `${l.terrain.distance.toFixed(0)},${l.terrain.peakSlope.toFixed(1)},${l.route.geometryGrid.length}`)
    .join(';');
  return `${stopsSig}::${routeSig}`;
}

/**
 * Generates up to four distinct tactical replanning branches for mid-traverse crew triage:
 * priority optimal subset, rapid-pass activity salvage, gentler-slope detour, and firm-ground TI routing.
 */
export function triageReplanBranches(input: PlannerInput): TriageBranch[] {
  const optimal = replanMission(input);
  const seen = new Set<string>([planSignature(optimal)]);
  const branches: TriageBranch[] = [
    {
      id: 'optimal',
      label: 'Priority plan',
      summary: optimal.deferred.length > 0
        ? `Retains ${optimal.stops.length} highest-priority stop(s); defers ${optimal.deferred.map(s => s.name.split(' · ')[0]).join(', ')}.`
        : 'Preserves all remaining stops under your active route preference.',
      plan: optimal,
      approvable: canApprove(optimal),
    },
  ];

  if (input.stops.length > 0) {
    const rapidStops = input.stops.map(stop => ({
      ...stop,
      activity: {
        ...stop.activity,
        minutes: Math.min(stop.activity.minutes, Math.max(8, Math.floor(stop.activity.minutes * 0.6))),
      },
    }));
    const rapid = replanMission({ ...input, stops: rapidStops });
    const rapidSig = planSignature(rapid);
    const improvesCoverageOrSafety =
      rapid.stops.length > optimal.stops.length ||
      (canApprove(rapid) && !canApprove(optimal)) ||
      (canApprove(rapid) && (rapid.margins[0]?.margin?.minutes ?? -Infinity) > (optimal.margins[0]?.margin?.minutes ?? -Infinity) + 3);
    if (!seen.has(rapidSig) && improvesCoverageOrSafety) {
      seen.add(rapidSig);
      branches.push({
        id: 'rapid-salvage',
        label: 'Rapid-pass science salvage',
        summary: rapid.stops.length > optimal.stops.length
          ? `Compresses science stops (~60% duration) to rescue ${rapid.stops.length - optimal.stops.length} deferred target(s).`
          : 'Compresses remaining science duration to recover conservative 0.8× safety margin.',
        plan: rapid,
        approvable: canApprove(rapid),
      });
    }
  }

  if (input.routePreference !== 'lowerSlope') {
    const lowSlope = replanMission({ ...input, routePreference: 'lowerSlope' });
    const lowSig = planSignature(lowSlope);
    if (!seen.has(lowSig) && (canApprove(lowSlope) || !canApprove(optimal))) {
      seen.add(lowSig);
      branches.push({
        id: 'low-slope',
        label: 'Gentler-slope detour',
        summary: 'Trades a slight travel extension for lower peak grades and reduced uphill O₂ / Wh exertion.',
        plan: lowSlope,
        approvable: canApprove(lowSlope),
      });
    }
  }

  if (input.bundle.contextData?.thermalInertia && input.routePreference !== 'firmGround') {
    const firmGround = replanMission({ ...input, routePreference: 'firmGround' });
    const firmSig = planSignature(firmGround);
    if (!seen.has(firmSig) && (canApprove(firmGround) || !canApprove(optimal))) {
      seen.add(firmSig);
      branches.push({
        id: 'firm-ground',
        label: 'Consolidated footing (thermal inertia)',
        summary: 'Routes along higher thermal inertia bedrock to reduce loose dust/sand sinkage exposure.',
        plan: firmGround,
        approvable: canApprove(firmGround),
      });
    }
  }

  return branches;
}
