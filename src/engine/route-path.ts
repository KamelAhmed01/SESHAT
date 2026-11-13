export interface ReconstructedPath { status: 'READY' | 'UNKNOWN'; indices: number[]; reason?: string }

/** Parent chains from base to destination, stored as parent[node] nearer the base. */
export function reconstructOutbound(parents: Int32Array, baseIndex: number, destination: number): ReconstructedPath {
  return walkPointers(parents, destination, baseIndex, true);
}
/** Return-next chains from current cell towards base on the original directed graph. */
export function reconstructReturn(next: Int32Array, baseIndex: number, fromIndex: number): ReconstructedPath {
  return walkPointers(next, fromIndex, baseIndex, false);
}
function walkPointers(pointers: Int32Array, from: number, to: number, reverse: boolean): ReconstructedPath {
  const n = pointers.length;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= n || to >= n)
    return { status: 'UNKNOWN', indices: [], reason: 'Out of range endpoint' };
  const indices: number[] = [];
  const seen = new Set<number>();
  let node = from;
  for (let count = 0; count <= n; count++) {
    if (seen.has(node)) return { status: 'UNKNOWN', indices: [], reason: 'Pointer cycle detected' };
    seen.add(node); indices.push(node);
    if (node === to) return { status: 'READY', indices: reverse ? indices.reverse() : indices };
    node = pointers[node];
    if (!Number.isInteger(node) || node < 0 || node >= n)
      return { status: 'UNKNOWN', indices: [], reason: 'Unreachable or corrupt pointer' };
  }
  return { status: 'UNKNOWN', indices: [], reason: 'Path exceeds grid length' };
}
