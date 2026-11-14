import type { FieldBundle } from '../data/loader';
import { decideReplan, recordEvent, remainingActivePlan } from './lifecycle-store';
import type { EventDetails, MissionExecution } from './lifecycle-store';
import { canApprove, planInVisitOrder } from './multi-leg-planner';
import type { MissionLeg, MissionPlan } from './multi-leg-planner';
import type { Cell } from './traverse-graph';

const edgeKey = (from: Cell, to: Cell) => `${from.join(',')}>${to.join(',')}`;

function changedSpans(before: MissionLeg, after?: MissionLeg): Cell[][] {
  const edges = new Set<string>();
  const next = after?.route.geometryGrid ?? [];
  for (let i = 1; i < next.length; i++) edges.add(edgeKey(next[i - 1], next[i]));
  const previous = before.route.geometryGrid;
  const spans: Cell[][] = [];
  let span: Cell[] = [];
  for (let i = 1; i < previous.length; i++) {
    if (edges.has(edgeKey(previous[i - 1], previous[i]))) {
      span = [];
      continue;
    }
    if (!span.length) {
      span = [previous[i - 1]];
      spans.push(span);
    }
    span.push(previous[i]);
  }
  return spans;
}

export function routeChange(before: MissionPlan, after: MissionPlan) {
  const previous = before.legs.flatMap(leg => changedSpans(leg, after.legs.find(next => next.targetId === leg.targetId)));
  const added = after.legs.flatMap(leg => changedSpans(leg, before.legs.find(prior => prior.targetId === leg.targetId)));
  return { previous, added };
}

export function recordNavigationEvent(
  mission: MissionExecution,
  bundle: FieldBundle,
  details: EventDetails,
  description: string,
) {
  const before = remainingActivePlan(mission, bundle);
  const recorded = recordEvent(mission, bundle, {details, description, channel: 'MANUAL_INPUT'});
  if (mission.activeStopId || !recorded.proposal || details.category === 'DESTINATION_ACCESSIBILITY_CHANGE' ||
      details.category === 'NEW_SCIENTIFIC_DISCOVERY') {
    return {before, execution: recorded, automatic: false};
  }
  const sameStops = planInVisitOrder({
    bundle, origin: recorded.position, stops: before.stops, spent: recorded.spent,
    hazards: recorded.hazards, speedPenalty: recorded.speedFactor, routePreference: before.routePreference,
  });
  if (!canApprove(sameStops)) {
    return {before, execution: recorded, automatic: false};
  }

  // The candidate is evaluated on the recorded state and keeps the original visit order and activity.
  return {before, execution: decideReplan({...recorded, proposal: sameStops}, sameStops, 'approved'), automatic: true};
}
