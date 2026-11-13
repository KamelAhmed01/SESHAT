import type { RouteSummary } from './types';

/** Distance/elevation analysis on the same grid vertices used for the rendered route.
 * This is DEM-scale topography, NOT a footstep-scale safety analysis.
 */
export interface ElevationProfile {
  vertices: Array<{ distanceMeters: number; elevationMeters: number }>;
  horizontalDistanceMeters: number;
  minimumMeters: number;
  maximumMeters: number;
  ascentMeters: number;
  descentMeters: number;
  netChangeMeters: number;
}

export function elevationProfile(route: RouteSummary, cellWidthMeters: number,
  cellHeightMeters: number): ElevationProfile | null {
  if (route.status !== 'READY' || route.geometryGrid.length !== route.sampledElevationsMeters.length ||
      route.geometryGrid.length === 0 || !Number.isFinite(cellWidthMeters) || cellWidthMeters <= 0 ||
      !Number.isFinite(cellHeightMeters) || cellHeightMeters <= 0 ||
      route.sampledElevationsMeters.some(z => !Number.isFinite(z))) return null;
  let distanceMeters = 0, ascentMeters = 0, descentMeters = 0;
  const vertices = route.geometryGrid.map(([row, col], i) => {
    if (i) {
      const [prevRow, prevCol] = route.geometryGrid[i - 1];
      distanceMeters += Math.hypot((row - prevRow) * cellHeightMeters, (col - prevCol) * cellWidthMeters);
      const rise = route.sampledElevationsMeters[i] - route.sampledElevationsMeters[i - 1];
      if (rise > 0) ascentMeters += rise;
      else descentMeters -= rise;
    }
    return { distanceMeters, elevationMeters: route.sampledElevationsMeters[i] };
  });
  const heights = route.sampledElevationsMeters;
  let min = Infinity, max = -Infinity;
  for (const z of heights) { min = Math.min(min, z); max = Math.max(max, z); }
  return { vertices, horizontalDistanceMeters: distanceMeters,
    minimumMeters: min, maximumMeters: max,
    ascentMeters, descentMeters, netChangeMeters: heights.at(-1)! - heights[0] };
}

/** Bound browser SVG size for long routes, retaining first/last and local extrema.
 * Only rendering is downsampled; reported statistics use ALL original samples.
 */
export function plotVertices(profile: ElevationProfile, maxVertices = 240): ElevationProfile['vertices'] {
  if (!Number.isInteger(maxVertices) || maxVertices < 4) throw new Error('Plot limit must be >= 4');
  const source = profile.vertices;
  if (source.length <= maxVertices) return source;
  const middle = source.length - 2;
  const bucketCount = Math.max(1, Math.floor((maxVertices - 2) / 2));
  const sample = [source[0]];
  for (let b = 0; b < bucketCount; b++) {
    const start = 1 + Math.floor(b * middle / bucketCount);
    const stop = 1 + Math.floor((b + 1) * middle / bucketCount);
    let lo = start, hi = start;
    for (let i = start + 1; i < stop; i++) {
      if (source[i].elevationMeters < source[lo].elevationMeters) lo = i;
      if (source[i].elevationMeters > source[hi].elevationMeters) hi = i;
    }
    sample.push(source[Math.min(lo, hi)]);
    if (hi !== lo) sample.push(source[Math.max(lo, hi)]);
  }
  sample.push(source[source.length - 1]);
  return sample;
}
