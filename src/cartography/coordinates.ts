/** Leaflet CRS.Simple is a VIEW coordinate system, not a Mars geodetic CRS. */
export function gridToViewer(row: number, col: number, height: number): [number, number] {
  return [height - row - 0.5, col + 0.5];
}
export function viewerToGrid(lat: number, lng: number, width: number, height: number): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat <= 0 || lng < 0 || lat > height || lng >= width) return null;
  return [Math.floor(height - lat), Math.floor(lng)];
}
export function gridToIndex(row: number, col: number, width: number): number { return row * width + col; }
export function indexToGrid(index: number, width: number): [number, number] {
  return [Math.floor(index / width), index % width];
}

export const MARS_SPHERE_RADIUS_METERS = 3396190.0;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface MarsGeoMetadata {
  width: number;
  height: number;
  rasterTransform?: readonly number[];
  sourceBodyRadiusMeters?: number;
  analysisCenterPlanetocentricLat?: number;
  analysisCenterPositiveEastLon?: number;
  analysisProjection?: string;
}

export function isMarsGeographic(meta: MarsGeoMetadata | null | undefined): boolean {
  if (!meta) return false;
  return (
    meta.analysisProjection === 'MARS_LOCAL_AZIMUTHAL_EQUIDISTANT' &&
    Array.isArray(meta.rasterTransform) &&
    meta.rasterTransform.length >= 6 &&
    meta.rasterTransform.slice(0, 6).every(Number.isFinite) &&
    typeof meta.analysisCenterPlanetocentricLat === 'number' &&
    Number.isFinite(meta.analysisCenterPlanetocentricLat) &&
    typeof meta.analysisCenterPositiveEastLon === 'number' &&
    Number.isFinite(meta.analysisCenterPositiveEastLon)
  );
}

/** Normalize longitude into [-180, 180). */
export function normalizeMarsLon(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? -180 : wrapped;
}

