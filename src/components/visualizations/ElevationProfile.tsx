import type { RouteSummary } from '@/engine/types';
import { elevationProfile, plotVertices } from '@/engine/elevation-profile';

function formatMeters(n: number): string { return `${Math.round(n).toLocaleString('en-US')} m`; }

export function ElevationProfile({ route, cellWidthMeters, cellHeightMeters, label }: {
  route: RouteSummary;
  cellWidthMeters: number;
  cellHeightMeters: number;
  label: string;
}) {
  const profile = elevationProfile(route, cellWidthMeters, cellHeightMeters);
  if (!profile) return null;
  const { minimumMeters: min, maximumMeters: max, horizontalDistanceMeters: distance } = profile;
  const range = Math.max(max - min, 1);
  const plot = plotVertices(profile).map(p => ({
    x: 8 + p.distanceMeters / Math.max(distance, 1) * 304,
    y: 89 - (p.elevationMeters - min) / range * 75,
  }));
  const line = plot.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${plot.at(-1)!.x.toFixed(2)},92 L8,92 Z`;
  return <section className="profile-chart" aria-label={`${label} elevation profile`}>
    <div className="profile-heading"><strong>{label}</strong><span>{formatMeters(distance)} traverse</span></div>
    <svg viewBox="0 0 320 104" role="img" aria-label={`${label}: elevation varies from ${formatMeters(min)} to ${formatMeters(max)}; total ascent ${formatMeters(profile.ascentMeters)}.`}>
      <line x1="8" y1="92" x2="312" y2="92" stroke="#657070" strokeWidth="0.8" />
      <line x1="8" y1="52" x2="312" y2="52" stroke="#3a484a" strokeWidth="0.7" strokeDasharray="4 5" />
      <path d={area} fill="#d49c7840" />
      <path d={line} fill="none" stroke="#ddb18e" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      {plot.length === 1 && <circle cx={plot[0].x} cy={plot[0].y} r="2.5" fill="#ddb18e" />}
      <text x="8" y="102" fill="#98aaa5" fontSize="8">0 km</text>
      <text x="312" y="102" fill="#98aaa5" fontSize="8" textAnchor="end">{(distance / 1000).toFixed(2)} km</text>
    </svg>
    <div className="profile-metrics"><span>↑ {formatMeters(profile.ascentMeters)} ascent</span><span>↓ {formatMeters(profile.descentMeters)} descent</span><span>Δ {formatMeters(profile.netChangeMeters)} net</span></div>
  </section>;
}
