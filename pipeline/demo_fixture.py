"""Build a fully synthetic, deterministic SESHAT interactive fixture.

NEVER treat this output as Mars observations, verified coordinates, or a NASA source.
This is an acceptance-test scene under /demo, not /data.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np

try:
    from .route_fields import TerrainScenario, compute_route_fields, export_fields
    from .compile import render_hillshade
except ImportError:
    from route_fields import TerrainScenario, compute_route_fields, export_fields
    from compile import render_hillshade


def build_fixture(out: Path, shape=(160, 190), cell_m=32):
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w]
    # Smooth reproducible *illustrative* relief, not a Martian DEM.
    z = (26*np.sin(xs/28) + 17*np.cos(ys/19) + 13*np.sin((xs+ys)/18)
         + 54*np.exp(-((xs-108)**2/1100+(ys-26)**2/1100))
         - 42*np.exp(-((xs-31)**2/1300+(ys-100)**2/650))
         + 5*np.cos(xs/7)*np.sin(ys/9)).astype(np.float64)
    mask = np.ones((h, w), dtype=np.uint8)
    # A winding unavailable-data strip tests a genuinely unknown region, not an obstacle.
    mask[10:42, 111:114] = 0
    # An intentional hard constraint in a remote corner, visible on the hillshade.
    mask[100:117, 8:22] = 2
    base = (h//2, w//2)
    model = TerrainScenario()
    fields = compute_route_fields(z, mask, cell_m, cell_m, base, model)
    out.mkdir(parents=True, exist_ok=True)
    files = export_fields(fields, out)
    imagery_dir = out/'imagery'; imagery_dir.mkdir(exist_ok=True)
    image_file = imagery_dir/'study-area.webp'
    render_hillshade(z, mask, cell_m, cell_m).save(image_file, format='WEBP', lossless=True)
    image_data = image_file.read_bytes()
    outcost, retcost = fields['outbound-costs.bin'], fields['return-costs.bin']
    total = outcost+retcost
    candidates = np.where((mask.ravel()==1) & np.isfinite(total))[0]
    targets = []
    for i, (desired, title, minutes, detail) in enumerate([
        (62., 'Northern escarpment', 25, 'Illustrative slope-sensitive ridge scenario'),
        (122., 'The layered basin', 25, 'Illustrative time-threshold crossing scenario'),
        (153., 'Eastern traverse', 20, 'Illustrative initially time-limited destination'),
    ]):
        # Keep scenarios spatially varied rather than all nearest points on the same bearing.
        rr, cc = candidates//w, candidates%w
        regions = [(rr < base[0]-10), (cc < base[1]-12), (cc > base[1]+12)]
        subset = candidates[regions[i] & (rr > 5) & (rr < h-6) & (cc > 5) & (cc < w-6)]
        if not len(subset): subset = candidates
        index = int(subset[np.argmin(np.abs(total[subset]-desired))])
        r, c = divmod(index, w)
        targets.append({
            'id':f'demo-{i+1}', 'name':title,
            'location':{'originalCoordinateText':f'Synthetic cell ({r},{c})',
                'coordinateFrame':'SYNTHETIC_LOCAL_TEST_GRID', 'gridRow':r, 'gridCol':c,
                'confidence':'USER_SELECTED', 'locationSource':'GENERATED_ACCEPTANCE_FIXTURE'},
            'objectiveTags':['synthetic-test'],
            'science':{'summary':detail+'. No geographic or scientific observation is claimed.',
                'sourceIds':[], 'evidence':[],
                'limitations':['Synthetic terrain', 'Hypothetical activity duration', 'Not Mars geography']},
            'activity':{'minutes':minutes, 'basis':'SCENARIO_ASSUMPTION'}
        })
    manifest = {
        'schemaVersion':'1.0.0', 'status':'DEMO_SYNTHETIC',
        'sourceId':'SYNTHETIC_INTEGRATION_FIXTURE_01',
        'sourceUrl':'', 'modelId':model.model_id,
        'height':h,'width':w,'baseIndex':fields['_base_index'],
        'cellWidthMeters':cell_m, 'cellHeightMeters':cell_m,
        'crsWkt':'SYNTHETIC PLANAR GRID — NOT A GEODETIC CRS',
        'coordinateFrameVerified':False, 'challengeResourceQualified':False,
        'viewLayerKind':'SYNTHETIC_DEM_DERIVED_HILLSHADE',
        'files':files,
        'imagery':{'path':'imagery/study-area.webp','bytes':len(image_data),
                   'sha256':hashlib.sha256(image_data).hexdigest()},
        'scienceTargets':targets,
        'notice':'SYNTHETIC ACCEPTANCE TEST. Not Mars or NASA imagery. No operational safety conclusions.'
    }
    (out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print('Synthetic test only:',h,'x',w, 'cells, no real Mars observations')
    for t in targets:
        r=t['location']['gridRow'];c=t['location']['gridCol']; idx=r*w+c
        print(t['name'], f'cell({r},{c})', f'roundtrip={total[idx]:.1f} min', f'activity={t["activity"]["minutes"]} min')
    return manifest


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',default='public/demo')
    args=p.parse_args()
    build_fixture(Path(args.output))
