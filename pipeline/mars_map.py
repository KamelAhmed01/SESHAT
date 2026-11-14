"""Compile wider Mars / Jezero tiles, georeferenced AEQD overlays, and environmental context layers.

Reads cached real NASA/USGS/PDS/Edwards & Buz artifacts in `data/raw/` plus the
already-compiled `public/data/manifest.json` 20 m AEQD bundle, and emits:
  - `public/data/tiles/viking/{z}/{y}/{x}.jpg` (levels 0-2 global + Jezero corridor levels 3-7)
  - `public/data/tiles/jezero/{z}/{y}/{x}.webp` (6 m CTX mosaic pyramid: levels 8-12 full, 13 western fan)
  - `public/data/imagery/study-area-geo.webp` & `orbital-geo.webp` (AEQD -> Mars geographic display rasters)
  - `public/data/thermal-inertia.bin` & `imagery/thermal-inertia-geo.webp`
  - `public/data/geologic-units.bin`, `geologic-units.json`, & `imagery/geologic-units-geo.webp`
  - `public/data/meda-context.json`
  - Updated `public/data/manifest.json` (`mapDisplay` & `contextLayers`), keeping routing fields/hashes intact.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import statistics
import urllib.error
import urllib.request
from zipfile import ZipFile
from pathlib import Path

import numpy as np
import rasterio
import rasterio.features
import shapefile
from affine import Affine
from PIL import Image
from pyproj import CRS as PyprojCRS, Transformer
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_geom
from rasterio.windows import from_bounds as window_from_bounds

VIKING_URL_TEMPLATE = (
    'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/'
    '1.0.0/default/default028mm/{z}/{y}/{x}.jpg'
)
MARS_RADIUS_M = 3396190.0
DEG_TO_M = MARS_RADIUS_M * math.pi / 180.0

JEZERO_FULL_MIN_Z = 8
JEZERO_FULL_MAX_Z = 12
JEZERO_FAN_Z = 13
JEZERO_FAN_BOUNDS = (77.32, 18.38, 77.52, 18.54)  # (west, south, east, north)

UNIT_PALETTE = [
    (16, 185, 129),   # emerald
    (243, 168, 51),   # amber
    (56, 189, 248),   # sky
    (244, 114, 182),  # rose
    (168, 85, 247),   # purple
    (250, 204, 21),   # yellow
    (251, 146, 60),   # orange
    (94, 234, 212),   # teal
    (148, 163, 184),  # slate
]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _grid_geo_bounds_and_polygon(manifest: dict, steps_per_edge: int = 32) -> tuple[list[float], list[list[float]]]:
    radius = float(manifest.get('sourceBodyRadiusMeters', MARS_RADIUS_M))
    aeqd = PyprojCRS.from_wkt(manifest['crsWkt'])
    geo = PyprojCRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
    to_geo = Transformer.from_crs(aeqd, geo, always_xy=True)
    aff = Affine(*manifest['rasterTransform'])
    h, w = int(manifest['height']), int(manifest['width'])

    samples: list[tuple[float, float]] = []
    for i in range(steps_per_edge):
        samples.append((0.0, (i / steps_per_edge) * w))
    for i in range(steps_per_edge):
        samples.append(((i / steps_per_edge) * h, float(w)))
    for i in range(steps_per_edge):
        samples.append((float(h), w - (i / steps_per_edge) * w))
    for i in range(steps_per_edge):
        samples.append((h - (i / steps_per_edge) * h, 0.0))

    poly: list[list[float]] = []
    lats: list[float] = []
    lons: list[float] = []
    for r_f, c_f in samples:
        x, y = aff * (c_f, r_f)
        lon, lat = to_geo.transform(x, y)
        lon = ((lon + 180.0) % 360.0) - 180.0
        poly.append([round(lat, 7), round(lon, 7)])
        lats.append(lat)
        lons.append(lon)

    return [min(lats), min(lons), max(lats), max(lons)], poly


def _reproject_aeqd_rgba_to_geo(src_rgba: np.ndarray, manifest: dict, dst_bounds: list[float], out_w: int = 280, out_h: int = 280) -> Image.Image:
    """Reproject a 220x220 AEQD RGBA raster into Mars geographic Plate Carree over [south, west, north, east]."""
    south, west, north, east = dst_bounds
    src_crs = CRS.from_wkt(manifest['crsWkt'])
    src_transform = Affine(*manifest['rasterTransform'])
    radius = float(manifest.get('sourceBodyRadiusMeters', MARS_RADIUS_M))
    dst_crs = CRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
    dst_transform = from_bounds(west, south, east, north, out_w, out_h)

    dst = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    # Reproject alpha with nearest-neighbor first so outside / NoData edges stay crisp
    alpha_out = np.zeros((out_h, out_w), dtype=np.uint8)
    reproject(
        source=src_rgba[..., 3],
        destination=alpha_out,
        src_transform=src_transform,
        src_crs=src_crs,
        src_nodata=0,
        dst_transform=dst_transform,
        dst_crs=dst_crs,
        dst_nodata=0,
        resampling=Resampling.nearest,
    )
    for c in range(3):
        band_out = np.zeros((out_h, out_w), dtype=np.uint8)
        reproject(
            source=src_rgba[..., c],
            destination=band_out,
            src_transform=src_transform,
            src_crs=src_crs,
            src_nodata=None,
            dst_transform=dst_transform,
            dst_crs=dst_crs,
            dst_nodata=0,
            resampling=Resampling.bilinear,
        )
        dst[..., c] = band_out
    dst[..., 3] = alpha_out
    return Image.fromarray(dst, mode='RGBA')


def _prepare_viking_tiles(raw_cache: Path, out_dir: Path) -> list[str]:
    """Download/copy Viking level 0-2 global tiles (42) + Jezero corridor levels 3-7 tiles."""
    raw_cache.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    targets: list[tuple[int, int, int]] = []
    for z in range(0, 3):
        rows, cols = 2 ** z, 2 ** (z + 1)
        for y in range(rows):
            for x in range(cols):
                targets.append((z, y, x))

    # Corridor around Jezero (77.0E..77.8E, 18.1N..18.8N) for parent levels 3..7
    for z in range(3, 8):
        span = 180.0 / (2 ** z)
        y0 = max(0, int((90.0 - 18.8) / span))
        y1 = min((2 ** z) - 1, int((90.0 - 18.1) / span))
        x0 = int((77.0 + 180.0) / span) % (2 ** (z + 1))
        x1 = int((77.8 + 180.0) / span) % (2 ** (z + 1))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                targets.append((z, y, x))

    keys: list[str] = []
    for z, y, x in targets:
        cache_file = raw_cache / str(z) / str(y) / f'{x}.jpg'
        dest_file = out_dir / str(z) / str(y) / f'{x}.jpg'
        if not cache_file.is_file():
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            url = VIKING_URL_TEMPLATE.format(z=z, y=y, x=x)
            req = urllib.request.Request(url, headers={'User-Agent': 'SESHAT-Mars-Map-Compiler/1.0'})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    cache_file.write_bytes(resp.read())
            except urllib.error.URLError as exc:
                raise RuntimeError(f'Failed to cache Viking tile {z}/{y}/{x}: {exc}') from exc
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(cache_file.read_bytes())
        keys.append(f'{z}/{y}/{x}')
    return keys


def _tile_jezero_ctx(ortho_path: Path, out_dir: Path) -> tuple[list[float], list[str], str]:
    """Slice 6 m Jezero CTX orthomosaic into Mars Trek Plate Carree WebP tiles (z=8..13)."""
    if not ortho_path.is_file():
        raise FileNotFoundError(f'Missing orthomosaic GeoTIFF: {ortho_path}')
    out_dir.mkdir(parents=True, exist_ok=True)
    ortho_sha = _sha256(ortho_path)

    with rasterio.open(ortho_path) as src:
        proj = PyprojCRS.from_wkt(src.crs.to_wkt())
        r = float(proj.ellipsoid.semi_major_metre)
        geo = PyprojCRS.from_proj4(f'+proj=longlat +a={r} +b={r} +no_defs')
        t = Transformer.from_crs(proj, geo, always_xy=True)
        west_full, south_full = t.transform(src.bounds.left, src.bounds.bottom)
        east_full, north_full = t.transform(src.bounds.right, src.bounds.top)

        # Normalize positive-east -> [-180, 180)
        west_full = ((west_full + 180.0) % 360.0) - 180.0
        east_full = ((east_full + 180.0) % 360.0) - 180.0

        keys: list[str] = []
        for z in range(JEZERO_FULL_MIN_Z, JEZERO_FAN_Z + 1):
            span = 180.0 / (2 ** z)
            if z <= JEZERO_FULL_MAX_Z:
                w_lim, s_lim, e_lim, n_lim = west_full, south_full, east_full, north_full
            else:
                w_lim, s_lim, e_lim, n_lim = JEZERO_FAN_BOUNDS
            x0 = int((w_lim + 180.0) / span)
            x1 = int((e_lim + 180.0) / span)
            y0 = int((90.0 - n_lim) / span)
            y1 = int((90.0 - s_lim) / span)

            for y in range(y0, y1 + 1):
                north = 90.0 - y * span
                south = north - span
                for x in range(x0, x1 + 1):
                    west = -180.0 + x * span
                    east = west + span
                    win = window_from_bounds(west * DEG_TO_M, south * DEG_TO_M, east * DEG_TO_M, north * DEG_TO_M, src.transform)
                    arr = src.read(
                        1,
                        window=win,
                        out_shape=(256, 256),
                        boundless=True,
                        fill_value=0,
                        resampling=Resampling.bilinear,
                    )
                    if not np.any(arr > 0):
                        continue
                    alpha = np.where(arr > 0, 255, 0).astype(np.uint8)
                    rgba = np.stack([arr, arr, arr, alpha], axis=-1)
                    tile_path = out_dir / str(z) / str(y) / f'{x}.webp'
                    tile_path.parent.mkdir(parents=True, exist_ok=True)
                    Image.fromarray(rgba, mode='RGBA').save(tile_path, format='WEBP', quality=82, method=4)
                    keys.append(f'{z}/{y}/{x}')

    return [south_full, west_full, north_full, east_full], keys, ortho_sha


def _compile_thermal_inertia(ti_path: Path, bundle_dir: Path, manifest: dict, geo_bounds: list[float]) -> dict | None:
    if not ti_path.is_file():
        return None
    h, w = int(manifest['height']), int(manifest['width'])
    dst_crs = CRS.from_wkt(manifest['crsWkt'])
    dst_transform = Affine(*manifest['rasterTransform'])
    ti = np.full((h, w), np.nan, dtype=np.float32)
    with rasterio.open(ti_path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=ti,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=dst_transform,
            dst_crs=dst_crs,
            dst_nodata=np.nan,
            resampling=Resampling.nearest,
        )
    valid = np.isfinite(ti) & (ti > 0)
    bin_path = bundle_dir / 'thermal-inertia.bin'
    bin_path.write_bytes(np.where(valid, ti, np.nan).astype('<f4').tobytes())

    # Render colorized thermal inertia RGBA overlay (warm amber-to-emerald ramp)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    if valid.any():
        lo, hi = float(np.percentile(ti[valid], 2)), float(np.percentile(ti[valid], 98))
        span = max(1e-6, hi - lo)
        norm = np.clip((np.nan_to_num(ti, nan=lo) - lo) / span, 0.0, 1.0)
        rgba[..., 0] = np.clip(45 + 205 * norm, 0, 255).astype(np.uint8)
        rgba[..., 1] = np.clip(90 + 110 * (1.0 - np.abs(norm - 0.5) * 2.0), 0, 255).astype(np.uint8)
        rgba[..., 2] = np.clip(185 * (1.0 - norm) + 35, 0, 255).astype(np.uint8)
        rgba[..., 3] = np.where(valid, 195, 0).astype(np.uint8)
    geo_img = _reproject_aeqd_rgba_to_geo(rgba, manifest, geo_bounds)
    geo_path = bundle_dir / 'imagery' / 'thermal-inertia-geo.webp'
    geo_img.save(geo_path, format='WEBP', lossless=True)

    return {
        'binaryPath': 'thermal-inertia.bin',
        'binaryBytes': bin_path.stat().st_size,
        'binarySha256': _sha256(bin_path),
        'geoImagePath': 'imagery/thermal-inertia-geo.webp',
        'geoImageSha256': _sha256(geo_path),
        'units': 'J m⁻² K⁻¹ s⁻¹/²',
        'nativeSpacingMeters': 100,
        'resampledToMeters': float(manifest['cellWidthMeters']),
        'validCells': int(valid.sum()),
        'minValue': round(float(np.min(ti[valid])), 2) if valid.any() else None,
        'maxValue': round(float(np.max(ti[valid])), 2) if valid.any() else None,
        'credit': 'Edwards & Buz (2021) Jezero Thermal Inertia Map v1 (Zenodo 4931348)',
        'sourceUrl': 'https://zenodo.org/records/4931348',
    }


def _compile_geologic_units(source_path: Path, bundle_dir: Path, manifest: dict, geo_bounds: list[float]) -> dict | None:
    if not source_path.is_file():
        return None
    dst_crs = PyprojCRS.from_wkt(manifest['crsWkt'])
    h, w = int(manifest['height']), int(manifest['width'])
    aff = Affine(*manifest['rasterTransform'])
    shapes_by_unit: dict[str, list[dict]] = {}
    with ZipFile(source_path) as archive:
        members = {Path(name).suffix.lower(): name for name in archive.namelist()}
        src_crs = PyprojCRS.from_wkt(archive.read(members['.prj']).decode())
        to_source = Transformer.from_crs(dst_crs, src_crs, always_xy=True)
        west, north = aff * (0, 0)
        east, south = aff * (w, h)
        bounds = to_source.transform_bounds(west, south, east, north, densify_pts=21)
        with shapefile.Reader(**{ext: io.BytesIO(archive.read(members[f'.{ext}'])) for ext in ('shp', 'shx', 'dbf')}) as reader:
            for record in reader.iterShapeRecords(bbox=bounds):
                unit = record.record['BedrkUName'].strip()
                if unit and unit.lower() not in {'unknown', 'undifferentiated', 'unassigned'}:
                    geometry = transform_geom(src_crs.to_wkt(), dst_crs.to_wkt(), record.shape.__geo_interface__)
                    shapes_by_unit.setdefault(unit, []).append(geometry)

    units_meta = []
    unit_grid = np.zeros((h, w), dtype=np.uint8)
    memberships = np.zeros((h, w), dtype=np.uint8)
    for unit, shapes in sorted(shapes_by_unit.items()):
        mask = rasterio.features.rasterize(shapes, out_shape=(h, w), transform=aff, dtype='uint8').astype(bool)
        if not mask.any():
            continue
        idx = len(units_meta) + 1
        color = UNIT_PALETTE[(idx - 1) % len(UNIT_PALETTE)]
        units_meta.append({'index': idx, 'symbol': unit, 'name': unit,
                           'color': '#%02x%02x%02x' % color})
        memberships[mask] += 1
        unit_grid[mask] = idx
    unit_grid[memberships != 1] = 0
    bin_path = bundle_dir / 'geologic-units.bin'
    bin_path.write_bytes(unit_grid.tobytes())

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for unit in units_meta:
        mask_u = unit_grid == unit['index']
        if mask_u.any():
            r_c, g_c, b_c = UNIT_PALETTE[(unit['index'] - 1) % len(UNIT_PALETTE)]
            rgba[mask_u] = (r_c, g_c, b_c, 165)
    geo_img = _reproject_aeqd_rgba_to_geo(rgba, manifest, geo_bounds)
    geo_path = bundle_dir / 'imagery' / 'geologic-units-geo.webp'
    geo_img.save(geo_path, format='WEBP', lossless=True)

    target_units: dict[str, str] = {}
    for t in manifest.get('scienceTargets', []):
        r_t, c_t = t['location'].get('gridRow'), t['location'].get('gridCol')
        if r_t is not None and c_t is not None and 0 <= r_t < h and 0 <= c_t < w:
            uidx = int(unit_grid[r_t, c_t])
            if uidx > 0:
                target_units[t['id']] = units_meta[uidx - 1]['symbol']

    meta_json = {
        'sourceTitle': 'Stack et al. (2020), Photogeologic Map of the Perseverance Rover Field Site',
        'sourceUrl': 'https://doi.org/10.1007/s11214-020-00739-x',
        'sourceFileSha256': _sha256(source_path),
        'licenseNote': 'CC BY 4.0 per 2025 publisher correction. Bedrock polygons clipped and rasterized to Mars AEQD; conflicting units omitted.',
        'conflictingCells': int((memberships > 1).sum()),
        'width': w,
        'height': h,
        'unknownCells': int((unit_grid == 0).sum()),
        'units': units_meta,
        'targetUnits': target_units,
    }
    json_path = bundle_dir / 'geologic-units.json'
    json_path.write_text(json.dumps(meta_json, indent=2) + '\n')

    return {
        'binaryPath': 'geologic-units.bin',
        'binaryBytes': bin_path.stat().st_size,
        'binarySha256': _sha256(bin_path),
        'jsonPath': 'geologic-units.json',
        'jsonSha256': _sha256(json_path),
        'geoImagePath': 'imagery/geologic-units-geo.webp',
        'geoImageSha256': _sha256(geo_path),
        'unitCount': len(units_meta),
        'unknownCells': int((unit_grid == 0).sum()),
        'credit': meta_json['sourceTitle'],
        'sourceUrl': meta_json['sourceUrl'],
    }


def _compile_meda_context(meda_dir: Path, bundle_dir: Path) -> dict | None:
    if not meda_dir.is_dir():
        return None
    ps_files = sorted(meda_dir.glob('WE__*DER_PS*.CSV'))
    if not ps_files:
        return None
    sols: list[dict] = []
    for path in ps_files:
        sol_num = int(path.name[4:8])
        label = path.with_suffix('.xml')
        if not label.is_file():
            continue
        pressures: list[float] = []
        with path.open(newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                local_day = row.get('LTST', '').split(maxsplit=1)
                if not local_day or local_day[0] != f'{sol_num:04d}':
                    continue
                val = row.get('PRESSURE', '').strip()
                if val:
                    try:
                        p = float(val)
                        if 0 < p <= 2000:
                            pressures.append(p)
                    except ValueError:
                        continue
        if pressures:
            sols.append({
                'sol': sol_num,
                'file': path.name,
                'sourceFileSha256': _sha256(path),
                'labelSha256': _sha256(label),
                'validRecords': len(pressures),
                'minPa': round(min(pressures), 2),
                'medianPa': round(statistics.median(pressures), 2),
                'maxPa': round(max(pressures), 2),
            })

    summary = {
        'instrument': 'NASA PDS Mars 2020 MEDA Pressure Sensor (PS)',
        'sourceUrl': 'https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/',
        'units': 'Pa',
        'note': 'Historical Jezero observations. Rows match the file sol in local true solar time and pass the project plausibility screen of 0 < pressure ≤ 2,000 Pa.',
        'sols': sols,
        'unavailableFields': {
            'boulderRoughness': 'Unavailable (20 m CTX DEM does not resolve sub-meter boulders or regolith cohesion)',
            'localWind': 'Unavailable (MEDA PS context includes pressure only; wind forecast excluded)',
            'solarIllumination': 'Unavailable (dynamic solar elevation/shadow model excluded from static bundle)',
            'radiationDose': 'Unavailable (active particle/RAD forecast excluded from static bundle)',
        },
    }
    out_path = bundle_dir / 'meda-context.json'
    out_path.write_text(json.dumps(summary, indent=2) + '\n')
    return {
        'jsonPath': 'meda-context.json',
        'jsonSha256': _sha256(out_path),
        'sols': [s['sol'] for s in sols],
        'credit': summary['instrument'],
        'sourceUrl': summary['sourceUrl'],
    }


def compile_mars_map(
    raw_dir: Path = Path('data/raw'),
    bundle_dir: Path = Path('public/data'),
    skip_viking_download: bool = False,
) -> dict:
    manifest_path = bundle_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())

    geo_bounds, boundary_poly = _grid_geo_bounds_and_polygon(manifest)

    # Reproject shaded relief and aligned orbital image to exact Plate Carree display rasters
    hillshade_src = np.array(Image.open(bundle_dir / manifest['imagery']['path']).convert('RGBA'))
    terrain_geo_path = bundle_dir / 'imagery' / 'study-area-geo.webp'
    _reproject_aeqd_rgba_to_geo(hillshade_src, manifest, geo_bounds).save(terrain_geo_path, format='WEBP', lossless=True)

    orbital_geo_rel = None
    if manifest.get('optical') and (bundle_dir / manifest['optical']['path']).is_file():
        orbital_src = np.array(Image.open(bundle_dir / manifest['optical']['path']).convert('RGBA'))
        orbital_geo_path = bundle_dir / 'imagery' / 'orbital-geo.webp'
        _reproject_aeqd_rgba_to_geo(orbital_src, manifest, geo_bounds).save(orbital_geo_path, format='WEBP', lossless=True)
        orbital_geo_rel = 'imagery/orbital-geo.webp'

    # Prepare Viking level 0-2 global + level 3-7 Jezero corridor tiles
    viking_dir = bundle_dir / 'tiles' / 'viking'
    if skip_viking_download and (raw_dir / 'viking_tiles').exists():
        viking_keys = sorted(
            str(p.relative_to(viking_dir)).replace('.jpg', '')
            for p in viking_dir.rglob('*.jpg')
        ) if viking_dir.exists() else []
    else:
        viking_keys = _prepare_viking_tiles(raw_dir / 'viking_tiles', viking_dir)

    # Slice wider Jezero 6 m CTX orthomosaic pyramid
    ortho_path = raw_dir / 'trek-ctx-orthomosaic.tif'
    jezero_bounds, jezero_keys, ortho_sha = _tile_jezero_ctx(ortho_path, bundle_dir / 'tiles' / 'jezero')

    # Compile optional context layers
    ti_info = _compile_thermal_inertia(raw_dir / 'Jezero_Thermal_Inertia_v1.tiff', bundle_dir, manifest, geo_bounds)
    geo_info = _compile_geologic_units(raw_dir / 'jezero-photogeology.zip', bundle_dir, manifest, geo_bounds)
    meda_info = _compile_meda_context(raw_dir / 'meda', bundle_dir)

    manifest['mapDisplay'] = {
        'projection': 'MARS_PLANETOCENTRIC_PLATE_CARREE',
        'marsRadiusMeters': float(manifest.get('sourceBodyRadiusMeters', MARS_RADIUS_M)),
        'geographicBounds': [round(v, 7) for v in geo_bounds],
        'boundaryPolygonLatLng': boundary_poly,
        'terrainGeoPath': 'imagery/study-area-geo.webp',
        'terrainGeoSha256': _sha256(terrain_geo_path),
        'orbitalGeoPath': orbital_geo_rel,
        'orbitalGeoSha256': _sha256(bundle_dir / orbital_geo_rel) if orbital_geo_rel else None,
        'vikingTileTemplate': VIKING_URL_TEMPLATE,
        'localVikingTemplate': '/data/tiles/viking/{z}/{y}/{x}.jpg',
        'localVikingTiles': viking_keys,
        'jezeroTileTemplate': '/data/tiles/jezero/{z}/{y}/{x}.webp',
        'jezeroFullMaxZoom': JEZERO_FULL_MAX_Z,
        'jezeroFanZoom': JEZERO_FAN_Z,
        'jezeroTileBounds': [round(v, 7) for v in jezero_bounds],
        'jezeroSourceSha256': ortho_sha,
        'jezeroTiles': jezero_keys,
        'credits': [
            'Mars Global Color Mosaic: NASA/JPL Mars Trek · USGS Viking MDIM 2.1 (232 m)',
            'Wider Jezero Orbital Mosaic: NASA/JPL Mars Trek MRO CTX Controlled 6 m Mosaic',
            'Modeled Routing Grid: USGS MRO CTX 20 m DTM (local spherical Mars AEQD)',
            'Geologic Context: Stack et al. (2020) photogeologic map, CC BY 4.0',
            'Thermal Inertia: Edwards & Buz (2021) Jezero v1 (100 m resampled for display)',
            'Surface Pressure: NASA PDS Mars 2020 MEDA (sols 490, 509, 575)',
        ],
    }
    manifest['contextLayers'] = {
        'thermalInertia': ti_info,
        'geologicUnits': geo_info,
        'medaPressure': meda_info,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    return {
        'vikingTiles': len(viking_keys),
        'jezeroTiles': len(jezero_keys),
        'geoBounds': geo_bounds,
        'jezeroBounds': jezero_bounds,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, default=Path('data/raw'))
    parser.add_argument('--bundle-dir', type=Path, default=Path('public/data'))
    args = parser.parse_args()
    summary = compile_mars_map(args.raw_dir, args.bundle_dir)
    print(json.dumps(summary, indent=2))
