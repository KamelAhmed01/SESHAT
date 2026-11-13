from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image
import pytest
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
from pipeline.optical import align_optical
from pipeline.real_ingest import ingest
from .test_real_ingest import make_tiff, MARS_CRS


def test_native_mars_ortho_aligns_to_dem_pixels(tmp_path):
    dem=tmp_path/'real_shape_fixture.tif';make_tiff(dem)
    out=tmp_path/'bundle';ingest(dem,out,side=20)
    photo=tmp_path/'photo.tif'
    arr=np.ones((34,39),dtype='uint8')*160
    with rasterio.open(photo,'w',driver='GTiff',width=39,height=34,count=1,dtype='uint8',
                       crs=MARS_CRS,transform=from_origin(4_500_000,1_000_000,20,20),nodata=0) as img:
        img.write(arr,1)
    entry=align_optical(photo,out,'Synthetic optical unit test','https://example.org/unit-test-image')
    assert entry['validPixelCount']==20*20
    assert entry['reviewStatus']=='SOURCE_REVIEW_REQUIRED'
    assert (out/entry['path']).is_file()
    assert Image.open(out/entry['path']).size==(20,20)


def test_orbital_no_overlap_fails(tmp_path):
    dem=tmp_path/'dem.tif';make_tiff(dem);out=tmp_path/'bundle';ingest(dem,out,side=20)
    photo=tmp_path/'far.tif'
    arr=np.ones((10,10),dtype='uint8')*120
    with rasterio.open(photo,'w',driver='GTiff',width=10,height=10,count=1,dtype='uint8',
                       crs=MARS_CRS,transform=from_origin(10_000_000,10_000_000,20,20),nodata=0) as img:img.write(arr,1)
    with pytest.raises(ValueError,match='no overlap'):
        align_optical(photo,out,'Synthetic test','https://example.org/source')
