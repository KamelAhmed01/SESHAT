import type { MissionScenario, ScienceTarget, TargetAssessment } from './types';

export interface MissionBriefSource {
  status: 'VERIFIED' | 'SOURCE_REVIEW_REQUIRED' | 'DEMO_SYNTHETIC';
  sourceId: string;
  sourceUrl: string;
  modelId: string;
  width: number;
  height: number;
  cellWidthMeters: number;
  cellHeightMeters: number;
  challengeResourceQualified?: boolean;
  coordinateFrameVerified: boolean;
}

/** Plain, auditable text. The export never promotes a synthetic or unreviewed bundle. */
export function buildMissionBrief(input: {
  target: ScienceTarget;
  assessment: TargetAssessment;
  scenario: MissionScenario;
  source: MissionBriefSource;
  movementFrontierCells: number | null;
  initialFrontierCells: number | null;
}): string {
  const { target, assessment, scenario, source } = input;
  const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
  const number = (x: number | null, digits = 1) => x === null || !Number.isFinite(x) ? 'UNKNOWN' : x.toFixed(digits);
  const evidenceState = source.status === 'DEMO_SYNTHETIC' ? 'SYNTHETIC TEST FIXTURE — NOT MARS DATA' :
    source.status === 'SOURCE_REVIEW_REQUIRED' ? 'REAL-SOURCE REVIEW PENDING — PROVISIONAL' :
    'TEAM-REVIEWED SCIENTIFIC DATA — NOT NASA ENDORSEMENT';
  const rows = assessment.scenarios.map(x =>
    `| ${x.factor.toFixed(1)}× | ${number(x.requiredMinutes)} | ${number(x.marginMinutes)} | ${x.feasible === null ? 'UNKNOWN' : x.feasible ? 'Within scenario budget' : 'Over scenario budget'} |`).join('\n');
  const refs = target.science.evidence.length ? target.science.evidence.map(r =>
    `- ${clean(r.title)} — ${r.url} (supports: ${clean(r.claimSupported)})`).join('\n') :
    '- No target-specific supporting references supplied.';
  const warnings = target.science.limitations.length ? target.science.limitations.map(w => `- ${clean(w)}`).join('\n') :
    '- Regional terrain does not resolve small hazards or certify route safety.';
  return `# SESHAT / Mission opportunity brief\n\n` +
    `> **${evidenceState}**\n> Research scenario only. NOT astronaut navigation or safety guidance.\n\n` +
    `## Objective\n\n- Target: ${clean(target.name)}\n- Point classification: ${target.location.confidence}\n` +
    `- Position: ${clean(target.location.originalCoordinateText)}\n- Coordinate frame: ${clean(target.location.coordinateFrame)}\n` +
    `- Science objective: ${clean(target.science.summary)}\n\n` +
    `## Scenario and return analysis\n\n- Feasibility: **${assessment.state}** (${assessment.reasonCode})\n` +
    `- Window / elapsed / reserve: ${number(scenario.timeBudgetMinutes, 0)} / ${number(scenario.elapsedMinutes, 0)} / ${number(scenario.reserveMinutes, 0)} minutes\n` +
    `- Reference speed: ${number(scenario.referenceSpeedMetersPerSecond, 2)} m/s — scenario assumption\n` +
    `- Fieldwork: ${number(target.activity.minutes, 0)} minutes (${target.activity.basis})\n` +
    `- Outbound distance: ${number(assessment.outbound.distanceMeters)} m; time: ${number(assessment.outbound.nominalTravelMinutes)} min\n` +
    `- Return distance: ${number(assessment.returnRoute.distanceMeters)} m; time: ${number(assessment.returnRoute.nominalTravelMinutes)} min\n` +
    `- Nominal remaining margin: ${number(assessment.nominalMarginMinutes)} min\n\n` +
    `| Travel rate | Required (min) | Margin (min) | Result |\n| --- | ---: | ---: | --- |\n${rows}\n\n` +
    `## Opportunity frontier\n\n- Start: ${input.initialFrontierCells ?? 'UNKNOWN'} cells\n` +
    `- Current: ${input.movementFrontierCells ?? 'UNKNOWN'} cells\n` +
    `- Movement-only: excludes location-specific science duration.\n\n` +
    `## Data and methods\n\n- Source ID: ${clean(source.sourceId)}\n- Source link: ${source.sourceUrl}\n` +
    `- Bundle status: ${source.status}\n- Coordinate frame reviewed: ${source.coordinateFrameVerified ? 'Team attested' : 'Not reviewed'}\n` +
    `- Challenge-listed Resource verified: ${source.challengeResourceQualified ? 'Team attested' : 'Not verified'}\n` +
    `- Grid: ${source.width} × ${source.height}; nominal cell: ${number(source.cellWidthMeters)} × ${number(source.cellHeightMeters)} m\n` +
    `- Route model: ${clean(source.modelId)}; directional, graph-based return analysis.\n\n` +
    `## Scientific references\n\n${refs}\n\n## Limitations\n\n${warnings}\n` +
    `- Speed, slope coefficients, activity duration, time budget and reserve are configurable research assumptions unless explicitly source-backed.\n` +
    `- Source presence and geographic plausibility are not NASA approval, certification or endorsement.\n`;
}
