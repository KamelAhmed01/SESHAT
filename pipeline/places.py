"""Report raw PDS PLACES CSV columns and enumerate candidate rover Sol rows.

The PLACES table documents *rover poses*, not exact geology-target pins.
Do not convert PDS rover-frame coordinates to Mars map cells by guessing column names.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path


def summarise(path: Path, first_sol=420, last_sol=560, limit=12) -> dict:
    with path.open('r', encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        columns = reader.fieldnames or []
        if len(columns) < 3:
            raise ValueError('Unexpected CSV structure: review PDS label and delimiter')
        sol_keys = [k for k in columns if k and (k.lower().strip() in ('sol','sol_number','mars_sol','sol_num'))]
        sampled = []
        matching_count = 0
        sol_min, sol_max = None, None
        for row in reader:
            sol = None
            for key in sol_keys:
                try:
                    sol = int(float(row[key]))
                    break
                except (ValueError, TypeError):
                    continue
            if sol is not None:
                sol_min = sol if sol_min is None else min(sol_min, sol)
                sol_max = sol if sol_max is None else max(sol_max, sol)
                if first_sol <= sol <= last_sol:
                    matching_count += 1
                    if len(sampled) < limit:
                        sampled.append({'sol': sol, 'raw': row})
        return {'file': str(path), 'columns': columns, 'solColumnsDetected': sol_keys,
                'allSolRange': [sol_min,sol_max], 'candidateSolRange': [first_sol,last_sol],
                'candidateRoverPoseRows': matching_count, 'sampleRecords': sampled,
                'sourceKind': 'NASA_PDS_ROVER_POSE_NOT_SCIENCE_TARGET',
                'validationStatus': 'SCHEMA_REVIEW_REQUIRED',
                'nextAction': 'Confirm coordinate-frame field meanings and PDS4 CSV label before GIS transformation'}

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('csv', type=Path)
    p.add_argument('--first-sol',type=int,default=420)
    p.add_argument('--last-sol',type=int,default=560)
    p.add_argument('--out',type=Path,default=Path('data/reports/places-review.json'))
    args=p.parse_args()
    report=summarise(args.csv,args.first_sol,args.last_sol)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='sampleRecords'},indent=2))
    print('Review the report and PDS labels: rover positions are not outcrop coordinates.')
