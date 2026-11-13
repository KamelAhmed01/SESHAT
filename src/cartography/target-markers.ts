/** Cartographic pin contract: approximate geology NEVER becomes an exact map pin. */
import type { OpportunityEntry } from '../engine/opportunity-ledger';
import type { FeasibilityState } from '../engine/types';
import { gridToViewer } from './coordinates';

export interface TargetMarker {
  id: string;
  title: string;
  row: number;
  col: number;
  viewerLatitude: number;
  viewerLongitude: number;
  state: FeasibilityState;
}

export function targetMarkers(entries: readonly OpportunityEntry[], height: number, width: number): TargetMarker[] {
  return entries.flatMap(entry => {
    const { gridRow: row, gridCol: col, confidence } = entry.target.location;
    if (confidence === 'APPROXIMATE_REGION' || row === null || col === null ||
      !Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || col < 0 || row >= height || col >= width) return [];
    const [viewerLatitude, viewerLongitude] = gridToViewer(row, col, height);
    return [{ id: entry.target.id, title: entry.target.name, row, col,
      viewerLatitude, viewerLongitude, state: entry.current.state }];
  });
}
