import type { FieldBundle } from '../data/loader';
import type { RouteSummary } from './types';
import { indexToGrid } from '../cartography/coordinates';
import { reconstructOutbound, reconstructReturn } from './route-path';

export function routeSummary(bundle: FieldBundle, index: number, direction: 'outbound' | 'return'): RouteSummary {
  const m = bundle.manifest;
  if (!Number.isInteger(index) || index < 0 || index >= m.width * m.height || bundle.mask[index] !== 1)
    return { status: 'MISSING_INPUT', distanceMeters: null, nominalTravelMinutes: null,
      geometryGrid: [], sampledElevationsMeters: [], unknownReason: 'MISSING_DATA' };
  const path = direction === 'outbound' ?
    reconstructOutbound(bundle.outboundParents, m.baseIndex, index) :
    reconstructReturn(bundle.returnNext, m.baseIndex, index);
  const time = (direction === 'outbound' ? bundle.outboundMinutes : bundle.returnMinutes)[index];
  if (path.status !== 'READY' || !Number.isFinite(time))
    return { status: 'NO_SUPPORTED_PATH', distanceMeters: null, nominalTravelMinutes: null,
      geometryGrid: [], sampledElevationsMeters: [], unknownReason: 'MISSING_DATA' };
  let distance = 0;
  const cells = path.indices.map(i => indexToGrid(i, m.width));
  for (let i = 1; i < cells.length; i++) {
    const [r1, c1] = cells[i - 1], [r2, c2] = cells[i];
    if (bundle.mask[path.indices[i]] !== 1 || Math.abs(r1 - r2) > 1 || Math.abs(c1 - c2) > 1)
      return { status: 'INVALID_GEOMETRY', distanceMeters: null, nominalTravelMinutes: null,
        geometryGrid: [], sampledElevationsMeters: [], unknownReason: 'CORRUPT_POINTER_CHAIN' };
    distance += Math.hypot((r2 - r1) * m.cellHeightMeters, (c2 - c1) * m.cellWidthMeters);
  }
  return { status: 'READY', distanceMeters: distance, nominalTravelMinutes: time,
    geometryGrid: cells,
    sampledElevationsMeters: path.indices.map(i => bundle.elevationMeters[i]),
  };
}
