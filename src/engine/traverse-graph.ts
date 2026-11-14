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

function neighborhoodIndex(bundle: FieldBundle, [row, col]: Cell): number {
  const neighborhood = bundle.manifest.mapDisplay?.neighborhood;
  if (!neighborhood || !Number.isInteger(row) || !Number.isInteger(col)) return -1;
  const {width, height, cellWidthMeters, cellHeightMeters} = bundle.manifest;
  const x = (neighborhood.spanMeters - width * cellWidthMeters) / 2 + (col + 0.5) * cellWidthMeters;
  const y = (neighborhood.spanMeters - height * cellHeightMeters) / 2 + (row + 0.5) * cellHeightMeters;
  const nc = Math.floor(x / neighborhood.cellWidthMeters);
  const nr = Math.floor(y / neighborhood.cellHeightMeters);
  return nc >= 0 && nc < neighborhood.width && nr >= 0 && nr < neighborhood.height
    ? nr * neighborhood.width + nc : -1;
}

export function isNeighborhoodCell(bundle: FieldBundle, cell: Cell): boolean {
  return neighborhoodIndex(bundle, cell) >= 0;
}

export function hasModeledTerrain(bundle: FieldBundle, cell: Cell): boolean {
  const index = cellIndex(cell, bundle);
  if (index >= 0) return bundle.mask[index] === 1 && Number.isFinite(bundle.elevationMeters[index]);
  const outer = neighborhoodIndex(bundle, cell);
  return outer >= 0 && bundle.contextData?.neighborhoodMask?.[outer] === 1 &&
    Number.isFinite(bundle.contextData.neighborhoodElevation?.[outer]);
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
  const zFrom = bundle.elevationMeters[from];
  const zTo = bundle.elevationMeters[to];
  if (!Number.isFinite(zFrom) || !Number.isFinite(zTo)) {
    return cellStepMetrics(bundle, indexToGrid(from, width), indexToGrid(to, width));
  }
  const distance = Math.hypot((Math.floor(to / width) - Math.floor(from / width)) * cellHeightMeters,
    (to % width - from % width) * cellWidthMeters);
  const rise = zTo - zFrom;
  const grade = rise / distance;
  const minutes = distance * (1 + scenario.uphillCoefficient * Math.max(grade, 0) +
    scenario.downhillCoefficient * Math.max(-grade, 0)) / scenario.referenceSpeedMetersPerSecond / 60;
  return { distance, rise, grade, minutes };
}

export function elevationAtCell(bundle: FieldBundle, cell: Cell): number {
  if (!hasModeledTerrain(bundle, cell)) return NaN;
  const idx = cellIndex(cell, bundle);
  if (idx >= 0) return bundle.elevationMeters[idx];

  const [row, col] = cell;
  const {manifest, contextData} = bundle;
  const nb = manifest.mapDisplay!.neighborhood!;
  const elevations = contextData!.neighborhoodElevation!;
  const mask = contextData!.neighborhoodMask!;
  const u = ((nb.spanMeters - manifest.width * manifest.cellWidthMeters) / 2 +
    (col + 0.5) * manifest.cellWidthMeters) / nb.cellWidthMeters - 0.5;
  const v = ((nb.spanMeters - manifest.height * manifest.cellHeightMeters) / 2 +
    (row + 0.5) * manifest.cellHeightMeters) / nb.cellHeightMeters - 0.5;
  const r = Math.floor(v), c = Math.floor(u);
  if (r >= 0 && c >= 0 && r + 1 < nb.height && c + 1 < nb.width) {
    const i = r * nb.width + c;
    const samples = [i, i + 1, i + nb.width, i + nb.width + 1];
    if (samples.every(index => mask[index] === 1 && Number.isFinite(elevations[index]))) {
      const [nw, ne, sw, se] = samples.map(index => elevations[index]);
      const dr = v - r, dc = u - c;
      return (1 - dr) * ((1 - dc) * nw + dc * ne) + dr * ((1 - dc) * sw + dc * se);
    }
  }
  return elevations[neighborhoodIndex(bundle, cell)];
}

