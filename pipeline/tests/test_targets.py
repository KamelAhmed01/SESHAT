from __future__ import annotations
import json
from pathlib import Path
from pyproj import CRS, Transformer
from rasterio.transform import xy, from_origin
import pytest
from pipeline.real_ingest import ingest
from pipeline.targets import import_targets
from .test_real_ingest import make_tiff


def prep(tmp_path):
    dem=tmp_path/'mars.tif'; make_tiff(dem)
    out=tmp_path/'output';ingest(dem,out,side=25)
    return out


def test_approximate_region_stays_unroutable(tmp_path):
    out=prep(tmp_path)
    catalog=tmp_path/'targets.json'; catalog.write_text(json.dumps([{
        'id':'region','name':'Region','confidence':'APPROXIMATE_REGION','summary':'Only regional evidence',
        'activityMinutes':20,'evidence':[]}]))
    manifest=import_targets(catalog,out)
    assert manifest['scienceTargets'][0]['location']['gridRow'] is None
    assert manifest['status']=='SOURCE_REVIEW_REQUIRED'


def test_source_reviewed_point_maps_to_expected_cell(tmp_path):
    out=prep(tmp_path)
    m=json.loads((out/'manifest.json').read_text())
    transform=m['rasterTransform']
    x,y=xy(from_origin(transform[2],transform[5],transform[0],-transform[4]),4,6)
    geog=CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
    lon,lat=Transformer.from_crs(CRS.from_wkt(m['crsWkt']),geog,always_xy=True).transform(x,y)
    cat=tmp_path/'targets.json'
    cat.write_text(json.dumps([{
        'id':'evidence-backed-fixture','name':'Only a synthetic unit fixture',
        'confidence':'VERIFIED_POINT','latitudePlanetocentric':lat,'longitudeEast':lon,
        'coordinateReviewer':'test-reviewer','coordinateSource':'https://example.com/unit-test-coordinates',
        'evidence':[{'sourceId':'TEST','title':'Only a test','url':'https://example.com/test-evidence'}]
    }]))
    manifest=import_targets(cat,out)
    p=manifest['scienceTargets'][0]['location']
    assert (p['gridRow'],p['gridCol'])==(4,6)
    assert manifest['status']=='SOURCE_REVIEW_REQUIRED'


def test_reject_precision_without_evidence(tmp_path):
    out=prep(tmp_path)
    cat=tmp_path/'bad.json'; cat.write_text(json.dumps([{
        'id':'fake','confidence':'VERIFIED_POINT','latitudePlanetocentric':18.0,'longitudeEast':77.2
    }]))
    with pytest.raises(ValueError, match='independent coordinate'):
        import_targets(cat,out)


def test_reject_outside_crop_instead_of_snapping(tmp_path):
    out=prep(tmp_path)
    cat=tmp_path/'outside.json'; cat.write_text(json.dumps([{
        'id':'far','confidence':'VERIFIED_POINT','latitudePlanetocentric':80.0,'longitudeEast':200.0,
        'coordinateReviewer':'reviewer','coordinateSource':'https://example.org/coordinates',
        'evidence':[{'sourceId':'x','title':'x','url':'https://example.org/evidence'}]
    }]))
    with pytest.raises(ValueError, match='outside chosen terrain crop'):
        import_targets(cat,out)
