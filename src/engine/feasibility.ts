import { SPEED_FACTORS } from './types';
import type { MissionScenario, RouteSummary, ScienceTarget, TargetAssessment } from './types';

const finiteNonnegative = (v: number) => Number.isFinite(v) && v >= 0;

export function validateScenario(s: MissionScenario): string | null {
  if (!Number.isFinite(s.referenceSpeedMetersPerSecond) || s.referenceSpeedMetersPerSecond <= 0) return 'Reference speed must be positive';
  for (const key of ['timeBudgetMinutes', 'elapsedMinutes', 'reserveMinutes'] as const) {
    if (!finiteNonnegative(s[key])) return `${key} must be finite and nonnegative`;
  }
  if (s.timeBudgetMinutes <= 0) return 'Time budget must be positive';
  return null;
}

function validRoute(route: RouteSummary): boolean {
  return route.status === 'READY' && route.nominalTravelMinutes !== null &&
    finiteNonnegative(route.nominalTravelMinutes) && route.distanceMeters !== null &&
    finiteNonnegative(route.distanceMeters);
}

export function assessTarget(target: ScienceTarget, scenario: MissionScenario,
  outbound: RouteSummary, returnRoute: RouteSummary): TargetAssessment {
  const remainingMinutes = Math.max(0, scenario.timeBudgetMinutes - scenario.elapsedMinutes);
  const hasPoint = target.location.confidence !== 'APPROXIMATE_REGION' &&
    target.location.gridRow !== null && target.location.gridCol !== null;
  const knownBlocked = hasPoint && !validateScenario(scenario) && [outbound, returnRoute].some(r =>
    r.status === 'NO_SUPPORTED_PATH' && r.unknownReason === 'HARD_CONSTRAINT');
  const possible = !validateScenario(scenario) && hasPoint &&
    finiteNonnegative(target.activity.minutes) && validRoute(outbound) && validRoute(returnRoute);
  const scenarios = SPEED_FACTORS.map(factor => {
    if (!possible) return { factor, requiredMinutes: null, marginMinutes: null, feasible: null };
    // Every edge is scaled uniformly: geometry stays fixed; cost scales as 1/factor.
    const travel = (outbound.nominalTravelMinutes! + returnRoute.nominalTravelMinutes!) / factor;
    const requiredMinutes = travel + target.activity.minutes + scenario.reserveMinutes;
    const marginMinutes = remainingMinutes - requiredMinutes;
    return { factor, requiredMinutes, marginMinutes, feasible: marginMinutes >= 0 };
  });
  const nominal = scenarios.find(s => s.factor === 1)!;
  const feasibleCount = scenarios.filter(s => s.feasible === true).length;
  const state = !possible ? (knownBlocked ? 'INFEASIBLE' : 'UNKNOWN') :
    feasibleCount === 3 ? 'ROBUST' : feasibleCount > 0 ? 'MARGINAL' : 'INFEASIBLE';
  const reasonCode = !possible ? (knownBlocked ? 'HARD_CONSTRAINT' : 'MISSING_DATA') :
    feasibleCount === 3 ? 'FEASIBLE_ALL' : feasibleCount > 0 ? 'SPEED_SENSITIVE' : 'TIME_EXCEEDED';
  return {
    targetId: target.id, state, outbound, returnRoute,
    scienceMinutes: target.activity.minutes, reserveMinutes: scenario.reserveMinutes,
    remainingMinutes, nominalMarginMinutes: nominal.marginMinutes, scenarios, reasonCode,
  };
}

export function returnableAtNominalSpeed(outboundMinutes: number, returnMinutes: number,
  scenario: MissionScenario): boolean | null {
  if (validateScenario(scenario) || !finiteNonnegative(outboundMinutes) || !finiteNonnegative(returnMinutes)) return null;
  // Movement-only frontier. Science time is target-specific and excluded here.
  return outboundMinutes + returnMinutes + scenario.reserveMinutes <=
    Math.max(0, scenario.timeBudgetMinutes - scenario.elapsedMinutes);
}
