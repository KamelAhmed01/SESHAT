import type { TargetAssessment } from './types';
import { minutesText } from './formatting';
export function explainDelay(previous: TargetAssessment | null, next: TargetAssessment | null): string {
  if (!previous || !next) return 'A source-verified location is needed before the model can explain a change.';
  if (previous.state === 'UNKNOWN' || next.state === 'UNKNOWN') return 'The terrain or target evidence is insufficient to calculate a reliable time margin.';
  const before = previous.nominalMarginMinutes;
  const after = next.nominalMarginMinutes;
  if (before === null || after === null) return 'The mission time margin is currently unavailable.';
  const delta = before - after;
  return `The departure delay reduced nominal headroom by ${minutesText(delta)}. ${
    previous.state === next.state ? `The classification remains ${next.state.toLowerCase()}.` :
      `The classification changed from ${previous.state.toLowerCase()} to ${next.state.toLowerCase()}.`
  }`;
}
