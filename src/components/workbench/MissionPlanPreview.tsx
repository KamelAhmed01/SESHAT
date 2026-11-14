'use client';

import { Badge } from '@astryxdesign/core/Badge';
import type { BadgeVariant } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { ElevationProfile } from '@/components/visualizations/ElevationProfile';
import type { DatasetManifest } from '@/data/loader';
import { budget, reserve, subtractResources } from '@/engine/consumables';
import type { Resources } from '@/engine/consumables';
import { missionClock, missionSequence } from '@/engine/mission-archive';
import type { MissionPlan } from '@/engine/multi-leg-planner';
import { stateLabel } from '@/engine/formatting';
import type { FeasibilityState } from '@/engine/types';

const resourceLabels = {
  minutes: ['Time', 'min'],
  oxygen: ['Oxygen', 'L'],
  energy: ['Battery', 'Wh'],
} as const;
const resources = Object.keys(resourceLabels) as (keyof Resources)[];

export function stateBadgeVariant(state: FeasibilityState): BadgeVariant {
  switch (state) {
    case 'ROBUST':
      return 'success';
    case 'MARGINAL':
      return 'warning';
    case 'INFEASIBLE':
      return 'error';
    default:
      return 'neutral';
  }
}

export function marginText(margin: Resources | null) {
  return margin
    ? resources.map(key => `${margin[key] >= 0 ? '+' : ''}${margin[key].toFixed(1)} ${resourceLabels[key][1]}`).join(' / ')
    : 'Unknown';
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

function ResourceGauges({ used, spent }: { used: Resources | null; spent: Resources }) {
  const remaining = subtractResources(budget, spent);
  return (
    <div className="mission-gauges">
      {resources.map(key => {
        const [label, unit] = resourceLabels[key];
        const planned = used && used[key];
        const totalCommitted = planned === null ? 0 : Math.min(budget[key], spent[key] + planned);
        const usableLimit = Math.max(0, budget[key] - reserve[key]);
        const variant = planned === null
          ? 'neutral'
          : totalCommitted > usableLimit
            ? 'error'
            : totalCommitted > usableLimit * 0.85
              ? 'warning'
              : 'accent';

        return (
          <div key={key} className="mission-gauge-item">
            <ProgressBar
              label={label}
              value={totalCommitted}
              max={budget[key]}
              variant={variant}
              hasValueLabel
              formatValueLabel={() => (planned === null ? 'Unknown' : `${planned.toFixed(1)} ${unit} planned`)}
              marks={[
                {
                  value: usableLimit,
                  label: `Reserve floor: ${reserve[key]} ${unit} held back`,
                },
              ]}
            />
            <small>
              {remaining[key].toFixed(1)} {unit} available · {reserve[key]} {unit} reserve
              {planned !== null && ` · ${Math.round((planned / budget[key]) * 100)}% of starting budget planned`}
            </small>
          </div>
        );
      })}
    </div>
  );
}

export function MissionPlanPreview({ plan, spent, manifest, label }: {
  plan: MissionPlan;
  spent: Resources;
  manifest: DatasetManifest;
  label: string;
}) {
  return (
    <div className="mission-preview">
      <div className="section-heading">
        <span>{label}</span>
        <Badge variant={stateBadgeVariant(plan.state)} label={stateLabel(plan.state)} />
      </div>
      <p className="mission-sequence">{missionSequence(plan)}</p>
      <ResourceGauges used={plan.used} spent={spent} />
      <Collapsible
        className="mission-disclosure"
        defaultIsOpen={false}
        chevronPosition="end"
        trigger="Return margins at three speeds"
      >
        <dl className="mission-margins">
          {plan.margins.map(({ speed, margin }) => (
            <div key={speed}>
              <dt>{speed}×</dt>
              <dd>{marginText(margin)}</dd>
            </div>
          ))}
        </dl>
      </Collapsible>
      <ol className="mission-schedule">
        {plan.legs.map((leg, i) => (
          <li key={leg.targetId}>
            <Collapsible
              className="mission-disclosure"
              defaultIsOpen={false}
              chevronPosition="end"
              trigger={
                <span className="mission-leg-trigger">
                  <span>{i + 1}. {leg.to}</span>
                  <span>{missionClock(leg.arrival)}</span>
                </span>
              }
            >
              {leg.route.status === 'READY' ? (
                <>
                  <p>{missionClock(leg.departure)} departure · {(leg.arrival - leg.departure).toFixed(1)} min travel · {missionClock(leg.leave)} activity complete</p>
                  <p>{leg.terrain.distance.toFixed(0)} m · +{leg.terrain.gain.toFixed(0)} / −{leg.terrain.loss.toFixed(0)} m elevation · {leg.terrain.peakSlope.toFixed(1)}° peak / {leg.terrain.meanSlope.toFixed(1)}° mean</p>
                  <p>{leg.terrain.steepEdges} modeled edges over 15° · {leg.used.oxygen.toFixed(1)} L O₂ · {leg.used.energy.toFixed(1)} Wh</p>
                  {leg.terrain.meanThermalInertia !== null && leg.terrain.footingLabel && (
                    <p>
                      Footing: {leg.terrain.footingLabel} · {leg.terrain.meanThermalInertia.toFixed(0)} TIU mean
                      {leg.terrain.lowThermalFraction !== null && ` (${Math.round(leg.terrain.lowThermalFraction * 100)}% loose sand <200 TIU · Edwards & Buz 2021)`}
                    </p>
                  )}
                  {!leg.waypoints.length && <p>No qualifying contingency stop on this leg.</p>}
                  {leg.waypoints.map(waypoint => (
                    <p key={waypoint.cell.join(',')}>
                      Contingency stop ({waypoint.cell.join(', ')}) · {waypoint.slope.toFixed(1)}° local slope · {waypoint.returnMinutes.toFixed(1)} min direct return at 0.8×. Outdoor waypoint.
                    </p>
                  ))}
                  <ElevationProfile
                    route={leg.route}
                    cellWidthMeters={manifest.cellWidthMeters}
                    cellHeightMeters={manifest.cellHeightMeters}
                    label={leg.to}
                  />
                </>
              ) : (
                <p>{leg.route.unknownReason}</p>
              )}
            </Collapsible>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PlanComparison({ previous, proposed, label, action, onChoose, speed = 1 }: {
  previous: MissionPlan;
  proposed: MissionPlan;
  label: string;
  action?: string;
  onChoose?: () => void;
  speed?: number;
}) {
  const marginAtPace = (plan: MissionPlan) => plan.margins.find(entry => entry.speed === speed)?.margin ?? null;
  return (
    <div className="mission-comparison">
      <Card padding={2}>
        <small>{label}</small>
        <p>{missionSequence(previous)}</p>
        <p>{marginText(marginAtPace(previous))} at {speed}×</p>
      </Card>
      <Card padding={2}>
        <small>Proposed</small>
        <p>{missionSequence(proposed)}</p>
        <p>{marginText(marginAtPace(proposed))} at {speed}×</p>
      </Card>
      {action && <Button label={action} onClick={onChoose} />}
    </div>
  );
}
