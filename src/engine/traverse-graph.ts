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
  const [row, col] = cell;
  const idx = cellIndex(cell, bundle);
  if (idx !== -1 && Number.isFinite(bundle.elevationMeters[idx])) {
    return bundle.elevationMeters[idx];
  }
  const nbElev = bundle.contextData?.neighborhoodElevation;
  const nbMask = bundle.contextData?.neighborhoodMask;
  if (nbElev) {
    const u = Math.min(549, Math.max(0, 219.75 + col * 0.5));
    const v = Math.min(549, Math.max(0, 219.75 + row * 0.5));
    const r0 = Math.min(548, Math.floor(v));
    const c0 = Math.min(548, Math.floor(u));
    const dr = v - r0;
    const dc = u - c0;
    const i00 = r0 * 550 + c0;
    if (nbMask && (nbMask[i00] !== 1 || nbMask[i00 + 1] !== 1 || nbMask[i00 + 550] !== 1 || nbMask[i00 + 551] !== 1)) {
      const nr = Math.round(v), nc = Math.round(u);
      if (nbMask[nr * 550 + nc] !== 1) return NaN;
      const fallback = nbElev[nr * 550 + nc];
      return Number.isFinite(fallback) ? fallback : NaN;
    }
    const z00 = nbElev[i00], z01 = nbElev[i00 + 1], z10 = nbElev[i00 + 550], z11 = nbElev[i00 + 551];
    if (Number.isFinite(z00) && Number.isFinite(z01) && Number.isFinite(z10) && Number.isFinite(z11)) {
      return (1 - dr) * (1 - dc) * z00 + (1 - dr) * dc * z01 + dr * (1 - dc) * z10 + dr * dc * z11;
    }
    const val = nbElev[Math.round(v) * 550 + Math.round(u)];
    if (Number.isFinite(val)) return val;
  }
  return NaN;
}

