/** Scientific bundle validation. Local synthetic fixture can never become a verified Mars source. */
import type { ScienceTarget } from '../engine/types';

export interface FileRecord { bytes: number; sha256: string; dtype: string }
export interface DatasetManifest {
  schemaVersion: '1.0.0';
  status: 'SOURCE_REVIEW_REQUIRED' | 'VERIFIED' | 'DEMO_SYNTHETIC';
  sourceId: string;
  sourceUrl: string;
  modelId: string;
  height: number;
  width: number;
  baseIndex: number;
  cellWidthMeters: number;
  cellHeightMeters: number;
  crsWkt: string;
  coordinateFrameVerified: boolean;
  challengeResourceQualified?: boolean;
  files: Record<string, FileRecord>;
  imagery: { path: string; bytes: number; sha256: string };
  optical?: { path: string; bytes: number; sha256: string; sourceId: string; sourceUrl: string; reviewStatus: string };
  scienceTargets?: ScienceTarget[];
  notice?: string;
  historicalLandingCell?: [number, number];
  sourceFileSha256?: string;
}
export interface FieldBundle {
  manifest: DatasetManifest;
  assetRoot: '/data' | '/demo';
  outboundMinutes: Float64Array;
  returnMinutes: Float64Array;
  outboundParents: Int32Array;
  returnNext: Int32Array;
  elevationMeters: Float32Array;
  mask: Uint8Array;
}
export type BundleResult =
  | { state: 'NO_DATA'; message: string }
  | { state: 'CORRUPT'; message: string }
  | { state: 'SOURCE_REVIEW_REQUIRED'; message: string; bundle: FieldBundle }
  | { state: 'VERIFIED'; message: string; bundle: FieldBundle }
  | { state: 'DEMO'; message: string; bundle: FieldBundle };

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function readNumeric(buffer: ArrayBuffer, kind: 'f64' | 'f32' | 'i32' | 'u8') {
  const b = new DataView(buffer);
  const size = kind === 'f64' ? 8 : kind === 'u8' ? 1 : 4;
  if (b.byteLength % size !== 0) throw new Error('Binary file is not aligned');
  const count = b.byteLength / size;
  if (kind === 'f64') return Float64Array.from({ length: count }, (_, i) => b.getFloat64(i * size, true));
  if (kind === 'f32') return Float32Array.from({ length: count }, (_, i) => b.getFloat32(i * size, true));
  if (kind === 'i32') return Int32Array.from({ length: count }, (_, i) => b.getInt32(i * size, true));
  return new Uint8Array(buffer);
}
function isSafeAssetPath(path: string): boolean {
  return /^imagery\/[a-zA-Z0-9][\w./-]*\.(webp|png|jpg)$/.test(path) &&
    !path.split('/').includes('..') && !path.includes('//');
}
function validateTargets(targets: unknown, m: DatasetManifest): asserts targets is ScienceTarget[] {
  if (targets === undefined) return;
  if (!Array.isArray(targets) || targets.length > 20) throw new Error('Invalid science target catalog');
  const ids = new Set<string>();
  for (const t of targets) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !t.id || ids.has(t.id) ||
        typeof t.name !== 'string' || !t.name || !t.location || !t.science || !t.activity ||
        !Number.isFinite(t.activity.minutes) || t.activity.minutes < 0 ||
        !['VERIFIED_POINT', 'SOURCE_REPORTED_POINT', 'APPROXIMATE_REGION', 'USER_SELECTED'].includes(t.location.confidence))
      throw new Error('Invalid or duplicate science target');
    ids.add(t.id);
    const { gridRow: r, gridCol: c } = t.location;
    if ((r === null) !== (c === null) || (r !== null && c !== null &&
       (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= m.height || c >= m.width)))
      throw new Error('Target location outside accepted grid');
    if (m.status === 'DEMO_SYNTHETIC' && ['VERIFIED_POINT', 'SOURCE_REPORTED_POINT'].includes(t.location.confidence))
      throw new Error('Synthetic fixture cannot declare verified point');
  }
}
/** Fetch with small backoff so single-threaded local static servers never drop concurrent asset reads. */
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok || res.status < 500 || attempt === retries) return res;
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 60 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

