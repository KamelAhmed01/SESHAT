import type { FieldBundle } from '../data/loader';
import { indexToGrid } from '../cartography/coordinates';
import scenario from '../config/mission-scenario.json';
import { addResources, travelResources, zeroResources } from './consumables';
import type { Resources } from './consumables';
import type { RouteSummary } from './types';

export type Cell = [number, number];
export interface HazardZone { cell: Cell; radius: number }
type SearchEntry = { cell: number; cost: number };
type Field = { cost: Float64Array; link: Int32Array };
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

export function routeMetrics(bundle: FieldBundle, cells: readonly Cell[]) {
  let consumption: Resources = zeroResources;
  let distance = 0, gain = 0, loss = 0, peakSlope = 0, weightedSlope = 0, steepEdges = 0;
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
  return { consumption, distance, gain, loss, peakSlope, meanSlope: distance ? weightedSlope / distance : 0, steepEdges };
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

export function createTraverseGraph(bundle: FieldBundle, hazards: readonly HazardZone[], evacuationOrigin: number, lowerSlope = false) {
  const mask = effectiveMask(bundle, hazards);
  const { width, height, baseIndex } = bundle.manifest;
  const offsets = scenario.connectivity === 8 ? [...orthogonal, ...diagonal] : orthogonal;
  const fields = new Map<number, Field>();

  function neighbors(index: number, reversed: boolean) {
    const [row, col] = indexToGrid(index, width);
    return offsets.flatMap(([dr, dc]) => {
      const r = row + dr, c = col + dc, next = r * width + c;
      if (r < 0 || r >= height || c < 0 || c >= width) return [];
      const canExitBlockedOrigin = reversed && next === evacuationOrigin && mask[next] === 2 && bundle.mask[next] === 1;
      if (mask[next] !== 1 && !canExitBlockedOrigin) return [];
      if (dr && dc && (mask[r * width + col] !== 1 || mask[row * width + c] !== 1)) return [];
      const step = reversed ? stepMetrics(bundle, next, index) : stepMetrics(bundle, index, next);
      if (!Number.isFinite(step.grade) || Math.abs(step.grade) > maxGrade) return [];
      const penalty = lowerSlope ? step.minutes * (Math.abs(step.grade) / maxGrade) ** 2 * 10 : 0;
      return [{ cell: next, cost: step.minutes + penalty }];
    });
  }

  function search(source: number, reversed: boolean): Field {
    const cost = new Float64Array(mask.length).fill(Infinity), link = new Int32Array(mask.length).fill(-1);
    const evacuation = !reversed && source === evacuationOrigin && mask[source] === 2 && bundle.mask[source] === 1;
    if (mask[source] !== 1 && !evacuation) return { cost, link };
    const queue = new SearchQueue();
    cost[source] = 0;
    queue.push({ cell: source, cost: 0 });
    for (let next = queue.pop(); next; next = queue.pop()) {
      if (next.cost !== cost[next.cell] || (reversed && mask[next.cell] !== 1)) continue;
      for (const edge of neighbors(next.cell, reversed)) {
        const candidate = next.cost + edge.cost;
        if (candidate >= cost[edge.cell]) continue;
        cost[edge.cell] = candidate;
        link[edge.cell] = next.cell;
        queue.push({ cell: edge.cell, cost: candidate });
      }
    }
    return { cost, link };
  }

  function route(from: number, to: number): RouteSummary {
    const reversed = to === baseIndex;
    const key = reversed ? -1 : from;
    let field = fields.get(key);
    if (!field) {
      field = search(reversed ? to : from, reversed);
      fields.set(key, field);
    }
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

  return { route, localSlope };
}
