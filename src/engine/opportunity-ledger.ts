/**
 * Cross-target opportunity ledger: the same route and feasibility engine as the
 * selected-target view. The ledger never ranks scientific value without evidence.
 * UNKNOWN is epistemic, not a negative feasibility result; it cannot count as
 * an opportunity "lost" or "gained" when the clock advances.
 */
import type { FieldBundle } from '../data/loader';
import type { FeasibilityState, MissionScenario, ScienceTarget, TargetAssessment } from './types';
import { assessTarget } from './feasibility';
import { routeSummary } from './route-summary';
import { cellIndex, createTraverseGraph } from './traverse-graph';
import type { Cell, HazardZone } from './traverse-graph';

export type OpportunityChange = 'UNCHANGED' | 'DOWNGRADED' | 'LOST' | 'UNCERTAIN';

export interface OpportunityEntry {
  target: ScienceTarget;
  initial: TargetAssessment;
  current: TargetAssessment;
  change: OpportunityChange;
  /** Difference since scenario start; null when time/evidence is unknown. */
  nominalMarginLostMinutes: number | null;
}

export interface OpportunityLedger {
  entries: OpportunityEntry[];
  counts: Record<FeasibilityState, number>;
  lost: number;
  downgraded: number;
  uncertain: number;
  initiallyFeasible: number;
  currentFeasible: number;
  elapsedMinutes: number;
}

const available = (state: FeasibilityState) => state === 'ROBUST' || state === 'MARGINAL';

export function classifyChange(before: FeasibilityState, after: FeasibilityState): OpportunityChange {
  if (before === 'UNKNOWN' || after === 'UNKNOWN') return 'UNCERTAIN';
  if (available(before) && after === 'INFEASIBLE') return 'LOST';
  if (before === 'ROBUST' && after === 'MARGINAL') return 'DOWNGRADED';
  return 'UNCHANGED';
}

function targetAtTime(bundle: FieldBundle, target: ScienceTarget, scenario: MissionScenario): TargetAssessment {
  const loc = target.location;
  const index = loc.gridRow !== null && loc.gridCol !== null &&
    Number.isInteger(loc.gridRow) && Number.isInteger(loc.gridCol) &&
    loc.gridRow >= 0 && loc.gridRow < bundle.manifest.height &&
    loc.gridCol >= 0 && loc.gridCol < bundle.manifest.width ?
    loc.gridRow * bundle.manifest.width + loc.gridCol : -1;
  const outbound = routeSummary(bundle, index, 'outbound');
  const inbound = routeSummary(bundle, index, 'return');
  return assessTarget(target, scenario, outbound, inbound);
}

export function buildOpportunityLedger(bundle: FieldBundle, scenario: MissionScenario,
  targets: readonly ScienceTarget[] = bundle.manifest.scienceTargets ?? []): OpportunityLedger {
  const beginning = { ...scenario, elapsedMinutes: 0 };
  const counts: OpportunityLedger['counts'] = { ROBUST: 0, MARGINAL: 0, INFEASIBLE: 0, UNKNOWN: 0 };
  const entries = targets.map(target => {
    const initial = targetAtTime(bundle, target, beginning);
    const current = scenario.elapsedMinutes === 0 ? initial : targetAtTime(bundle, target, scenario);
    counts[current.state]++;
    const change = classifyChange(initial.state, current.state);
    const nominalMarginLostMinutes = initial.nominalMarginMinutes === null || current.nominalMarginMinutes === null ?
      null : initial.nominalMarginMinutes - current.nominalMarginMinutes;
    return { target, initial, current, change, nominalMarginLostMinutes };
  });
  return {
    entries, counts,
    lost: entries.filter(e => e.change === 'LOST').length,
    downgraded: entries.filter(e => e.change === 'DOWNGRADED').length,
    uncertain: entries.filter(e => e.change === 'UNCERTAIN').length,
    initiallyFeasible: entries.filter(e => available(e.initial.state)).length,
    currentFeasible: entries.filter(e => available(e.current.state)).length,
    elapsedMinutes: scenario.elapsedMinutes,
  };
}

/** Concise, evidence-respecting explanation used by UI, exports and tests. */
export function opportunityExplanation(entry: OpportunityEntry): string {
  const { initial, current } = entry;
  if (entry.change === 'UNCERTAIN')
    return 'Route or location evidence is incomplete; no availability conclusion is supported.';
  if (entry.change === 'LOST')
    return `No tested speed fits the remaining window; initially ${initial.state.toLowerCase()}.`;
  if (entry.change === 'DOWNGRADED')
    return 'A slower speed scenario no longer fits the remaining window.';
  if (initial.state === 'INFEASIBLE')
    return current.reasonCode === 'HARD_CONSTRAINT' ? 'Terrain constraints block a supported route.' :
      'No tested speed fits the window, even at its start.';
  if (current.state === 'ROBUST') return 'All three modeled speeds retain a return margin.';
  return 'Only some modeled speeds fit the return budget.';
}

/** Evaluate target feasibility from any live cell back to the landing site. */
export function evaluatePositionOpportunities(
  bundle: FieldBundle,
  fromCell: Cell,
  scenario: MissionScenario,
  targets: readonly ScienceTarget[] = bundle.manifest.scienceTargets ?? [],
  hazards: readonly HazardZone[] = [],
): Record<string, TargetAssessment> {
  const fromIdx = cellIndex(fromCell, bundle);
  const graph = createTraverseGraph(bundle, hazards, fromIdx);
  const results: Record<string, TargetAssessment> = {};
  for (const target of targets) {
    const loc = target.location;
    const targetIdx = loc.gridRow !== null && loc.gridCol !== null
      && Number.isInteger(loc.gridRow) && Number.isInteger(loc.gridCol)
      ? cellIndex([loc.gridRow, loc.gridCol], bundle)
      : -1;
    const outbound = fromIdx >= 0 && targetIdx >= 0
      ? graph.route(fromIdx, targetIdx)
      : routeSummary(bundle, targetIdx, 'outbound');
    const inbound = targetIdx >= 0
      ? graph.route(targetIdx, bundle.manifest.baseIndex)
      : routeSummary(bundle, targetIdx, 'return');
    results[target.id] = assessTarget(target, scenario, outbound, inbound);
  }
  return results;
}
