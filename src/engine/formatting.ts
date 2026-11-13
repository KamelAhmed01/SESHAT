export function minutesText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unknown';
  if (value > 0 && value < 1) return '<1 min';
  if (value < 0 && value > -1) return '<1 min deficit';
  const magnitude = Math.abs(value);
  return `${Math.round(magnitude)} min${value < 0 ? ' deficit' : ''}`;
}
export function stateLabel(state: 'ROBUST' | 'MARGINAL' | 'INFEASIBLE' | 'UNKNOWN'): string {
  return ({ ROBUST: 'Robust', MARGINAL: 'Speed-sensitive', INFEASIBLE: 'Out of reach', UNKNOWN: 'Insufficient evidence' })[state];
}
