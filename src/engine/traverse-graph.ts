import type { FieldBundle } from '../data/loader';
import { indexToGrid } from '../cartography/coordinates';
import scenario from '../config/mission-scenario.json';
import { addResources, travelResources, zeroResources } from './consumables';
import type { Resources } from './consumables';
import type { RouteSummary } from './types';

export type Cell = [number, number];
export interface HazardZone { cell: Cell; radius: number }
export type GraphPreference = 'fastest' | 'lowerSlope' | 'firmGround';
export const THERMAL_INERTIA_CONSOLIDATED_TIU = 220;
export const THERMAL_INERTIA_LOOSE_TIU = 200;
type SearchEntry = { cell: number; cost: number };
export type Field = {
  cost: Float64Array;
  link: Int32Array;
  minutes: Float64Array;
  oxygen: Float64Array;
  energy: Float64Array;
};
const orthogonal = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const maxGrade = Math.tan(scenario.maxSlopeDegrees * Math.PI / 180);

class SearchQueue {
  private entries: SearchEntry[] = [];

  push(entry: SearchEntry) {
    const heap = this.entries;
    let child = heap.length;
    heap.push(entry);
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (heap[parent].cost <= entry.cost) break;
      heap[child] = heap[parent];
      child = parent;
    }
    heap[child] = entry;
  }

  pop(): SearchEntry | undefined {
    const heap = this.entries;
    const first = heap[0], last = heap.pop();
    if (!last || !heap.length) return first;
    let parent = 0;
    while (parent * 2 + 1 < heap.length) {
      let child = parent * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
      if (heap[child].cost >= last.cost) break;
      heap[parent] = heap[child];
      parent = child;
    }
    heap[parent] = last;
    return first;
  }
}

export function cellIndex(cell: Cell, bundle: FieldBundle): number {
  const [row, col] = cell, { width, height } = bundle.manifest;
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < height && col < width
    ? row * width + col : -1;
}

function effectiveMask(bundle: FieldBundle, hazards: readonly HazardZone[]) {
  const mask = bundle.mask.slice(), { width, height } = bundle.manifest;
  for (const {cell: [row, col], radius} of hazards) {
    for (let r = Math.max(0, row - radius); r <= Math.min(height - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(width - 1, col + radius); c++) {
        if (Math.hypot(r - row, c - col) <= radius && mask[r * width + c] === 1) mask[r * width + c] = 2;
      }
    }
  }
  return mask;
}

export function stepMetrics(bundle: FieldBundle, from: number, to: number) {
  const { width, cellWidthMeters, cellHeightMeters } = bundle.manifest;
  const distance = Math.hypot((Math.floor(to / width) - Math.floor(from / width)) * cellHeightMeters,
    (to % width - from % width) * cellWidthMeters);
  const rise = bundle.elevationMeters[to] - bundle.elevationMeters[from];
  const grade = rise / distance;
  const minutes = distance * (1 + scenario.uphillCoefficient * Math.max(grade, 0) +
    scenario.downhillCoefficient * Math.max(-grade, 0)) / scenario.referenceSpeedMetersPerSecond / 60;
  return { distance, rise, grade, minutes };
}

export function footingCategory(meanThermalInertia: number | null, looseFraction: number | null): string | null {
  if (meanThermalInertia === null) return null;
  if (meanThermalInertia >= THERMAL_INERTIA_CONSOLIDATED_TIU && (looseFraction ?? 0) < 0.25) {
    return 'Consolidated bedrock / duricrust';
  }
  if ((looseFraction ?? 0) >= 0.45 || meanThermalInertia < THERMAL_INERTIA_LOOSE_TIU) {
    return 'Loose sand / dust sinkage exposure';
  }
  return 'Mixed regolith & bedrock';
}

