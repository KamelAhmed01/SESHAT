import { Button } from '@astryxdesign/core/Button';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import type { DatasetManifest } from '@/data/loader';
import { budget, reserve, subtractResources } from '@/engine/consumables';
import type { Resources } from '@/engine/consumables';
import { missionClock, missionSequence } from '@/engine/mission-archive';
import type { MissionPlan } from '@/engine/multi-leg-planner';
import { stateLabel } from '@/engine/formatting';

const resourceLabels = {
  minutes: ['Time', 'min'], oxygen: ['Oxygen', 'L'], energy: ['Battery', 'Wh'],
} as const;
const resources = Object.keys(resourceLabels) as (keyof Resources)[];

export function marginText(margin: Resources | null) {
  return margin ? resources.map(key => `${margin[key] >= 0 ? '+' : ''}${margin[key].toFixed(1)} ${resourceLabels[key][1]}`).join(' / ') : 'Unknown';
}

export function conservativeSummary(plan: MissionPlan | null | undefined) {
  if (!plan) return null;
  const conservative = plan.margins.find(({ speed }) => speed === 0.8)?.margin ?? plan.margins[0]?.margin ?? null;
  if (!conservative) return { margin: null, limitingLabel: 'Unknown', limitingText: 'Unknown margin' };
  const usable = subtractResources(budget, reserve);
  const candidates = [
    { label: 'Time', ratio: conservative.minutes / Math.max(1, usable.minutes), text: `${conservative.minutes >= 0 ? '+' : ''}${conservative.minutes.toFixed(1)} min` },
    { label: 'Oxygen', ratio: conservative.oxygen / Math.max(1, usable.oxygen), text: `${conservative.oxygen >= 0 ? '+' : ''}${conservative.oxygen.toFixed(1)} L` },
    { label: 'Battery', ratio: conservative.energy / Math.max(1, usable.energy), text: `${conservative.energy >= 0 ? '+' : ''}${conservative.energy.toFixed(1)} Wh` },
  ].sort((a, b) => a.ratio - b.ratio);
  return {
    margin: conservative,
    limitingLabel: candidates[0].label,
    limitingText: candidates[0].text,
    fullText: marginText(conservative),
  };
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

export function PlanComparison({previous, proposed, label, action, onChoose, speed = 1}: {
  previous: MissionPlan; proposed: MissionPlan; label: string; action?: string; onChoose?: () => void; speed?: number;
}) {
  const marginAtPace = (plan: MissionPlan) => plan.margins.find(entry => entry.speed === speed)?.margin ?? null;
  return <div className="mission-comparison">
    <div><small>{label}</small><p>{missionSequence(previous)}</p><p>{marginText(marginAtPace(previous))} at {speed}×</p></div>
    <div><small>Proposed</small><p>{missionSequence(proposed)}</p><p>{marginText(marginAtPace(proposed))} at {speed}×</p></div>
    {action && <Button label={action} onClick={onChoose}/>}
  </div>;
}
