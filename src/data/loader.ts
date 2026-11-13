/** Scientific bundle validation. Never show a source as verified merely because it exists. */
export interface FileRecord { bytes: number; sha256: string; dtype: string }
export interface DatasetManifest {
  schemaVersion: '1.0.0';
  status: 'SOURCE_REVIEW_REQUIRED' | 'VERIFIED';
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
}
export interface FieldBundle {
  manifest: DatasetManifest;
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
  | { state: 'VERIFIED'; message: string; bundle: FieldBundle };

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
export async function loadScientificBundle(): Promise<BundleResult> {
  let response: Response;
  try { response = await fetch('/data/manifest.json', { cache: 'no-store' }); }
  catch { return { state: 'NO_DATA', message: 'No accepted data bundle is installed yet.' }; }
  if (!response.ok) return { state: 'NO_DATA', message: 'No accepted data bundle is installed yet.' };
  try {
    const m = await response.json() as DatasetManifest;
    if (m.schemaVersion !== '1.0.0' || !Number.isInteger(m.width) || !Number.isInteger(m.height) ||
        m.width < 2 || m.height < 2 || m.width * m.height > 250000 ||
        !Number.isInteger(m.baseIndex) || m.baseIndex < 0 || m.baseIndex >= m.width * m.height ||
        !(m.cellWidthMeters > 0) || !(m.cellHeightMeters > 0) || !m.crsWkt || !m.files || !m.imagery)
      throw new Error('Manifest fails dimension or scientific schema checks');
    const specs = [
      ['outbound-costs.bin', 'f64', 'float64'], ['return-costs.bin', 'f64', 'float64'],
      ['outbound-parents.bin', 'i32', 'int32'], ['return-next.bin', 'i32', 'int32'],
      ['elevation.bin', 'f32', 'float32'], ['validity-mask.bin', 'u8', 'uint8'],
    ] as const;
    const arrays = await Promise.all(specs.map(async ([name, kind]) => {
      const record = m.files[name];
      if (!record || record.bytes !== m.width * m.height * (kind === 'f64' ? 8 : kind === 'u8' ? 1 : 4))
        throw new Error(`Invalid file size: ${name}`);
      const r = await fetch(`/data/${name}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Missing file: ${name}`);
      const data = await r.arrayBuffer();
      if (data.byteLength !== record.bytes || await sha256Hex(data) !== record.sha256)
        throw new Error(`Hash / byte count mismatch: ${name}`);
      return readNumeric(data, kind);
    }));
    const [o, r, p, n, z, k] = arrays;
    const bundle: FieldBundle = {
      manifest: m,
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
    if (m.status === 'VERIFIED' && m.coordinateFrameVerified === true && m.challengeResourceQualified === true)
      return { state: 'VERIFIED', message: 'Source and bundle integrity gates passed.', bundle };
    return { state: 'SOURCE_REVIEW_REQUIRED', message: 'Compiled terrain found; scientific source and coordinate review still required.', bundle };
  } catch (error) {
    return { state: 'CORRUPT', message: `Data validation failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}
