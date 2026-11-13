"""Mars geodesic and map-to-raster crosschecks using SYNTHETIC DEM only."""
from __future__ import annotations
import json
import math
from pathlib import Path
import numpy as np
import rasterio
from pyproj import CRS as PyprojCRS, Geod, Transformer
from rasterio.transform import from_origin, xy, rowcol
from rasterio.windows import Window
from pipeline.compile import local_mars_analysis, compile_dem
from pipeline.real_ingest import ingest
from pipeline.tests.test_real_ingest import MARS_CRS

RADIUS = 3396190


def make_jezero_like_source(path: Path):
    """Mars equirectangular pixels of 20 projected metres at ~18.5 north."""
    lat = math.radians(18.5)
    northing = RADIUS * lat
    arr = (np.arange(50, dtype='float32')[:, None] * 0.3 +
           np.arange(54, dtype='float32')[None, :] * 0.2 - 2500).astype('float32')
    arr[0:3, 0:3] = -9999
    with rasterio.open(path, 'w', driver='GTiff', width=54, height=50,
                       count=1, dtype='float32', crs=MARS_CRS,
                       transform=from_origin(500000, northing + 500, 20, 20),
                       nodata=-9999) as ds:
        ds.write(arr, 1)


def test_eqc_source_pixel_is_not_a_ground_east_west_pixel(tmp_path):
    path = tmp_path/'jezero_like.tif'
    make_jezero_like_source(path)
    with rasterio.open(path) as src:
        sx, sy = xy(src.transform, 25, 25)
        ex, ey = xy(src.transform, 25, 26)
        geographic = PyprojCRS.from_proj4(f'+proj=longlat +a={RADIUS} +b={RADIUS} +type=crs')
        to_geo = Transformer.from_crs(PyprojCRS.from_wkt(src.crs.to_wkt()), geographic, always_xy=True)
        lon1, lat1 = to_geo.transform(sx, sy)
        lon2, lat2 = to_geo.transform(ex, ey)
        _, _, distance = Geod(a=RADIUS,b=RADIUS).inv(lon1, lat1, lon2, lat2)
        assert 18.9 < distance < 19.1  # 20m * cos(18.5°), not 20m
        result = local_mars_analysis(src, Window(8, 7, 32, 32), (16, 16))
    assert result['resolutionMeters'] == 20
    assert result['mask'].sum() > 650
    assert result['crs'].is_projected
    assert 'azimuthal' in result['crs'].to_wkt().lower() or 'equidistant' in result['crs'].to_wkt().lower()
    assert np.isfinite(result['elevation'][result['mask'] == 1]).all()
    # Local AEQD XY step of 20m near the center maps to a 20m spherical distance.
    geographic = PyprojCRS.from_proj4(f'+proj=longlat +a={RADIUS} +b={RADIUS} +type=crs')
    back = Transformer.from_crs(PyprojCRS.from_wkt(result['crs'].to_wkt()), geographic, always_xy=True)
    a = result['transform']
    x1, y1 = xy(a, 16, 15)
    x2, y2 = xy(a, 16, 16)
    lon1, lat1 = back.transform(x1, y1)
    lon2, lat2 = back.transform(x2, y2)
    _, _, local_ground_distance = Geod(a=RADIUS,b=RADIUS).inv(lon1,lat1,lon2,lat2)
    assert abs(local_ground_distance - 20) < 0.01
    # The analysis origin is the selected source base, not an invented Mars location.
    r,c = result['baseCell']
    assert abs(r-16) <= 2 and abs(c-16) <= 2


def test_ingest_reprojected_manifest_and_target_grid_transform(tmp_path):
    path = tmp_path/'mars.tif'
    make_jezero_like_source(path)
    out = tmp_path/'bundle'
    ingest(path,out,side=30,row=25,col=25)
    m = json.loads((out/'manifest.json').read_text())
    assert m['analysisProjection'] == 'MARS_LOCAL_AZIMUTHAL_EQUIDISTANT'
    assert m['analysisMetricGridValidatedBy'] == 'MARS_SPHERICAL_AEQD_REPROJECT_V1'
    assert m['sourceCrsWkt'] != m['crsWkt']
    assert m['sourceRasterTransform'] != m['rasterTransform']
    assert m['cellWidthMeters'] == m['cellHeightMeters'] == 20
    assert m['sourceFileProvenance'] == 'UNVERIFIED_LOCAL_FILE'
    # Mars target at analysis center can be mapped back into the grid reliably.
    geographic=PyprojCRS.from_proj4(f'+proj=longlat +a={RADIUS} +b={RADIUS} +type=crs')
    to_local=Transformer.from_crs(geographic, PyprojCRS.from_wkt(m['crsWkt']),always_xy=True)
    x,y=to_local.transform(m['analysisCenterPositiveEastLon'],m['analysisCenterPlanetocentricLat'])
    from affine import Affine
    rr,cc=rowcol(Affine(*m['rasterTransform']),x,y)
    assert abs(rr - m['height']//2) <= 1 and abs(cc - m['width']//2) <= 1
    assert np.isfinite(np.fromfile(out/'outbound-costs.bin',dtype='<f8')).any()


def test_reprojection_rejects_unphysical_analysis_resolution(tmp_path):
    path=tmp_path/'mars.tif';make_jezero_like_source(path)
    with rasterio.open(path) as src:
        import pytest
        with pytest.raises(ValueError,match='resolution'):
            local_mars_analysis(src,Window(4,4,20,20),(10,10),float('nan'))
