"""Map independently evidenced real Mars target coordinates onto accepted DEM crop.

Inputs are *human-curated, source-linked scientific observations*, not auto-geocoded
rover Sol ranges. This command never promotes a bundle to VERIFIED.

  python -m pipeline.targets docs/targets.example.json --bundle public/data
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
from affine import Affine
from pyproj import CRS, Transformer
import rasterio.transform


def import_targets(path: Path, bundle_path: Path) -> dict:
    mpath = bundle_path/'manifest.json'
    m = json.loads(mpath.read_text())
    data=json.loads(path.read_text())
    if not isinstance(data,list) or len(data)>20:
        raise ValueError('Target catalog must be a list of at most 20 destinations')
    radius=m.get('sourceBodyRadiusMeters')
    if not radius or not 3_000_000 < float(radius) < 3_600_000:
        raise ValueError('Cannot georeference targets without validated Mars-class radius')
    wkt=m.get('crsWkt')
    if not wkt or not m.get('rasterTransform') or len(m['rasterTransform'])!=6:
        raise ValueError('Missing planetary projection/affine transform')
    geographic=CRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
    projected=CRS.from_wkt(wkt)
    convert=Transformer.from_crs(geographic, projected, always_xy=True)
    transform=Affine(*m['rasterTransform'])
    targets=[]; seen=set()
    for t in data:
        if not isinstance(t,dict) or not isinstance(t.get('id'),str) or not t['id'] or t['id'] in seen:
            raise ValueError('Target ID missing or repeated')
        seen.add(t['id'])
        confidence=t.get('confidence','APPROXIMATE_REGION')
        if confidence not in ('VERIFIED_POINT','SOURCE_REPORTED_POINT','APPROXIMATE_REGION'):
            raise ValueError('Only curator-backed points or regions may be imported')
        evidence=t.get('evidence',[])
        if not isinstance(evidence,list): raise ValueError('Invalid evidence list')
        for e in evidence:
            if not isinstance(e,dict) or not e.get('url','').startswith('https://') or not e.get('sourceId') or not e.get('title'):
                raise ValueError('Scientific evidence requires title, sourceId and HTTPS URL')
        source=t.get('coordinateSource')
        if confidence=='VERIFIED_POINT' and (not source or not str(source).startswith('https://') or not evidence or not t.get('coordinateReviewer')):
            raise ValueError('Exact target needs independent coordinate URL, scientific evidence and named human reviewer')
        if confidence in ('VERIFIED_POINT','SOURCE_REPORTED_POINT'):
            if not source or not str(source).startswith('https://') or not evidence:
                raise ValueError('A published coordinate requires source and scientific evidence')
            lat,lon=t.get('latitudePlanetocentric'),t.get('longitudeEast')
            if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not 0<=lon<360:
                raise ValueError('Provide verified planetocentric latitude [-90,90], east longitude [0,360)')
            x,y=convert.transform(lon,lat)
            if not math.isfinite(x) or not math.isfinite(y): raise ValueError('Coordinate transform failed')
            row,col = rasterio.transform.rowcol(transform,x,y)
            if not (0<=row<m['height'] and 0<=col<m['width']):
                raise ValueError(f"Target {t['id']} lies outside chosen terrain crop. Move the crop; do not snap a science point.")
            grid_row,grid_col = int(row),int(col)
            original=f'{lat:.7f}°N planetocentric, {lon:.7f}°E (source)'
        else:
            grid_row=grid_col=None
            original='Region only; no exact observation point claimed'
        duration=t.get('activityMinutes',20)
        if not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration<0 or duration>480:
            raise ValueError('Invalid assumed fieldwork duration')
        targets.append({
            'id':t['id'],'name':t.get('name',t['id']),
            'location':{'originalCoordinateText':original,'coordinateFrame':'MARS_PLANETOCENTRIC_POSITIVE_EAST',
                'gridRow':grid_row,'gridCol':grid_col,'confidence':confidence,
                'locationSource':source if source else None},
            'objectiveTags':t.get('tags',[]),
            'science':{'summary':t.get('summary','Proposed investigation; evidence review required.'),
                'sourceIds':[e['sourceId'] for e in evidence],
                'evidence':[{'title':e['title'],'url':e['url'],'sourceId':e['sourceId'],
                            'claimSupported':e.get('claimSupported','See source')} for e in evidence],
                'limitations':t.get('limitations',['Not certified for EVA operations'])},
            'activity':{'minutes':float(duration),'basis':'SCENARIO_ASSUMPTION'},
        })
    m['scienceTargets']=targets
    m['targetCatalogInputHash']=hashlib.sha256(path.read_bytes()).hexdigest()
    m['targetCatalogReview']='SOURCE_REVIEW_REQUIRED'
    mpath.write_text(json.dumps(m,indent=2)+'\n')
    return m

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('targets',type=Path)
    p.add_argument('--bundle',type=Path,default=Path('public/data'))
    a=p.parse_args()
    manifest=import_targets(a.targets,a.bundle)
    print('Imported',len(manifest['scienceTargets']),'source-linked target candidates; still SOURCE_REVIEW_REQUIRED')
