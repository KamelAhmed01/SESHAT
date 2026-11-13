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
