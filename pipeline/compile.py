"""Compile a bounded *real-source* DEM into terrain fields and a DEM hillshade.

No scientific claims are promoted by this command alone. Verify source license,
Mars frame, companion target coordinates, and official Resources eligibility.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image
import rasterio
from pyproj import CRS as PyprojCRS
from rasterio.windows import Window, transform as window_transform

try:
    from .route_fields import TerrainScenario, compute_route_fields, export_fields
except ImportError:  # standalone python pipeline/compile.py
    from route_fields import TerrainScenario, compute_route_fields, export_fields


def render_hillshade(z: np.ndarray, mask: np.ndarray, dx: float, dy: float) -> Image.Image:
    """Shaded relief derived from the actual DEM; not photographic orbital imagery."""
    valid = (mask == 1)
    if not valid.any(): raise ValueError('No valid data')
    fill = np.where(valid, z, float(np.nanmedian(z[valid])))
    dzdy, dzdx = np.gradient(fill, dy, dx)
    nx, ny, nz = -dzdx, -dzdy, np.ones_like(z)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    # Stable illumination from upper left, no claims about actual solar geometry.
    light = np.array([-0.45, -0.45, 0.77]); light /= np.linalg.norm(light)
    illumination = np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / norm, 0, 1)
    lo, hi = np.percentile(z[valid], [3, 97])
    tint = np.clip((fill - lo) / max(1e-9, hi - lo), 0, 1)
    shade = 0.4 + 0.6 * illumination
    rgb = np.zeros((*z.shape, 4), dtype=np.uint8)
    rgb[..., 0] = np.clip((80 + 67 * tint) * shade, 0, 255).astype('u1')
    rgb[..., 1] = np.clip((55 + 49 * tint) * shade, 0, 255).astype('u1')
    rgb[..., 2] = np.clip((49 + 37 * tint) * shade, 0, 255).astype('u1')
    rgb[..., 3] = np.where(valid, 255, 0)
    return Image.fromarray(rgb, mode='RGBA')


def compile_dem(args: argparse.Namespace):
    top, left, height, width = args.window
    if not (0 < height <= args.max_side and 0 < width <= args.max_side and top >= 0 and left >= 0):
        raise ValueError('Window invalid or exceeds --max-side')
    dest = Path(args.output)
    with rasterio.open(args.dem) as src:
        if src.count < 1 or not src.crs:
            raise ValueError('Raster must have explicit georeferencing and one DEM band')
        # A georeferenced *Earth* raster is not Mars terrain.
        radius = float(PyprojCRS.from_wkt(src.crs.to_wkt()).ellipsoid.semi_major_metre)
        if not 3_000_000 < radius < 3_600_000:
            raise ValueError(f'Planetary radius {radius:.1f} m is not a Mars-class datum; do not use Earth CRS')
        if src.crs.is_geographic:
            raise ValueError('Geographic-degree raster cannot be used as a metric grid; reproject using a verified Mars CRS first')
        if src.transform.a <= 0 or src.transform.e >= 0 or abs(src.transform.b) > 1e-10 or abs(src.transform.d) > 1e-10:
            raise ValueError('Grid must be north-up, nonrotated; reproject after checking planetary CRS')
        if top + height > src.height or left + width > src.width:
            raise ValueError('Crop outside source raster')
        if src.crs.linear_units not in ('metre', 'meter', 'metres', 'meters', 'm'):
            raise ValueError(f'Unverified CRS linear units: {src.crs.linear_units!r}; convert to meters explicitly')
        w = Window(left, top, width, height)
        elevation = src.read(1, window=w, masked=True).astype('float64')
        good = ~np.ma.getmaskarray(elevation) & np.isfinite(np.ma.getdata(elevation))
        z = np.ma.getdata(elevation)
        mask = np.where(good, 1, 0).astype('u1')
        transform = window_transform(w, src.transform)
        crs_wkt = src.crs.to_wkt()
        dx, dy = float(src.transform.a), abs(float(src.transform.e))
        source_nodata = src.nodata
    base = tuple(args.base_cell)
    model = TerrainScenario()
    fields = compute_route_fields(z, mask, dx, dy, base, model)
    dest.mkdir(parents=True, exist_ok=True)
    records = export_fields(fields, dest)
    imagery = dest / 'imagery'
    imagery.mkdir(parents=True, exist_ok=True)
    render_hillshade(z, mask, dx, dy).save(imagery / 'study-area.webp', format='WEBP', lossless=True)
    image_bytes = (imagery / 'study-area.webp').read_bytes()
    manifest = {
        'schemaVersion': '1.0.0', 'status': 'SOURCE_REVIEW_REQUIRED',
        'sourceId': args.source_id, 'sourceUrl': args.source_url,
        'eligibilityNote': 'Official challenge Resources membership must be confirmed by team',
        'viewLayerKind': 'DEM_DERIVED_HILLSHADE_NOT_ORBITAL_PHOTO',
        'modelId': model.model_id, 'modelEvidence': 'SCENARIO_ASSUMPTION',
        'height': height, 'width': width, 'baseIndex': fields['_base_index'],
        'cellWidthMeters': dx, 'cellHeightMeters': dy,
        'crsWkt': crs_wkt, 'rasterTransform': list(transform)[:6],
        'planetaryBody': 'Mars', 'sourceBodyRadiusMeters': radius,
        'nativeNodata': source_nodata, 'sourceWindow': list(args.window),
        'files': records,
        'imagery': {'path': 'imagery/study-area.webp', 'sha256': hashlib.sha256(image_bytes).hexdigest(), 'bytes': len(image_bytes)},
        'scienceTargets': [], 'coordinateFrameVerified': False, 'challengeResourceQualified': False,
    }
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Wrote {height}×{width} DEM-derived *unreviewed* fields to {dest}')
    print('NEXT GATE: scientifically verify Mars CRS, overlap, provenance, challenge Resources, and target coordinates.')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dem', required=True)
    p.add_argument('--window', type=int, nargs=4, metavar=('ROW', 'COL', 'HEIGHT', 'WIDTH'), required=True)
    p.add_argument('--base-cell', type=int, nargs=2, metavar=('ROW', 'COL'), required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--source-id', required=True)
    p.add_argument('--source-url', required=True)
    p.add_argument('--max-side', type=int, default=250)
    compile_dem(p.parse_args())
