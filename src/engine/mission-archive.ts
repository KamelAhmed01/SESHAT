import type { DatasetManifest } from '../data/loader';
import scenario from '../config/mission-scenario.json';
import { budget, reserve } from './consumables';
import type { MissionExecution } from './lifecycle-store';
import type { MissionPlan } from './multi-leg-planner';

export function missionClock(minutes: number) {
  if (!Number.isFinite(minutes)) return 'Unknown';
  const rounded = Math.round(minutes);
  return `T+${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function missionSequence(plan: MissionPlan) {
  return [plan.legs[0]?.from, ...plan.legs.map(leg => leg.to)].join(' → ');
}

export function createArchive(plan: MissionPlan, source: DatasetManifest, execution?: MissionExecution) {
  const {sourceId, sourceUrl, sourceFileSha256, status, optical, crsWkt, cellWidthMeters, cellHeightMeters, files} = source;
  return {
    schemaVersion: 1, scenario, budget, reserve,
    source: {sourceId, sourceUrl, sourceFileSha256, status, optical, crsWkt, cellWidthMeters, cellHeightMeters, files},
    baseline: plan, execution,
  };
}

function escapeTable(text: string) {
  return text.replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
}

export function archiveMarkdown(archive: ReturnType<typeof createArchive>) {
  const {baseline, execution, source} = archive;
  const lines = ['# SESHAT mission plan', '', 'Research prototype. All traversal and resource values are scenario estimates.', '',
    `Terrain: ${source.sourceId} (${source.status})`, source.sourceUrl, source.optical?.sourceUrl ?? '',
    `Mission: ${baseline.stops.length === 1 ? 'Single destination' : 'Multiple destinations'}`,
    `Plan: ${missionSequence(baseline)}`, `Modeled feasibility: ${baseline.state}`, '',
    `Time / oxygen / energy budgets: ${budget.minutes} min / ${budget.oxygen} L / ${budget.energy} Wh`,
    `Required reserves: ${reserve.minutes} min / ${reserve.oxygen} L / ${reserve.energy} Wh`,
    ...Object.values(archive.scenario.environmentalContext), ''];
  const versions = [baseline, ...(execution?.decisions.filter(decision => decision.kind !== 'held').map(decision => decision.plan) ?? [])];
  for (const [index, plan] of versions.entries()) {
    lines.push(`## ${index === 0 ? 'Approved baseline' : `Approved revision ${index}`}`, '', missionSequence(plan), '',
      '| Destination | Depart | Arrive | Finish activity | Distance | Peak grade | Oxygen / energy |',
      '| --- | --- | --- | --- | --- | --- | --- |');
    for (const leg of plan.legs) {
      lines.push(`| ${escapeTable(leg.to)} | ${missionClock(leg.departure)} | ${missionClock(leg.arrival)} | ${missionClock(leg.leave)} | ${leg.terrain.distance.toFixed(0)} m | ${leg.terrain.peakSlope.toFixed(1)}° | ${leg.used.oxygen.toFixed(1)} L / ${leg.used.energy.toFixed(1)} Wh |`);
    }
    lines.push('', ...plan.legs.flatMap(leg => leg.waypoints.map(waypoint =>
      `- Contingency stop on leg to ${leg.to} at (${waypoint.cell.join(', ')}) · ${waypoint.slope.toFixed(1)}° local slope · ${waypoint.returnMinutes.toFixed(1)} min modeled direct return at conservative speed.`)));
    for (const stop of plan.stops) {
      lines.push('', `### ${stop.name}`, stop.science.summary, stop.location.originalCoordinateText, ...stop.science.limitations,
        ...stop.science.evidence.map(evidence => `- ${evidence.title} · ${evidence.url}`));
    }
    lines.push('', ...plan.margins.map(({speed, margin}) => margin
      ? `- ${speed}× margins above reserves: ${margin.minutes.toFixed(1)} min / ${margin.oxygen.toFixed(1)} L / ${margin.energy.toFixed(1)} Wh`
      : `- ${speed}× margins: unknown`), '');
  }
  if (execution) {
    lines.push('## Mission history', '', `Status: ${execution.status}`, `Elapsed: ${missionClock(execution.spent.minutes)}`,
      `Spent: ${execution.spent.oxygen.toFixed(1)} L oxygen / ${execution.spent.energy.toFixed(1)} Wh`,
      `Completed stops: ${execution.completed.join(', ') || 'None'}`, '',
      ...execution.events.map(event => `- ${missionClock(event.minute)} · ${event.channel} · ${event.category} · ${event.description || 'Event recorded'} · (${event.cell.join(', ')})`),
      ...execution.decisions.map(decision => `- ${missionClock(decision.minute)} · ${decision.kind} · ${missionSequence(decision.plan)}`),
      '', 'The JSON archive includes grid geometry and complete event measurements.');
  }
  return lines.join('\n') + '\n';
}