/** Normalize longitude into positive-east [0, 360). */
export function normalizeMarsEastLon(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

/** Exact spherical inverse Azimuthal Equidistant returning [lonDeg, latDeg]. */
export function aeqdMetersToLonLat(
  x: number,
  y: number,
  lat0Deg: number,
  lon0Deg: number,
  radiusMeters = MARS_SPHERE_RADIUS_METERS,
): [number, number] {
  const lat0 = lat0Deg * DEG_TO_RAD;
  const lon0 = lon0Deg * DEG_TO_RAD;
  const rho = Math.hypot(x, y);
  if (rho < 1e-12) {
    return [normalizeMarsLon(lon0Deg), lat0Deg];
  }
  const c = rho / radiusMeters;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const sinLat = Math.max(-1, Math.min(1, cosC * sinLat0 + (y * sinC * cosLat0) / rho));
  const lat = Math.asin(sinLat);
  const lon = lon0 + Math.atan2(x * sinC, rho * cosLat0 * cosC - y * sinLat0 * sinC);
  return [normalizeMarsLon(lon * RAD_TO_DEG), lat * RAD_TO_DEG];
}

/** Exact spherical forward Azimuthal Equidistant returning [xMeters, yMeters]. */
export function lonLatToAeqdMeters(
  lonDeg: number,
  latDeg: number,
  lat0Deg: number,
  lon0Deg: number,
  radiusMeters = MARS_SPHERE_RADIUS_METERS,
): [number, number] {
  const lat0 = lat0Deg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;
  const dlonRaw = (lonDeg - lon0Deg) * DEG_TO_RAD;
  const dlon = ((((dlonRaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const cosC = Math.max(-1, Math.min(1, sinLat0 * sinLat + cosLat0 * cosLat * Math.cos(dlon)));
  const c = Math.acos(cosC);
  const k = c < 1e-12 ? 1 : c / Math.sin(c);
  const x = radiusMeters * k * cosLat * Math.sin(dlon);
  const y = radiusMeters * k * (cosLat0 * sinLat - sinLat0 * cosLat * Math.cos(dlon));
  return [x, y];
}

/** Transform fractional pixel coordinates (rowFloat, colFloat) to planetocentric [lat, lon]. */
export function gridPointToMarsLatLng(rowFloat: number, colFloat: number, meta: MarsGeoMetadata): [number, number] {
  if (!isMarsGeographic(meta)) {
    throw new Error('Manifest lacks verified spherical Mars AEQD display metadata');
  }
  const [a, b, c, d, e, f] = meta.rasterTransform!;
  const x = a * colFloat + b * rowFloat + c;
  const y = d * colFloat + e * rowFloat + f;
  const [lon, lat] = aeqdMetersToLonLat(
    x,
    y,
    meta.analysisCenterPlanetocentricLat!,
    meta.analysisCenterPositiveEastLon!,
    meta.sourceBodyRadiusMeters ?? MARS_SPHERE_RADIUS_METERS,
  );
  return [lat, lon];
}

/** Transform integer cell center (row + 0.5, col + 0.5) to planetocentric [lat, lon]. */
export function gridToMarsLatLng(row: number, col: number, meta: MarsGeoMetadata): [number, number] {
  return gridPointToMarsLatLng(row + 0.5, col + 0.5, meta);
}

/** Invert planetocentric [lat, lng] into fractional [rowFloat, colFloat] inside the local AEQD grid, or null if outside. */
export function marsLatLngToGridFloat(lat: number, lng: number, meta: MarsGeoMetadata, allowOutside = false): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isMarsGeographic(meta)) return null;
  if (lat < -90 || lat > 90) return null;
  const [x, y] = lonLatToAeqdMeters(
    lng,
    lat,
    meta.analysisCenterPlanetocentricLat!,
    meta.analysisCenterPositiveEastLon!,
    meta.sourceBodyRadiusMeters ?? MARS_SPHERE_RADIUS_METERS,
  );
  const [a, b, c, d, e, f] = meta.rasterTransform!;
  const det = a * e - b * d;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const dx = x - c;
  const dy = y - f;
  const colFloat = (e * dx - b * dy) / det;
  const rowFloat = (a * dy - d * dx) / det;
  if (!allowOutside && (rowFloat < 0 || rowFloat >= meta.height || colFloat < 0 || colFloat >= meta.width)) return null;
  return [rowFloat, colFloat];
}

/** Invert planetocentric [lat, lng] into integer [row, col] inside the local AEQD grid, or null if outside. */
export function marsLatLngToGrid(lat: number, lng: number, meta: MarsGeoMetadata): [number, number] | null {
  const pt = marsLatLngToGridFloat(lat, lng, meta);
  return pt ? [Math.floor(pt[0]), Math.floor(pt[1])] : null;
}

/** Sample the perimeter of the [0..height, 0..width] local AEQD grid into geographic [lat, lon] vertices. */
export function gridBoundaryLatLngs(meta: MarsGeoMetadata, stepsPerEdge = 32): [number, number][] {
  const h = meta.height;
  const w = meta.width;
  const pts: [number, number][] = [];
  for (let i = 0; i < stepsPerEdge; i++) pts.push(gridPointToMarsLatLng(0, (i / stepsPerEdge) * w, meta));
  for (let i = 0; i < stepsPerEdge; i++) pts.push(gridPointToMarsLatLng((i / stepsPerEdge) * h, w, meta));
  for (let i = 0; i < stepsPerEdge; i++) pts.push(gridPointToMarsLatLng(h, w - (i / stepsPerEdge) * w, meta));
  for (let i = 0; i < stepsPerEdge; i++) pts.push(gridPointToMarsLatLng(h - (i / stepsPerEdge) * h, 0, meta));
  return pts;
}

/** Compute tight geographic bounds { south, west, north, east } enclosing the AEQD grid. */
export function gridGeographicBounds(meta: MarsGeoMetadata): { south: number; west: number; north: number; east: number } {
  const ring = gridBoundaryLatLngs(meta, 64);
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [lat, lon] of ring) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
  }
  return { south, west, north, east };
}

/** Spherical surface distance in meters on Mars (R = 3,396,190 m). */
export function marsSurfaceDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters = MARS_SPHERE_RADIUS_METERS,
): number {
  const p1 = lat1 * DEG_TO_RAD;
  const p2 = lat2 * DEG_TO_RAD;
  const dp = (lat2 - lat1) * DEG_TO_RAD;
  const dlRaw = (lon2 - lon1) * DEG_TO_RAD;
  const dl = ((((dlRaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * radiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
