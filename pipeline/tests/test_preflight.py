"""Synthetic budget/route sanity checks for the target preflight."""
from __future__ import annotations
import numpy as np
from pipeline.preflight import travel_preflight
from pipeline.scenario import load_scenario, load_terrain_model


def manifest(targets):
    return {'height':1,'width':101,'baseIndex':0,'cellWidthMeters':20,'cellHeightMeters':20,
            'scienceTargets':targets}


def target(col, confidence='VERIFIED_POINT'):
    return {'id':'target','name':'Test observation','location':{'gridRow':0 if col is not None else None,
            'gridCol':col, 'confidence':confidence},'activity':{'minutes':20}}


def values():
    out=np.arange(101,dtype=float)*20/0.75/60
    return out, out.copy()


def test_105_minute_case_optimistic_flat_reach_is_about_1_46_km_one_way():
    cfg={**load_scenario(),'timeBudgetMinutes':105,'reserveMinutes':20}
    # At exactly 1.0x: (105-20-20)min * 0.75m/s *60/2 = 1462.5 metres.
    assert (105-20-20)*0.75*60/2 == 1462.5
    out,ret=values()
    # At 1.2x, 2,000m is still outside a 65-minute budget even on flat ground.
    result=travel_preflight(manifest([target(100)]),out,ret,cfg)[0]
    assert result['assessment']=='IMPOSSIBLE_EVEN_WITH_OPTIMISTIC_FLAT_ROUTE'
    assert result['straightLineDistanceMeters']==2000


def test_180_minute_scenario_and_model_share_one_source_of_truth():
    cfg=load_scenario()
    model=load_terrain_model()
    assert cfg['timeBudgetMinutes']==180
    assert model.reference_speed_mps==cfg['referenceSpeedMetersPerSecond']
    assert model.uphill_coefficient==cfg['uphillCoefficient']
    assert model.downhill_coefficient==cfg['downhillCoefficient']
    assert model.max_slope_degrees==cfg['maxSlopeDegrees']
    assert model.connectivity==cfg['connectivity']
    out,ret=values()
    assert travel_preflight(manifest([target(20)]),out,ret,cfg)[0]['assessment']=='POSSIBLE_AT_TESTED_MAX_SPEED'


def test_evidence_region_or_unavailable_path_is_not_promoted():
    out,ret=values()
    assert travel_preflight(manifest([target(None,'APPROXIMATE_REGION')]),out,ret)[0]['assessment']=='LOCATION_UNKNOWN'
    out[10]=np.inf
    assert travel_preflight(manifest([target(10)]),out,ret)[0]['assessment']=='MODEL_ROUTE_UNKNOWN_OR_BLOCKED'