export function cellStepMetrics(bundle: FieldBundle, fromCell: Cell, toCell: Cell) {
  const { cellWidthMeters, cellHeightMeters } = bundle.manifest;
  const distance = Math.hypot(
    (toCell[0] - fromCell[0]) * cellHeightMeters,
    (toCell[1] - fromCell[1]) * cellWidthMeters,
  );
  const elevFrom = elevationAtCell(bundle, fromCell);
  const elevTo = elevationAtCell(bundle, toCell);
  const rise = Number.isFinite(elevFrom) && Number.isFinite(elevTo) ? elevTo - elevFrom : 0;
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
  const nbElev = bundle.contextData?.neighborhoodElevation;
  if (!nbElev) {
    return {
      status: 'MISSING_INPUT',
      distanceMeters: null,
      nominalTravelMinutes: null,
      geometryGrid: [],
      sampledElevationsMeters: [],
      unknownReason: 'No supported route through known coverage',
    };
  }

  const nbW = 550;
  const nbH = 550;
  const nbTotal = nbW * nbH;
  const nbCellMeters = (bundle.manifest.cellWidthMeters || 20) * 2;
  const baseMask = bundle.contextData?.neighborhoodMask;
  const mask = baseMask ? baseMask.slice() : new Uint8Array(nbTotal).fill(1);

  for (const { cell: [hr, hc], radius } of hazards) {
    const hNr = 220 + hr * 0.5;
    const hNc = 220 + hc * 0.5;
    const hRad = Math.max(0.75, radius * 0.5);
    const rMin = Math.max(0, Math.floor(hNr - hRad - 1));
    const rMax = Math.min(nbH - 1, Math.ceil(hNr + hRad + 1));
    const cMin = Math.max(0, Math.floor(hNc - hRad - 1));
    const cMax = Math.min(nbW - 1, Math.ceil(hNc + hRad + 1));
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (Math.hypot(r - hNr, c - hNc) <= hRad && mask[r * nbW + c] === 1) {
          mask[r * nbW + c] = 2;
        }
      }
    }
  }

  const toNb = (r: number, c: number): [number, number] => [
    Math.min(nbH - 1, Math.max(0, Math.floor(220 + r * 0.5))),
    Math.min(nbW - 1, Math.max(0, Math.floor(220 + c * 0.5))),
  ];

  const [sr, sc] = toNb(fromCell[0], fromCell[1]);
  const [tr, tc] = toNb(toCell[0], toCell[1]);
  const startIdx = sr * nbW + sc;
  const goalIdx = tr * nbW + tc;

  const startValid = mask[startIdx] === 1 || (mask[startIdx] === 2 && (!baseMask || baseMask[startIdx] === 1));
  if (!startValid || mask[goalIdx] !== 1) {
    const missing = mask[startIdx] === 0 || mask[goalIdx] === 0;
    return {
      status: missing ? 'MISSING_INPUT' : 'NO_SUPPORTED_PATH',
      distanceMeters: null,
      nominalTravelMinutes: null,
      geometryGrid: [],
      sampledElevationsMeters: [],
      unknownReason: missing ? 'No supported route through known coverage' : 'Modeled terrain or event constraint blocks the route',
    };
  }

  if (startIdx === goalIdx) {
    const geometryGrid: Cell[] =
      fromCell[0] === toCell[0] && fromCell[1] === toCell[1]
        ? [fromCell]
        : [fromCell, toCell];
    const sampledElevationsMeters = geometryGrid.map(c => elevationAtCell(bundle, c));
    const { distance, consumption } = routeMetrics(bundle, geometryGrid);
    return {
      status: 'READY',
      distanceMeters: distance,
      nominalTravelMinutes: consumption.minutes,
      geometryGrid,
      sampledElevationsMeters,
    };
  }

  const { width, height } = bundle.manifest;
  const nodeElevation = (nr: number, nc: number, idx: number): number => {
    if (nr >= 220 && nr < 330 && nc >= 220 && nc < 330) {
      const r20 = (nr - 220) * 2;
      const c20 = (nc - 220) * 2;
      if (r20 >= 0 && r20 < height && c20 >= 0 && c20 < width) {
        const zCenter = bundle.elevationMeters[r20 * width + c20];
        if (Number.isFinite(zCenter)) return zCenter;
      }
    }
    return nbElev[idx];
  };

  const heuristicMinutes = (nr: number, nc: number): number => {
    const dx = Math.abs(nc - tc);
    const dy = Math.abs(nr - tr);
    const octileMeters = nbCellMeters * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
    return octileMeters / scenario.referenceSpeedMetersPerSecond / 60;
  };

  const offsets = scenario.connectivity === 8 ? [...orthogonal, ...diagonal] : orthogonal;
  const slopeWeight = lowerSlope ? 14 : 6;
  const gScore = new Float64Array(nbTotal).fill(Infinity);
  const closed = new Uint8Array(nbTotal);
  const link = new Int32Array(nbTotal).fill(-1);
  const queue = new SearchQueue();

  gScore[startIdx] = 0;
  queue.push({ cell: startIdx, cost: heuristicMinutes(sr, sc) });

  let found = false;
  for (let current = queue.pop(); current; current = queue.pop()) {
    const u = current.cell;
    if (u === goalIdx) {
      found = true;
      break;
    }
    if (closed[u]) continue;
    closed[u] = 1;

    const ur = Math.floor(u / nbW);
    const uc = u % nbW;
    const uElev = nodeElevation(ur, uc, u);
    const uG = gScore[u];

    for (const [dr, dc] of offsets) {
      const vr = ur + dr;
      const vc = uc + dc;
      if (vr < 0 || vr >= nbH || vc < 0 || vc >= nbW) continue;
      const v = vr * nbW + vc;
      if (closed[v] || mask[v] !== 1) continue;
      if (dr !== 0 && dc !== 0 && (mask[ur * nbW + vc] !== 1 || mask[vr * nbW + uc] !== 1)) continue;

      const vElev = nodeElevation(vr, vc, v);
      const distance = dr !== 0 && dc !== 0 ? nbCellMeters * Math.SQRT2 : nbCellMeters;
      const rise = vElev - uElev;
      const grade = rise / distance;
      if (!Number.isFinite(grade) || Math.abs(grade) > maxGrade) continue;

      const minutes =
        (distance *
          (1 +
            scenario.uphillCoefficient * Math.max(grade, 0) +
            scenario.downhillCoefficient * Math.max(-grade, 0))) /
        scenario.referenceSpeedMetersPerSecond /
        60;
      const penalty = minutes * (Math.abs(grade) / maxGrade) ** 2 * slopeWeight;
      const candidateG = uG + minutes + penalty;

      if (candidateG < gScore[v]) {
        gScore[v] = candidateG;
        link[v] = u;
        queue.push({ cell: v, cost: candidateG + heuristicMinutes(vr, vc) });
      }
    }
  }

  if (!found) {
    const missing = mask.includes(0);
    return {
      status: missing ? 'MISSING_INPUT' : 'NO_SUPPORTED_PATH',
      distanceMeters: null,
      nominalTravelMinutes: null,
      geometryGrid: [],
      sampledElevationsMeters: [],
      unknownReason: missing ? 'No supported route through known coverage' : 'Modeled terrain or event constraint blocks the route',
    };
  }

  const nbPath: number[] = [];
  for (let cur = goalIdx; cur !== -1; cur = link[cur]) {
    nbPath.push(cur);
    if (cur === startIdx) break;
  }
  nbPath.reverse();

  const coarseCells: Cell[] = nbPath.map((idx, i) => {
    if (i === 0) return fromCell;
    if (i === nbPath.length - 1) return toCell;
    const nr = Math.floor(idx / nbW);
    const nc = idx % nbW;
    return [(nr - 220) * 2, (nc - 220) * 2];
  });

  const geometryGrid: Cell[] = [coarseCells[0]];
  for (let i = 1; i < coarseCells.length; i++) {
    const [pr, pc] = geometryGrid[geometryGrid.length - 1];
    const [cr, cc] = coarseCells[i];
    const steps = Math.max(Math.abs(cr - pr), Math.abs(cc - pc));
    for (let s = 1; s <= steps; s++) {
      const r = Math.round(pr + ((cr - pr) * s) / steps);
      const c = Math.round(pc + ((cc - pc) * s) / steps);
      const last = geometryGrid[geometryGrid.length - 1];
      if (r !== last[0] || c !== last[1]) {
        geometryGrid.push([r, c]);
      }
    }
  }

  const sampledElevationsMeters = geometryGrid.map(c => elevationAtCell(bundle, c));
  const { distance, consumption } = routeMetrics(bundle, geometryGrid);
  return {
    status: 'READY',
    distanceMeters: distance,
    nominalTravelMinutes: consumption.minutes,
    geometryGrid,
    sampledElevationsMeters,
  };
}

export function routeMetrics(bundle: FieldBundle, cells: readonly Cell[]) {
  let consumption: Resources = zeroResources;
  let distance = 0, gain = 0, loss = 0, peakSlope = 0, weightedSlope = 0, steepEdges = 0;
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

  return { route, localSlope };
}
