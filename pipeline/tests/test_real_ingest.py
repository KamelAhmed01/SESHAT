"""End-to-end contract using a TEST GeoTIFF with Mars projection; not NASA data."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
from pipeline.real_ingest import ingest, find_window_and_base

MARS_CRS=CRS.from_string('+proj=eqc +lat_ts=0 +lon_0=0 +a=3396190 +b=3396190 +units=m +no_defs')


def make_tiff(path: Path, crs=MARS_CRS):
    zz=np.full((34,39),-2500.0,dtype=np.float32)
    rr,cc=np.indices(zz.shape)
    zz += rr * 0.45 + cc * 0.12
    zz[:3,:3] = -9999
    with rasterio.open(path,'w',driver='GTiff',width=39,height=34,count=1,
                       dtype='float32',crs=crs,transform=from_origin(4_500_000,1_000_000,20,20),nodata=-9999) as ds:
        ds.write(zz,1)


def test_mars_geo_tiff_to_browser_bundle(tmp_path):
    dem=tmp_path/'test_mars_input.tif'
    make_tiff(dem)
    out=tmp_path/'output'
    ingest(dem,out,side=26)
    manifest=json.loads((out/'manifest.json').read_text())
    assert manifest['status']=='SOURCE_REVIEW_REQUIRED'
    assert manifest['coordinateFrameVerified'] is False
    assert manifest['challengeResourceQualified'] is False
    assert manifest['planetaryBody']=='Mars'
    assert manifest['sourceBodyRadiusMeters']==3396190
    assert manifest['height']==26 and manifest['width']==26
    assert len((out/'outbound-costs.bin').read_bytes())==26*26*8
    assert (out/'imagery/study-area.webp').stat().st_size > 100
    assert len(manifest['files']) == 6


def test_reject_earth_raster(tmp_path):
    dem=tmp_path/'earth.tif'
    make_tiff(dem,CRS.from_epsg(32632))
    with pytest.raises(ValueError, match='Mars-class'):
        ingest(dem,tmp_path/'result',side=20)


def test_choose_nearest_valid_base(tmp_path):
    dem=tmp_path/'mars.tif'
    make_tiff(dem)
    window,base=find_window_and_base(dem,side=20,center_row=1,center_col=1)
    assert 0<=base[0]<window[2] and 0<=base[1]<window[3]
    with rasterio.open(dem) as ds:
        assert ds.read(1,masked=True,window=rasterio.windows.Window(window[1],window[0],window[3],window[2])).mask[base] == False


def test_planetocentric_center_selection(tmp_path):
    from pyproj import CRS, Transformer
    from pipeline.real_ingest import ingest
    dem=tmp_path/'mars.tif'; make_tiff(dem)
    with rasterio.open(dem) as ds:
        x,y=rasterio.transform.xy(ds.transform,16,20)
        geographic=CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
        lon,lat=Transformer.from_crs(ds.crs,geographic,always_xy=True).transform(x,y)
    out=tmp_path/'out';ingest(dem,out,side=20,latitude=lat,longitude=lon)
    manifest=json.loads((out/'manifest.json').read_text())
    assert manifest['sourceFileProvenance']=='UNVERIFIED_LOCAL_FILE'
    assert manifest['sourceId']=='LOCAL_DEM_PROVENANCE_PENDING'
    assert manifest['sourceFileSha256']
    assert manifest['sourceWindow'][0] <= 16 < manifest['sourceWindow'][0]+20
    assert manifest['sourceWindow'][1] <= 20 < manifest['sourceWindow'][1]+20