export function cellStepMetrics(bundle: FieldBundle, fromCell: Cell, toCell: Cell) {
  const { cellWidthMeters, cellHeightMeters } = bundle.manifest;
  const distance = Math.hypot(
    (toCell[0] - fromCell[0]) * cellHeightMeters,
    (toCell[1] - fromCell[1]) * cellWidthMeters,
  );
  const elevFrom = elevationAtCell(bundle, fromCell);
  const elevTo = elevationAtCell(bundle, toCell);
  const rise = elevTo - elevFrom;
  const grade = distance > 0 ? rise / distance : 0;
  const minutes = distance > 0
    ? (distance * (1 + scenario.uphillCoefficient * Math.max(grade, 0) +
        scenario.downhillCoefficient * Math.max(-grade, 0))) / scenario.referenceSpeedMetersPerSecond / 60
    : 0;
  return { distance, rise, grade, minutes };
}

export function routeNeighborhood(
  bundle: FieldBundle,
  fromCell: Cell,
  toCell: Cell,
  hazards: readonly HazardZone[] = [],
  lowerSlope = false,
): RouteSummary {
  const nb = bundle.manifest.mapDisplay?.neighborhood;
  const failure = (missing: boolean): RouteSummary => ({
    status: missing ? 'MISSING_INPUT' : 'NO_SUPPORTED_PATH', distanceMeters: null,
    nominalTravelMinutes: null, geometryGrid: [], sampledElevationsMeters: [],
    unknownReason: missing ? 'No supported route through known coverage' : 'Modeled terrain or event constraint blocks the route',
  });
  const startIdx = neighborhoodIndex(bundle, fromCell);
  const goalIdx = neighborhoodIndex(bundle, toCell);
  if (!nb || !hasModeledTerrain(bundle, fromCell) || !hasModeledTerrain(bundle, toCell) || startIdx < 0 || goalIdx < 0) {
    return failure(true);
  }

  const {width, height, cellWidthMeters, cellHeightMeters} = bundle.manifest;
  const point = (index: number): Cell => {
    if (index === startIdx) return fromCell;
    if (index === goalIdx) return toCell;
    return [Math.floor((Math.floor(index / nb.width) * nb.cellHeightMeters - (nb.spanMeters - height * cellHeightMeters) / 2) / cellHeightMeters),
      Math.floor(((index % nb.width) * nb.cellWidthMeters - (nb.spanMeters - width * cellWidthMeters) / 2) / cellWidthMeters)];
  };
  const samePoint = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
  const blocked = (cell: Cell) => hazards.some(zone => Math.hypot(cell[0] - zone.cell[0], cell[1] - zone.cell[1]) <= zone.radius);
  if (blocked(toCell)) return failure(false);
  let missingTerrain = false;
  function traversable(cell: Cell) {
    if (!hasModeledTerrain(bundle, cell)) {
      missingTerrain = true;
      return false;
    }
    return !blocked(cell);
  }

  function connection(from: Cell, to: Cell): { cells: Cell[]; cost: number } | null {
    const cells: Cell[] = [];
    const dr = to[0] - from[0], dc = to[1] - from[1];
    const count = Math.max(Math.abs(dr), Math.abs(dc));
    if (count === 0 || (scenario.connectivity !== 8 && dr && dc)) return null;
    let prev = from;
    let cost = 0;
    for (let i = 1; i <= count; i++) {
      const next: Cell = [Math.round(from[0] + dr * i / count), Math.round(from[1] + dc * i / count)];
      if (!traversable(next)) return null;
      if (prev[0] !== next[0] && prev[1] !== next[1] &&
          (!traversable([prev[0], next[1]]) || !traversable([next[0], prev[1]]))) return null;
      const step = cellStepMetrics(bundle, prev, next);
      if (!Number.isFinite(step.grade) || Math.abs(step.grade) > maxGrade) return null;
      const penalty = step.minutes * (Math.abs(step.grade) / maxGrade) ** 2 * (lowerSlope ? 14 : 6);
      cost += step.minutes + penalty;
      cells.push(next);
      prev = next;
    }
    return { cells, cost };
  }

  function ready(geometryGrid: Cell[]): RouteSummary {
    const {distance, consumption} = routeMetrics(bundle, geometryGrid);
    return {status: 'READY', distanceMeters: distance, nominalTravelMinutes: consumption.minutes,
      geometryGrid, sampledElevationsMeters: geometryGrid.map(cell => elevationAtCell(bundle, cell))};
  }

  if (samePoint(fromCell, toCell)) return ready([fromCell]);
  if (startIdx === goalIdx) {
    const edge = connection(fromCell, toCell);
    return edge ? ready([fromCell, ...edge.cells]) : failure(missingTerrain);
  }

  const heuristic = ([row, col]: Cell) => Math.hypot((row - toCell[0]) * cellHeightMeters,
    (col - toCell[1]) * cellWidthMeters) / scenario.referenceSpeedMetersPerSecond / 60;
  const offsets = scenario.connectivity === 8 ? [...orthogonal, ...diagonal] : orthogonal;
  const gScore = new Float64Array(nb.width * nb.height).fill(Infinity);
  const link = new Int32Array(gScore.length).fill(-1);
  const queue = new SearchQueue();
  gScore[startIdx] = 0;
  queue.push({cell: startIdx, cost: heuristic(fromCell)});

  for (let current = queue.pop(); current; current = queue.pop()) {
    const u = current.cell;
    const from = point(u);
    if (current.cost !== gScore[u] + heuristic(from)) continue;
    if (u === goalIdx) {
      const path: number[] = [];
      for (let index = u; index !== -1; index = link[index]) path.push(index);
      path.reverse();
      const cells = [fromCell];
      for (let i = 1; i < path.length; i++) {
        cells.push(...connection(point(path[i - 1]), point(path[i]))!.cells);
      }
      return ready(cells);
    }
    const nr = Math.floor(u / nb.width), nc = u % nb.width;
    for (const [dr, dc] of offsets) {
      const r = nr + dr, c = nc + dc;
      if (r < 0 || r >= nb.height || c < 0 || c >= nb.width) continue;
      const v = r * nb.width + c;
      const to = point(v);
      const edge = connection(from, to);
      if (!edge) continue;
      const cost = gScore[u] + edge.cost;
      if (cost >= gScore[v]) continue;
      gScore[v] = cost;
      link[v] = u;
      queue.push({cell: v, cost: cost + heuristic(to)});
    }
  }
  return failure(missingTerrain);
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
    const cA = cells[i - 1], cB = cells[i];
    const iA = cellIndex(cA, bundle), iB = cellIndex(cB, bundle);
    const step = iA !== -1 && iB !== -1
      ? stepMetrics(bundle, iA, iB)
      : cellStepMetrics(bundle, cA, cB);
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
    if (index !== -1) {
      const adjacent = orthogonal.map(([dr, dc]) => cellIndex([r + dr, c + dc], bundle));
      if (mask[index] !== 1 || adjacent.some(point => point === -1 || mask[point] !== 1)) return null;
      return Math.max(...adjacent.map(point => Math.atan(Math.abs(stepMetrics(bundle, index, point).grade)) * 180 / Math.PI));
    }
    if (!bundle.contextData?.neighborhoodElevation) return null;
    const centerElev = elevationAtCell(bundle, cell);
    if (!Number.isFinite(centerElev)) return null;
    const grades = orthogonal.map(([dr, dc]) => cellStepMetrics(bundle, cell, [r + dr * 2, c + dc * 2]).grade);
    if (grades.some(g => !Number.isFinite(g))) return null;
    return Math.max(...grades.map(g => Math.atan(Math.abs(g)) * 180 / Math.PI));
  }

  return { route, localSlope, searchField, mask };
}
