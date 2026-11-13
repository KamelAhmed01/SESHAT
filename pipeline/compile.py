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
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin, rowcol, xy
from pyproj import Transformer

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


def local_mars_analysis(src, window: Window, base_source_cell: tuple[int, int],
                        resolution_m: float | None = None):
    """Reproject Mars source pixels to a local azimuthal equidistant metric grid.

    Source projected metres are NOT necessarily ground metres. In particular,
    an equirectangular grid at 18°N has E/W ground lengths scaled by cos(lat).
    This routine keeps the source window for provenance but creates a new grid
    whose XY units are local surface distances, centred on the candidate base.
    NO source coordinate or 20-m nominal resolution is silently interpreted as
    geodesic ground spacing.
    """
    if not src.crs:
        raise ValueError('Source CRS missing')
    proj = PyprojCRS.from_wkt(src.crs.to_wkt())
    radius = float(proj.ellipsoid.semi_major_metre)
    if not 3_000_000 < radius < 3_600_000:
        raise ValueError('Source is not a Mars-class planetary CRS')
    minor = float(proj.ellipsoid.semi_minor_metre)
    if abs(radius - minor) > radius * 1e-6:
        raise ValueError('Non-spherical Mars ellipsoid requires an explicitly reviewed planetary transform')
    if not src.crs.is_projected:
        raise ValueError('Mars terrain must use a projected source CRS')
    # The raster can be nominally 20m; preserve source-native pixel scale as
    # the target sampling *resolution*, not as an assumed physical pixel length.
    if resolution_m is None:
        resolution_m = min(abs(float(src.transform.a)), abs(float(src.transform.e)))
    if not (np.isfinite(resolution_m) and 0 < resolution_m <= 1000):
        raise ValueError('Analysis cell resolution must be finite and in (0, 1000] m')
    br, bc = base_source_cell
    if not (0 <= br < window.height and 0 <= bc < window.width):
        raise ValueError('Source-base cell must lie inside source window')
    source_affine = window_transform(window, src.transform)
    base_x, base_y = xy(source_affine, br, bc)
    geographic = PyprojCRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +type=crs +no_defs')
    lon, lat = Transformer.from_crs(proj, geographic, always_xy=True).transform(base_x, base_y)
    if not (np.isfinite(lat) and np.isfinite(lon) and -90 <= lat <= 90):
        raise ValueError('Mars base geodetic coordinate could not be verified')
    local_proj4 = (f'+proj=aeqd +lat_0={lat:.12f} +lon_0={lon:.12f} '
                   f'+a={radius:.4f} +b={radius:.4f} +units=m +type=crs +no_defs')
    local_crs = rasterio.crs.CRS.from_string(local_proj4)
    h, w = int(window.height), int(window.width)
    target_affine = from_origin(-w * resolution_m / 2, h * resolution_m / 2,
                                resolution_m, resolution_m)
    original = src.read(1, window=window, masked=True).astype('float64')
    source_values = np.ma.filled(original, np.nan).astype('float64')
    out = np.full((h, w), np.nan, dtype='float64')
    reproject(
        source=source_values, destination=out,
        src_transform=source_affine, src_crs=src.crs, src_nodata=np.nan,
        dst_transform=target_affine, dst_crs=local_crs, dst_nodata=np.nan,
        resampling=Resampling.bilinear,
        init_dest_nodata=True,
    )
    good = np.isfinite(out)
    if not np.any(good):
        raise ValueError('Local Mars metric reprojection returned no valid terrain')
    mapped_row, mapped_col = rowcol(target_affine, 0.0, 0.0)
    mapped_row = max(0, min(h-1, int(mapped_row)))
    mapped_col = max(0, min(w-1, int(mapped_col)))
    if not good[mapped_row, mapped_col]:
        rr, cc = np.nonzero(good)
        nearest = np.argmin((rr - mapped_row)**2 + (cc - mapped_col)**2)
        mapped_row, mapped_col = int(rr[nearest]), int(cc[nearest])
    return {
        'elevation': out,
        'mask': good.astype('u1'),
        'transform': target_affine,
        'crs': local_crs,
        'centerLatPlanetocentric': float(lat),
        'centerLonEast': float(lon % 360),
        'baseCell': (mapped_row, mapped_col),
        'resolutionMeters': float(resolution_m),
        'sourceTransform': source_affine,
        'sourceCrsWkt': src.crs.to_wkt(),
        'sourceRadiusMeters': radius,
    }


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
        local = local_mars_analysis(src, w, tuple(args.base_cell), getattr(args, 'analysis_resolution_m', None))
        z = local['elevation']
        mask = local['mask']
        transform = local['transform']
        crs_wkt = local['crs'].to_wkt()
        dx = dy = local['resolutionMeters']
        source_nodata = src.nodata
    base = local['baseCell']
    try:
        from .scenario import load_terrain_model
    except ImportError:
        from scenario import load_terrain_model
    model = load_terrain_model()
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
        'planetaryBody': 'Mars', 'sourceBodyRadiusMeters': local['sourceRadiusMeters'],
        'analysisProjection': 'MARS_LOCAL_AZIMUTHAL_EQUIDISTANT',
        'analysisCenterPlanetocentricLat': local['centerLatPlanetocentric'],
        'analysisCenterPositiveEastLon': local['centerLonEast'],
        'analysisMetricGridValidatedBy': 'MARS_SPHERICAL_AEQD_REPROJECT_V1',
        'sourceCrsWkt': local['sourceCrsWkt'], 'sourceRasterTransform': list(local['sourceTransform'])[:6],
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
    p.add_argument('--analysis-resolution-m', type=float, help='Target local Mars analysis sampling (metres)')
    compile_dem(p.parse_args())
