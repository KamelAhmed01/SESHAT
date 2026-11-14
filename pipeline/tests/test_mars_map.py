"""Tests for Mars geographic tile pyramid, AEQD parity, and context layers."""
from __future__ import annotations

import json
import math
from pathlib import Path

from affine import Affine
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'public' / 'data'


def _mars_to_geo_transformer(manifest: dict) -> tuple[Transformer, Transformer, Affine]:
    radius = float(manifest.get('sourceBodyRadiusMeters', 3396190.0))
    aeqd = CRS.from_wkt(manifest['crsWkt'])
    geo = CRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
    to_geo = Transformer.from_crs(aeqd, geo, always_xy=True)
    to_aeqd = Transformer.from_crs(geo, aeqd, always_xy=True)
    aff = Affine(*manifest['rasterTransform'])
    return to_geo, to_aeqd, aff


def test_mars_map_manifest_and_tiles_present() -> None:
    manifest = json.loads((DATA_DIR / 'manifest.json').read_text())
    assert manifest['status'] == 'SOURCE_REVIEW_REQUIRED'
    assert manifest['coordinateFrameVerified'] is False

    md = manifest['mapDisplay']
    assert md['projection'] == 'MARS_PLANETOCENTRIC_PLATE_CARREE'
    assert md['marsRadiusMeters'] == 3396190.0
    assert len(md['geographicBounds']) == 4
    south, west, north, east = md['geographicBounds']
    assert 18.0 < south < north < 19.0
    assert 77.0 < west < east < 78.0

    local_viking = md['localVikingTiles']
    jezero_tiles = md['jezeroTiles']
    assert len(local_viking) == 50
    assert len(jezero_tiles) >= 350

    for key in ('0/0/0', '0/0/1', '7/50/183'):
        assert key in local_viking
        assert (DATA_DIR / 'tiles' / 'viking' / f'{key}.jpg').exists()

    for key in jezero_tiles[:10]:
        assert (DATA_DIR / 'tiles' / 'jezero' / f'{key}.webp').exists()

    assert (DATA_DIR / md['terrainGeoPath']).exists()
    assert (DATA_DIR / md['orbitalGeoPath']).exists()


def test_aeqd_corners_center_and_targets_roundtrip() -> None:
    manifest = json.loads((DATA_DIR / 'manifest.json').read_text())
    to_geo, to_aeqd, aff = _mars_to_geo_transformer(manifest)
    h, w = int(manifest['height']), int(manifest['width'])

    # Test all 4 cell corners, grid center, and every documented target with pixel center.
    points: list[tuple[float, float, str]] = [
        (0.5, 0.5, 'top-left corner'),
        (0.5, w - 0.5, 'top-right corner'),
        (h - 0.5, 0.5, 'bottom-left corner'),
        (h - 0.5, w - 0.5, 'bottom-right corner'),
        (h / 2.0, w / 2.0, 'grid center'),
    ]
    for target in manifest.get('scienceTargets', []):
        loc = target.get('location', {})
        if loc.get('gridRow') is not None and loc.get('gridCol') is not None:
            points.append((loc['gridRow'] + 0.5, loc['gridCol'] + 0.5, target['id']))

    inv_aff = ~aff
    bounds = manifest['mapDisplay']['geographicBounds']
    for r_f, c_f, label in points:
        x, y = aff * (c_f, r_f)
        lon, lat = to_geo.transform(x, y)
        assert bounds[0] - 1e-4 <= lat <= bounds[2] + 1e-4, f'{label} lat out of bounds'
        assert bounds[1] - 1e-4 <= lon <= bounds[3] + 1e-4, f'{label} lon out of bounds'

        x_back, y_back = to_aeqd.transform(lon, lat)
        err_m = math.hypot(x_back - x, y_back - y)
        assert err_m < 1e-4, f'{label} AEQD roundtrip error {err_m} m'

        c_back, r_back = inv_aff * (x_back, y_back)
        assert abs(r_back - r_f) < 1e-6 and abs(c_back - c_f) < 1e-6


def test_context_layers_and_explicit_unknowns() -> None:
    manifest = json.loads((DATA_DIR / 'manifest.json').read_text())
    ctx = manifest['contextLayers']

    ti = ctx['thermalInertia']
    assert (DATA_DIR / ti['binaryPath']).stat().st_size == ti['binaryBytes']
    assert (DATA_DIR / ti['geoImagePath']).exists()

    geo_units = ctx['geologicUnits']
    assert (DATA_DIR / geo_units['binaryPath']).stat().st_size == geo_units['binaryBytes']
    assert (DATA_DIR / geo_units['geoImagePath']).exists()
    units_json = json.loads((DATA_DIR / geo_units['jsonPath']).read_text())
    assert len(units_json['units']) == geo_units['unitCount']

    meda = json.loads((DATA_DIR / ctx['medaPressure']['jsonPath']).read_text())
    assert len(meda['sols']) == 3
    assert len(meda['unavailableFields']) >= 3
