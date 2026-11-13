import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import type { DatasetManifest, FieldBundle } from '@/data/loader';
import { budget, reserve, subtractResources } from '@/engine/consumables';
import type { Resources } from '@/engine/consumables';
import { missionClock, missionSequence } from '@/engine/mission-archive';
import { landingId } from '@/engine/multi-leg-planner';
import type { MissionPlan } from '@/engine/multi-leg-planner';
import { stateLabel } from '@/engine/formatting';

const resourceLabels = {
  minutes: ['Time', 'min'], oxygen: ['Oxygen', 'L'], energy: ['Battery', 'Wh'],
} as const;
const resources = Object.keys(resourceLabels) as (keyof Resources)[];

export function marginText(margin: Resources | null) {
  return margin ? resources.map(key => `${margin[key] >= 0 ? '+' : ''}${margin[key].toFixed(1)} ${resourceLabels[key][1]}`).join(' / ') : 'Unknown';
}

export function nominalMargin(plan: MissionPlan) {
  return plan.margins.find(({speed}) => speed === 1)?.margin ?? null;
}

export function TwinStatusCards({plan, spent}: {plan?: MissionPlan | null; spent: Resources}) {
  const plannedEnergy = plan?.used?.energy ?? 0;
  const committedEnergy = spent.energy + plannedEnergy;
  const availableEnergyPct = Math.max(0, Math.min(100, Math.round(((budget.energy - committedEnergy) / budget.energy) * 100)));
  const margin = plan ? nominalMargin(plan) : null;
  const usableBudgetMin = Math.max(1, budget.minutes - reserve.minutes);
  const healthRatio = margin
    ? Math.max(0, Math.min(1, margin.minutes / usableBudgetMin))
    : Math.max(0, Math.min(1, (usableBudgetMin - spent.minutes) / usableBudgetMin));
  const healthScore = (healthRatio * 10).toFixed(2);
  const healthPct = Math.max(8, Math.round(healthRatio * 100));

  return (
    <div className="cc-gauges-row">
      <div className="cc-card cc-gauge-card">
        <span className="cc-gauge-label">Battery level</span>
        <div className="cc-gauge-value-row">
          <strong className="cc-gauge-big">{availableEnergyPct}%</strong>
          <div className="cc-pill-track" aria-hidden="true">
            <div className="cc-pill-fill cc-pill-emerald" style={{width: `${availableEnergyPct}%`}} />
          </div>
        </div>
        <small className="cc-gauge-sub">
          {committedEnergy.toFixed(0)} / {budget.energy} Wh · {reserve.energy} Wh reserve
        </small>
      </div>
      <div className="cc-card cc-gauge-card">
        <span className="cc-gauge-label">Margin &amp; reserve index</span>
        <div className="cc-gauge-value-row">
          <strong className="cc-gauge-big">{margin ? (margin.minutes >= 0 ? healthScore : '0.00') : healthScore}</strong>
          <div className="cc-pill-track" aria-hidden="true">
            <div className="cc-pill-fill cc-pill-spectrum" style={{width: `${healthPct}%`}} />
          </div>
        </div>
        <small className="cc-gauge-sub">
          {margin
            ? `${margin.minutes >= 0 ? '+' : ''}${margin.minutes.toFixed(1)} min · ${margin.oxygen >= 0 ? '+' : ''}${margin.oxygen.toFixed(0)} L O₂ margin`
            : `${(budget.oxygen - spent.oxygen).toFixed(0)} L O₂ · ${(budget.minutes - spent.minutes).toFixed(0)} min window`}
        </small>
      </div>
    </div>
  );
}

interface DonutSlice {
  label: string;
  pct: number;
  color: string;
}