/** `/demo` is opt-in only, including for static exports. `/data` remains the science gate. */
export async function loadScientificBundle(root: '/data' | '/demo' = '/data'): Promise<BundleResult> {
  let response: Response;
  try { response = await fetchWithRetry(`${root}/manifest.json`); }
  catch { return { state: 'NO_DATA', message: 'No accepted data bundle is installed yet.' }; }
  if (!response.ok) return { state: 'NO_DATA', message: 'No accepted data bundle is installed yet.' };
  try {
    const m = await response.json() as DatasetManifest;
    if (m.schemaVersion !== '1.0.0' || !Number.isInteger(m.width) || !Number.isInteger(m.height) ||
        m.width < 2 || m.height < 2 || m.width * m.height > 250000 ||
        !Number.isInteger(m.baseIndex) || m.baseIndex < 0 || m.baseIndex >= m.width * m.height ||
        !(m.cellWidthMeters > 0) || !(m.cellHeightMeters > 0) ||
        !Number.isFinite(m.cellWidthMeters) || !Number.isFinite(m.cellHeightMeters) ||
        typeof m.crsWkt !== 'string' || !m.crsWkt || !m.files || !m.imagery ||
        !m.sourceId || !m.modelId)
      throw new Error('Manifest fails dimension or schema checks');
    if (m.historicalLandingCell !== undefined && (!Array.isArray(m.historicalLandingCell) ||
        m.historicalLandingCell.length !== 2 || !m.historicalLandingCell.every(Number.isInteger) ||
        m.historicalLandingCell[0] < 0 || m.historicalLandingCell[0] >= m.height ||
        m.historicalLandingCell[1] < 0 || m.historicalLandingCell[1] >= m.width))
      throw new Error('Historical landing marker outside accepted grid');
    if (root === '/demo' && m.status !== 'DEMO_SYNTHETIC')
      throw new Error('Demonstration directory must contain a synthetic fixture');
    if (root === '/data' && m.status === 'DEMO_SYNTHETIC')
      throw new Error('Synthetic fixture cannot be installed as Mars data');
    if (m.status !== 'VERIFIED' && m.status !== 'SOURCE_REVIEW_REQUIRED' && m.status !== 'DEMO_SYNTHETIC')
      throw new Error('Unknown evidence status');
    validateTargets(m.scienceTargets, m);
    if (!isSafeAssetPath(m.imagery.path) || !/^[0-9a-f]{64}$/.test(m.imagery.sha256) || !(m.imagery.bytes > 0))
      throw new Error('Invalid imagery record');
    const specs = [
      ['outbound-costs.bin', 'f64', 'float64'], ['return-costs.bin', 'f64', 'float64'],
      ['outbound-parents.bin', 'i32', 'int32'], ['return-next.bin', 'i32', 'int32'],
      ['elevation.bin', 'f32', 'float32'], ['validity-mask.bin', 'u8', 'uint8'],
    ] as const;
    const loadSpec = async ([name, kind, dtype]: (typeof specs)[number]) => {
      const record = m.files[name];
      if (!record || record.dtype !== dtype && !(kind === 'u8' && record.dtype === 'uint8') ||
          record.bytes !== m.width * m.height * (kind === 'f64' ? 8 : kind === 'u8' ? 1 : 4) ||
          !/^[0-9a-f]{64}$/.test(record.sha256))
        throw new Error(`Invalid file contract: ${name}`);
      const r = await fetchWithRetry(`${root}/${name}`);
      if (!r.ok) throw new Error(`Missing file: ${name}`);
      const data = await r.arrayBuffer();
      if (data.byteLength !== record.bytes || await sha256Hex(data) !== record.sha256)
        throw new Error(`Hash / byte count mismatch: ${name}`);
      return readNumeric(data, kind);
    };
    const batchOne = await Promise.all(specs.slice(0, 3).map(loadSpec));
    const batchTwo = await Promise.all(specs.slice(3).map(loadSpec));
    const arrays = [...batchOne, ...batchTwo];
    // Image integrity is checked *before* the browser attempts to render the layer.
    const imageResponse = await fetchWithRetry(`${root}/${m.imagery.path}`);
    if (!imageResponse.ok) throw new Error('Missing shaded relief imagery');
    const imageBytes = await imageResponse.arrayBuffer();
    if (imageBytes.byteLength !== m.imagery.bytes || await sha256Hex(imageBytes) !== m.imagery.sha256)
      throw new Error('Imagery SHA-256 mismatch');
    if (m.optical) {
      if (!isSafeAssetPath(m.optical.path) || !/^[0-9a-f]{64}$/.test(m.optical.sha256) ||
          !(m.optical.bytes > 0) || !m.optical.sourceUrl.startsWith('https://'))
        throw new Error('Invalid orbital layer manifest');
      const opticalResponse = await fetchWithRetry(`${root}/${m.optical.path}`);
      if (!opticalResponse.ok) throw new Error('Missing orbital imagery');
      const opticalBytes = await opticalResponse.arrayBuffer();
      if (opticalBytes.byteLength !== m.optical.bytes || await sha256Hex(opticalBytes) !== m.optical.sha256)
        throw new Error('Orbital imagery SHA-256 mismatch');
    }
    const [o, r, p, n, z, k] = arrays;
    const bundle: FieldBundle = {
      manifest: m, assetRoot: root,
      outboundMinutes: o as Float64Array, returnMinutes: r as Float64Array,
      outboundParents: p as Int32Array, returnNext: n as Int32Array,
      elevationMeters: z as Float32Array, mask: k as Uint8Array,
    };
    if (bundle.mask[m.baseIndex] !== 1 || bundle.outboundMinutes[m.baseIndex] !== 0 || bundle.returnMinutes[m.baseIndex] !== 0)
      throw new Error('Base index / distance invariant failed');
    for (let i = 0; i < bundle.mask.length; i++) {
      if (![0, 1, 2].includes(bundle.mask[i])) throw new Error('Unknown mask code');
      if (Number.isNaN(bundle.outboundMinutes[i]) || Number.isNaN(bundle.returnMinutes[i]) ||
          bundle.outboundMinutes[i] < 0 || bundle.returnMinutes[i] < 0 ||
          bundle.outboundParents[i] < -1 || bundle.outboundParents[i] >= bundle.mask.length ||
          bundle.returnNext[i] < -1 || bundle.returnNext[i] >= bundle.mask.length)
        throw new Error(`Invalid cost or pointer at node ${i}`);
    }
    if (m.status === 'DEMO_SYNTHETIC')
      return { state: 'DEMO', message: 'Synthetic acceptance-test scene. NOT Mars data.', bundle };
    if (m.status === 'VERIFIED' && m.coordinateFrameVerified === true && m.challengeResourceQualified === true &&
        m.sourceUrl.startsWith('https://'))
      return { state: 'VERIFIED', message: 'Bundle integrity and declared evidence gates passed; inspect source ledger.', bundle };
    return { state: 'SOURCE_REVIEW_REQUIRED', message: 'Compiled terrain found; source and coordinates still need independent review.', bundle };
  } catch (error) {
    return { state: 'CORRUPT', message: `Data validation failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}
