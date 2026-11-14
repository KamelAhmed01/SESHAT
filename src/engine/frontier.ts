import scenario from '../config/mission-scenario.json';
import type { FieldBundle } from '../data/loader';
import { budget, hasReserve, reserve, scienceResources, subtractResources } from './consumables';
import type { Resources } from './consumables';
import { cellIndex, createTraverseGraph } from './traverse-graph';
import type { Cell, GraphPreference, HazardZone } from './traverse-graph';

/** Movement-only opportunity frontier; target activity time is excluded by design. */
export function frontierMembership(outbound: Float64Array, returns: Float64Array, mask: Uint8Array,
  elapsed: number, budget: number, reserve: number): Uint8Array {
  if (outbound.length !== returns.length || mask.length !== outbound.length ||
      ![elapsed, budget, reserve].every(x => Number.isFinite(x) && x >= 0) || budget <= 0)
    throw new Error('Invalid frontier input');
  const threshold = Math.max(0, budget - elapsed) - reserve;
  const membership = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const cost = outbound[i] + returns[i];
    membership[i] = mask[i] === 1 && Number.isFinite(cost) && cost <= threshold ? 1 : 0;
  }
  return membership;
}

export function countFrontier(membership: Uint8Array): number {
  return membership.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0);
}

export interface LiveFrontierOptions {
  origin: Cell;
  spent: Resources;
  hazards?: readonly HazardZone[];
  speedFactor?: number;
  scienceMinutes?: number;
  preference?: GraphPreference;
}

export interface FrontierSummary {
  fullScienceCells: number;
  transitOnlyCells: number;
  totalReachableCells: number;
  fullScienceKm2: number;
  totalReachableKm2: number;
}

/**
 * Two-tier conservative (0.8x) multi-resource reachability frontier from a live cell back to base:
 * - 2: Reachable for full science stop (default 20 min) + return while preserving all reserves
 * - 1: Transit-only horizon (safe return at 0.8x with reserves, insufficient margin for full stop)
 * - 0: Beyond 0.8x safe-return horizon, hazard-excluded, or NoData
 */
export function liveFrontierMembership(bundle: FieldBundle, options: LiveFrontierOptions): Uint8Array {
  const {
    origin,
    spent,
    hazards = [],
    speedFactor = 1,
    scienceMinutes = scenario.defaultScienceMinutes,
    preference = 'fastest',
  } = options;
  const len = bundle.mask.length;
  const membership = new Uint8Array(len);
  const originIdx = cellIndex(origin, bundle);
  if (originIdx < 0 || !Number.isFinite(speedFactor) || speedFactor <= 0) return membership;

  const graph = createTraverseGraph(bundle, hazards, originIdx, preference);
  const outbound = graph.searchField(originIdx, false);
  const inbound = graph.searchField(bundle.manifest.baseIndex, true);
  const available = subtractResources(subtractResources(budget, spent), reserve);
  const science = scienceResources(Math.max(0, scienceMinutes));
  const conservativeScale = 0.8 * speedFactor;

  for (let i = 0; i < len; i++) {
    if (graph.mask[i] !== 1) continue;
    const travelMin = outbound.minutes[i] + inbound.minutes[i];
    const travelO2 = outbound.oxygen[i] + inbound.oxygen[i];
    const travelWh = outbound.energy[i] + inbound.energy[i];
    if (!Number.isFinite(travelMin) || !Number.isFinite(travelO2) || !Number.isFinite(travelWh)) continue;

    const transitRemainingMin = available.minutes - travelMin / conservativeScale;
    const transitRemainingO2 = available.oxygen - travelO2 / conservativeScale;
    const transitRemainingWh = available.energy - travelWh / conservativeScale;
    if (transitRemainingMin < 0 || transitRemainingO2 < 0 || transitRemainingWh < 0) continue;

    const scienceOk = hasReserve({
      minutes: transitRemainingMin - science.minutes,
      oxygen: transitRemainingO2 - science.oxygen,
      energy: transitRemainingWh - science.energy,
    });
    membership[i] = scienceOk ? 2 : 1;
  }
  return membership;
}

export function summarizeFrontier(
  membership: Uint8Array,
  cellWidthMeters: number,
  cellHeightMeters: number,
): FrontierSummary {
  let fullScienceCells = 0;
  let transitOnlyCells = 0;
  for (let i = 0; i < membership.length; i++) {
    if (membership[i] === 2) fullScienceCells++;
    else if (membership[i] === 1) transitOnlyCells++;
  }
  const totalReachableCells = fullScienceCells + transitOnlyCells;
  const cellKm2 = (cellWidthMeters * cellHeightMeters) / 1_000_000;
  return {
    fullScienceCells,
    transitOnlyCells,
    totalReachableCells,
    fullScienceKm2: fullScienceCells * cellKm2,
    totalReachableKm2: totalReachableCells * cellKm2,
  };
}