function DonutChart({slices, title}: {slices: DonutSlice[]; title: string}) {
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<{label: string; color: string; len: number; dashOffset: number; end: number}[]>((acc, slice) => {
    const start = acc.at(-1)?.end ?? 0;
    const len = (Math.max(0, slice.pct) / 100) * circumference;
    acc.push({label: slice.label, color: slice.color, len, dashOffset: -start, end: start + len});
    return acc;
  }, []);

  return (
    <div className="cc-donut-block">
      <div className="cc-donut-title">{title}</div>
      <div className="cc-donut-body">
        <svg className="cc-donut-svg" viewBox="0 0 80 80" role="img" aria-label={title}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#2d2925" strokeWidth="11" />
          {segments.map(seg => {
            if (seg.len <= 0.1) return null;
            return (
              <circle
                key={seg.label}
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="11"
                strokeDasharray={`${seg.len} ${circumference}`}
                strokeDashoffset={seg.dashOffset}
                transform="rotate(-90 40 40)"
              />
            );
          })}
        </svg>
        <div className="cc-donut-legend">
          {slices.map(slice => (
            <div key={slice.label} className="cc-legend-item">
              <span className="cc-legend-dot" style={{backgroundColor: slice.color}} aria-hidden="true" />
              <span className="cc-legend-label">{slice.label}</span>
              <strong className="cc-legend-pct">{Math.round(slice.pct)}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalysisDonutRings({bundle, plan, spent}: {bundle: FieldBundle; plan?: MissionPlan | null; spent: Resources}) {
  const terrainSlices = useMemo<DonutSlice[]>(() => {
    const mask = bundle.mask;
    const z = bundle.elevationMeters;
    const total = Math.max(1, mask.length);
    let validCount = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1 && Number.isFinite(z[i])) {
        validCount++;
        if (z[i] < minZ) minZ = z[i];
        if (z[i] > maxZ) maxZ = z[i];
      }
    }
    const span = Math.max(1, maxZ - minZ);
    const t1 = minZ + span * 0.33;
    const t2 = minZ + span * 0.66;
    let low = 0, mid = 0, high = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] !== 1 || !Number.isFinite(z[i])) continue;
      if (z[i] < t1) low++;
      else if (z[i] < t2) mid++;
      else high++;
    }
    const nodata = Math.max(0, total - validCount);
    return [
      {label: 'NoData mask', pct: (nodata / total) * 100, color: '#e74c3c'},
      {label: 'Low bench', pct: (low / total) * 100, color: '#e67e22'},
      {label: 'Mid fan', pct: (mid / total) * 100, color: '#f1c40f'},
      {label: 'High scarp', pct: (high / total) * 100, color: '#10b981'},
    ];
  }, [bundle]);

  const budgetSlices = useMemo<DonutSlice[]>(() => {
    const total = budget.minutes;
    if (!plan || !plan.used) {
      const elapsedPct = Math.min(100, (spent.minutes / total) * 100);
      const reservePct = (reserve.minutes / total) * 100;
      const openPct = Math.max(0, 100 - elapsedPct - reservePct);
      return [
        {label: 'Elapsed', pct: elapsedPct, color: '#e74c3c'},
        {label: 'Travel', pct: 0, color: '#e67e22'},
        {label: 'Reserve', pct: reservePct, color: '#f1c40f'},
        {label: 'Open budget', pct: openPct, color: '#10b981'},
      ];
    }
    const scienceMin = plan.stops.reduce((acc, s) => acc + s.activity.minutes, 0);
    const returnLeg = plan.legs.find(l => l.targetId === landingId);
    const returnMin = returnLeg && Number.isFinite(returnLeg.arrival - returnLeg.departure)
      ? Math.max(0, returnLeg.arrival - returnLeg.departure) : 0;
    const outboundMin = Math.max(0, plan.used.minutes - scienceMin - returnMin);
    const remainingMin = Math.max(0, total - spent.minutes - plan.used.minutes);
    return [
      {label: 'Outbound', pct: ((spent.minutes + outboundMin) / total) * 100, color: '#e74c3c'},
      {label: 'Fieldwork', pct: (scienceMin / total) * 100, color: '#f1c40f'},
      {label: 'Return leg', pct: (returnMin / total) * 100, color: '#e67e22'},
      {label: 'Margin + rsv', pct: (remainingMin / total) * 100, color: '#10b981'},
    ];
  }, [plan, spent]);

  return (
    <div className="cc-donuts-wrap">
      <div className="cc-donuts-header">
        <h3>Terrain &amp; budget analysis</h3>
      </div>
      <DonutChart slices={budgetSlices} title={`Traverse allocation · ${budget.minutes} min window`} />
      <DonutChart slices={terrainSlices} title={`CTX DEM relief & mask · ${bundle.manifest.width}×${bundle.manifest.height}`} />
    </div>
  );
}

