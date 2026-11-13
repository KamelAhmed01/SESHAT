/** Shared domain contract, section 8.3 of the execution book. */
export type EvidenceStatus = 'VERIFIED_POINT' | 'APPROXIMATE_REGION' | 'USER_SELECTED';
export type FeasibilityState = 'ROBUST' | 'MARGINAL' | 'INFEASIBLE' | 'UNKNOWN';
export type AnalysisStatus = 'READY' | 'MISSING_INPUT' | 'INVALID_GEOMETRY' | 'NO_SUPPORTED_PATH';
export type SpeedFactor = 0.8 | 1 | 1.2;
export const SPEED_FACTORS: readonly SpeedFactor[] = [0.8, 1, 1.2] as const;

export interface EvidenceReference {
  title: string;
  url: string;
  sourceId: string;
  claimSupported: string;
}
export interface ScienceTarget {
  id: string;
  name: string;
  location: {
    originalCoordinateText: string;
    coordinateFrame: string;
    gridRow: number | null;
    gridCol: number | null;
    confidence: EvidenceStatus;
    locationSource: string | null;
  };
  objectiveTags: string[];
  science: {
    summary: string;
    sourceIds: string[];
    evidence: EvidenceReference[];
    limitations: string[];
  };
  activity: { minutes: number; basis: 'SOURCE_BACKED' | 'SCENARIO_ASSUMPTION'; sourceId?: string };
}
export interface MissionScenario {
  id: string;
  label: string;
  timeBudgetMinutes: number;
  elapsedMinutes: number;
  reserveMinutes: number;
  referenceSpeedMetersPerSecond: number;
  speedMultipliers: readonly [0.8, 1, 1.2];
  gradeModelId: string;
  datasetRevision: string;
}
export interface RouteSummary {
  status: AnalysisStatus;
  distanceMeters: number | null;
  nominalTravelMinutes: number | null;
  geometryGrid: Array<[number, number]>;
  sampledElevationsMeters: number[];
  unknownReason?: string;
}
export interface TargetAssessment {
  targetId: string;
  state: FeasibilityState;
  outbound: RouteSummary;
  returnRoute: RouteSummary;
  scienceMinutes: number;
  reserveMinutes: number;
  remainingMinutes: number;
  nominalMarginMinutes: number | null;
  scenarios: Array<{
    factor: SpeedFactor;
    requiredMinutes: number | null;
    marginMinutes: number | null;
    feasible: boolean | null;
  }>;
  reasonCode: 'FEASIBLE_ALL' | 'SPEED_SENSITIVE' | 'TIME_EXCEEDED' | 'HARD_CONSTRAINT' | 'MISSING_DATA';
}