export function routeMetrics(bundle: FieldBundle, cells: readonly Cell[]) {
  let consumption: Resources = zeroResources;
  let distance = 0, gain = 0, loss = 0, peakSlope = 0, weightedSlope = 0, steepEdges = 0;
  const tiGrid = bundle.contextData?.thermalInertia;
  let tiSum = 0, tiCount = 0, lowTiCount = 0;
  if (tiGrid) {
    for (const cell of cells) {
      const idx = cellIndex(cell, bundle);
      if (idx >= 0 && Number.isFinite(tiGrid[idx])) {
        const ti = tiGrid[idx];
        tiSum += ti;
        tiCount++;
        if (ti < THERMAL_INERTIA_LOOSE_TIU) lowTiCount++;
      }
    }
  }
  for (let i = 1; i < cells.length; i++) {
    const step = stepMetrics(bundle, cellIndex(cells[i - 1], bundle), cellIndex(cells[i], bundle));
    const slope = Math.atan(Math.abs(step.grade)) * 180 / Math.PI;
    consumption = addResources(consumption, travelResources(step.minutes, step.grade));
    distance += step.distance;
    gain += Math.max(step.rise, 0);
    loss += Math.max(-step.rise, 0);
    peakSlope = Math.max(peakSlope, slope);
    weightedSlope += slope * step.distance;
    if (slope > 15) steepEdges++;
  }
  const meanThermalInertia = tiCount > 0 ? tiSum / tiCount : null;
  const lowThermalFraction = tiCount > 0 ? lowTiCount / tiCount : null;
  return {
    consumption,
    distance,
    gain,
    loss,
    peakSlope,
    meanSlope: distance ? weightedSlope / distance : 0,
    steepEdges,
    meanThermalInertia,
    lowThermalFraction,
    footingLabel: footingCategory(meanThermalInertia, lowThermalFraction),
  };
}

function findPath(field: Field, from: number, to: number, reversed: boolean) {
  const path = [];
  const source = reversed ? to : from, destination = reversed ? from : to;
  if (!Number.isFinite(field.cost[destination])) return [];
  for (let index = destination; index !== -1; index = field.link[index]) {
    path.push(index);
    if (index === source) return reversed ? path : path.reverse();
  }
  return [];
}

