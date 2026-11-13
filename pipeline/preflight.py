"""Evidence-honest science target travel/reachability preflight.

Computes lower-bound flat roundtrip and actual nominal directed graph times,
never confusing a source-backed name with reachability or verified science.

    python -m pipeline.preflight --bundle public/data
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import numpy as np
from .scenario import load_scenario


def travel_preflight(manifest: dict, outbound: np.ndarray, returns: np.ndarray,
                     cfg: dict | None = None) -> list[dict]:
    cfg = cfg or load_scenario()
    height, width = manifest['height'], manifest['width']
    size = height * width
    if outbound.size != size or returns.size != size:
        raise ValueError('Route file cell count differs from manifest')
    br, bc = divmod(int(manifest['baseIndex']), width)
    if not 0 <= br < height:
        raise ValueError('Base index outside grid')
    dx, dy = float(manifest['cellWidthMeters']), float(manifest['cellHeightMeters'])
    speed = float(cfg['referenceSpeedMetersPerSecond'])
    maximum = max(cfg['speedMultipliers'])
    available = float(cfg['timeBudgetMinutes']) - float(cfg['reserveMinutes'])
    if speed <= 0 or dx <= 0 or dy <= 0 or available < 0:
        raise ValueError('Invalid scenario/metric grid')
    results=[]
    for target in manifest.get('scienceTargets',[]):
        loc = target['location']
        row, col = loc.get('gridRow'), loc.get('gridCol')
        science = float(target['activity']['minutes'])
        entry={'id':target['id'],'name':target['name'],'confidence':loc['confidence'],
               'activityMinutes':science, 'minutesAvailableAfterReserveAndScience':available-science,
               'straightLineDistanceMeters':None, 'optimisticRoundtripMinutes':None,
               'modeledRoundtripMinutes':None,'assessment':'LOCATION_UNKNOWN'}
        if row is None or col is None:
            results.append(entry);continue
        if not (0 <= row < height and 0 <= col < width):
            raise ValueError('Target outside analysis grid: ' + target['id'])
        distance=math.hypot((row-br)*dy,(col-bc)*dx)
        # Optimistic no-slope shortest direct line at the FASTEST modeled speed.
        # This is a logical impossibility screen, not a proof of feasibility.
        lower=2*distance/(speed*maximum*60.0)
        idx=row*width+col
        entry.update(straightLineDistanceMeters=round(distance,2),
                     optimisticRoundtripMinutes=round(lower,2))
        if loc.get('confidence')=='APPROXIMATE_REGION':
            entry['assessment']='LOCATION_UNKNOWN'
        elif lower > available-science:
            entry['assessment']='IMPOSSIBLE_EVEN_WITH_OPTIMISTIC_FLAT_ROUTE'
        elif np.isfinite(outbound[idx]) and np.isfinite(returns[idx]):
            total=float(outbound[idx]+returns[idx])
            entry['modeledRoundtripMinutes']=round(total,2)
            required=total/maximum+science
            entry['assessment']='POSSIBLE_AT_TESTED_MAX_SPEED' if required <= available else 'MODELED_TRAVEL_EXCEEDS_WINDOW'
        else:
            entry['assessment']='MODEL_ROUTE_UNKNOWN_OR_BLOCKED'
        results.append(entry)
    return results


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle', type=Path, default=Path('public/data'))
    p.add_argument('--output', type=Path, help='Optional JSON report for docs/data-review')
    a=p.parse_args()
    m=json.loads((a.bundle/'manifest.json').read_text())
    if m['status']=='DEMO_SYNTHETIC':
        print('WARNING: SYNTHETIC preflight only; not scientific Mars targets.')
    count=m['width']*m['height']
    output=travel_preflight(m,np.fromfile(a.bundle/'outbound-costs.bin',dtype='<f8'),
                            np.fromfile(a.bundle/'return-costs.bin',dtype='<f8'))
    print(json.dumps({'scenarioAssumptions':load_scenario(),'targetPreflight':output},indent=2))
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(json.dumps({'targetPreflight':output,'status':m['status']},indent=2)+'\n')

if __name__=='__main__':
    main()
