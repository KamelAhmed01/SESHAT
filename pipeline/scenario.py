"""Canonical scenario shared with the browser; assumptions, not EVA guidance."""
from pathlib import Path
import json
from .route_fields import TerrainScenario

FILE = Path(__file__).resolve().parents[1] / 'src/config/mission-scenario.json'


def load_scenario() -> dict:
    data = json.loads(FILE.read_text())
    expected = ['timeBudgetMinutes', 'reserveMinutes', 'defaultScienceMinutes',
                'referenceSpeedMetersPerSecond', 'speedMultipliers',
                'uphillCoefficient', 'downhillCoefficient', 'maxSlopeDegrees',
                'connectivity', 'evidenceStatus']
    if any(key not in data for key in expected):
        raise ValueError('Mission scenario is missing a required parameter')
    if (data['evidenceStatus'] != 'SCENARIO_ASSUMPTION' or
        data['timeBudgetMinutes'] <= data['reserveMinutes'] or
        data['referenceSpeedMetersPerSecond'] <= 0 or
        data['speedMultipliers'] != [0.8, 1.0, 1.2] or
        data['connectivity'] not in (4, 8)):
        raise ValueError('Mission scenario outside the validated research contract')
    return data


def load_terrain_model() -> TerrainScenario:
    d = load_scenario()
    return TerrainScenario(
        model_id=d['gradeModelId'],
        reference_speed_mps=d['referenceSpeedMetersPerSecond'],
        uphill_coefficient=d['uphillCoefficient'],
        downhill_coefficient=d['downhillCoefficient'],
        max_slope_degrees=d['maxSlopeDegrees'],
        connectivity=d['connectivity'],
        evidence_status=d['evidenceStatus'],
    )