function ResourceGauges({used, spent}: {used: Resources | null; spent: Resources}) {
  const remaining = subtractResources(budget, spent);
  return <div className="mission-gauges">
    {resources.map(key => {
      const [label, unit] = resourceLabels[key];
      const planned = used && used[key];
      return <div key={key}>
        <div><span>{label}</span><strong>{planned === null ? 'Unknown' : `${planned.toFixed(1)} ${unit} planned`}</strong></div>
        <progress max={budget[key]} value={planned === null ? 0 : Math.min(budget[key], spent[key] + planned)} aria-label={`${label} used and planned`}/>
        <small>{remaining[key].toFixed(1)} {unit} available · {reserve[key]} {unit} reserve
          {planned !== null && ` · ${Math.round(planned / budget[key] * 100)}% of starting budget planned`}</small>
      </div>;
    })}
  </div>;
}

export function MissionPlanPreview({plan, spent, manifest, label}: {
  plan: MissionPlan; spent: Resources; manifest: DatasetManifest; label: string;
}) {
  return <div className="mission-preview">
    <div className="section-heading"><span>{label}</span><span className={`opportunity-status op-${plan.state.toLowerCase()}`}>{stateLabel(plan.state)}</span></div>
    <p className="mission-sequence">{missionSequence(plan)}</p>
    <ResourceGauges used={plan.used} spent={spent}/>
    <details className="mission-disclosure">
      <summary>Return margins at three speeds</summary>
      <dl className="mission-margins">{plan.margins.map(({speed, margin}) =>
        <div key={speed}><dt>{speed}×</dt><dd>{marginText(margin)}</dd></div>)}</dl>
    </details>
    <ol className="mission-schedule">
      {plan.legs.map((leg, i) => <li key={leg.targetId}>
        <details className="mission-disclosure">
          <summary><span>{i + 1}. {leg.to}</span><span>{missionClock(leg.arrival)}</span></summary>
          {leg.route.status === 'READY' ? <>
            <p>{missionClock(leg.departure)} departure · {(leg.arrival - leg.departure).toFixed(1)} min travel · {missionClock(leg.leave)} activity complete</p>
            <p>{leg.terrain.distance.toFixed(0)} m · +{leg.terrain.gain.toFixed(0)} / −{leg.terrain.loss.toFixed(0)} m elevation · {leg.terrain.peakSlope.toFixed(1)}° peak / {leg.terrain.meanSlope.toFixed(1)}° mean</p>
            <p>{leg.terrain.steepEdges} modeled edges over 15° · {leg.used.oxygen.toFixed(1)} L O₂ · {leg.used.energy.toFixed(1)} Wh</p>
            {!leg.waypoints.length && <p>No qualifying contingency stop on this leg.</p>}
            {leg.waypoints.map(waypoint => <p key={waypoint.cell.join(',')}>Contingency stop ({waypoint.cell.join(', ')}) · {waypoint.slope.toFixed(1)}° local slope · {waypoint.returnMinutes.toFixed(1)} min direct return at 0.8×. Outdoor waypoint.</p>)}
            <ElevationProfile route={leg.route} cellWidthMeters={manifest.cellWidthMeters} cellHeightMeters={manifest.cellHeightMeters} label={leg.to} />
          </> : <p>{leg.route.unknownReason}</p>}
        </details>
      </li>)}
    </ol>
  </div>;
}

export function PlanComparison({previous, proposed, label, action, onChoose}: {
  previous: MissionPlan; proposed: MissionPlan; label: string; action?: string; onChoose?: () => void;
}) {
  return <div className="mission-comparison">
    <div><small>{label}</small><p>{missionSequence(previous)}</p><p>{marginText(nominalMargin(previous))}</p></div>
    <div><small>Proposed</small><p>{missionSequence(proposed)}</p><p>{marginText(nominalMargin(proposed))}</p></div>
    {action && <Button label={action} onClick={onChoose}/>}
  </div>;
}