export function createTraverseGraph(
  bundle: FieldBundle,
  hazards: readonly HazardZone[],
  evacuationOrigin: number,
  preference: boolean | GraphPreference = false,
) {
  const mode: GraphPreference = preference === true ? 'lowerSlope' : preference === false ? 'fastest' : preference;
  const mask = effectiveMask(bundle, hazards);
  const { width, height, baseIndex } = bundle.manifest;
  const offsets = scenario.connectivity === 8 ? [...orthogonal, ...diagonal] : orthogonal;
  const fields = new Map<number, Field>();
  const tiGrid = bundle.contextData?.thermalInertia;

  function neighbors(index: number, reversed: boolean) {
    const [row, col] = indexToGrid(index, width);
    return offsets.flatMap(([dr, dc]) => {
      const r = row + dr, c = col + dc, next = r * width + c;
      if (r < 0 || r >= height || c < 0 || c >= width) return [];
      const canExitBlockedOrigin = reversed && next === evacuationOrigin && mask[next] === 2 && bundle.mask[next] === 1;
      if (mask[next] !== 1 && !canExitBlockedOrigin) return [];
      if (dr && dc && (mask[r * width + col] !== 1 || mask[row * width + c] !== 1)) return [];
      const fromCell = reversed ? next : index;
      const toCell = reversed ? index : next;
      const step = stepMetrics(bundle, fromCell, toCell);
      if (!Number.isFinite(step.grade) || Math.abs(step.grade) > maxGrade) return [];
      const stepRes = travelResources(step.minutes, step.grade);
      let penalty = 0;
      if (mode === 'lowerSlope') {
        penalty = step.minutes * (Math.abs(step.grade) / maxGrade) ** 2 * 10;
      } else if (mode === 'firmGround' && tiGrid) {
        const tiFrom = tiGrid[fromCell];
        const tiTo = tiGrid[toCell];
        const cellTi = Number.isFinite(tiTo) && Number.isFinite(tiFrom)
          ? (tiTo + tiFrom) * 0.5
          : Number.isFinite(tiTo) ? tiTo : tiFrom;
        if (Number.isFinite(cellTi) && cellTi < THERMAL_INERTIA_CONSOLIDATED_TIU) {
          penalty = step.minutes * ((THERMAL_INERTIA_CONSOLIDATED_TIU - cellTi) / 80) * 1.5;
        }
      }
      return [{ cell: next, cost: step.minutes + penalty, res: stepRes }];
    });
  }

  function search(source: number, reversed: boolean): Field {
    const len = mask.length;
    const cost = new Float64Array(len).fill(Infinity);
    const link = new Int32Array(len).fill(-1);
    const minutes = new Float64Array(len).fill(Infinity);
    const oxygen = new Float64Array(len).fill(Infinity);
    const energy = new Float64Array(len).fill(Infinity);
    const evacuation = !reversed && source === evacuationOrigin && mask[source] === 2 && bundle.mask[source] === 1;
    if (mask[source] !== 1 && !evacuation) return { cost, link, minutes, oxygen, energy };
    const queue = new SearchQueue();
    cost[source] = 0;
    minutes[source] = 0;
    oxygen[source] = 0;
    energy[source] = 0;
    queue.push({ cell: source, cost: 0 });
    for (let next = queue.pop(); next; next = queue.pop()) {
      if (next.cost !== cost[next.cell] || (reversed && mask[next.cell] !== 1)) continue;
      for (const edge of neighbors(next.cell, reversed)) {
        const candidate = next.cost + edge.cost;
        if (candidate >= cost[edge.cell]) continue;
        cost[edge.cell] = candidate;
        link[edge.cell] = next.cell;
        minutes[edge.cell] = minutes[next.cell] + edge.res.minutes;
        oxygen[edge.cell] = oxygen[next.cell] + edge.res.oxygen;
        energy[edge.cell] = energy[next.cell] + edge.res.energy;
        queue.push({ cell: edge.cell, cost: candidate });
      }
    }
    return { cost, link, minutes, oxygen, energy };
  }

  function searchField(source: number, reversed: boolean): Field {
    const key = reversed ? -1 : source;
    let field = fields.get(key);
    if (!field) {
      field = search(source, reversed);
      fields.set(key, field);
    }
    return field;
  }

  function route(from: number, to: number): RouteSummary {
    const reversed = to === baseIndex;
    const field = searchField(reversed ? to : from, reversed);
    const path = findPath(field, from, to, reversed);
    if (!path.length) {
      const missing = ![1, 2].includes(mask[from]) || ![1, 2].includes(mask[to]) || (mask[to] !== 2 && mask.includes(0));
      return { status: missing ? 'MISSING_INPUT' : 'NO_SUPPORTED_PATH', distanceMeters: null,
        nominalTravelMinutes: null, geometryGrid: [], sampledElevationsMeters: [],
        unknownReason: missing ? 'No supported route through known coverage' : 'Modeled terrain or event constraint blocks the route' };
    }
    const geometryGrid = path.map(index => indexToGrid(index, width));
    const { distance, consumption } = routeMetrics(bundle, geometryGrid);
    return { status: 'READY', distanceMeters: distance, nominalTravelMinutes: consumption.minutes, geometryGrid,
      sampledElevationsMeters: path.map(index => bundle.elevationMeters[index]) };
  }

  function localSlope(cell: Cell): number | null {
    const index = cellIndex(cell, bundle), [r, c] = cell;
    const adjacent = orthogonal.map(([dr, dc]) => cellIndex([r + dr, c + dc], bundle));
    if (mask[index] !== 1 || adjacent.some(point => mask[point] !== 1)) return null;
    return Math.max(...adjacent.map(point => Math.atan(Math.abs(stepMetrics(bundle, index, point).grade)) * 180 / Math.PI));
  }

  return { route, localSlope, searchField, mask };
}
