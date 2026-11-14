"""Compile the 2-layer chunk neighborhood (5x5 chunks = 22.0 km x 22.0 km) around the central Jezero chunk.

Processes the central 220x220 chunk (Ring 0) plus Ring 1 (8 chunks) and Ring 2 (16 chunks)
= 25 chunks total (1,100 x 1,100 source 20 m CTX DEM pixels = 22.0 km x 22.0 km) in the exact
same Spherical Mars Azimuthal Equidistant (AEQD) reference frame (R = 3,396,190 m).

Emits into `public/data/`:
  - `neighborhood-elevation.bin` (550x550 float32 at 40 m/cell covering [-11,000 m, +11,000 m])
  - `neighborhood-mask.bin` (550x550 uint8 validity mask)
  - `imagery/neighborhood-terrain-geo.webp` (Plate Carree DEM shaded relief over 5x5 chunks)
  - `imagery/neighborhood-heatmap-geo.webp` (Plate Carree hypsometric elevation heatmap over 5x5 chunks)
  - `imagery/neighborhood-orbital-geo.webp` (Aligned CTX orbital mosaic over 5x5 chunks)
  - Updates `public/data/manifest.json` (`mapDisplay.neighborhood`) with 25 chunk descriptors & hashes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

from .acquire import DTM_NAME

MARS_RADIUS_M = 3396190.0


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _aeqd_to_lonlat_rad(
    x: np.ndarray,
    y: np.ndarray,
    lat0_rad: float,
    lon0_rad: float,
    radius: float = MARS_RADIUS_M,
) -> tuple[np.ndarray, np.ndarray]:
    rho = np.hypot(x, y)
    c = rho / radius
    sin_c, cos_c = np.sin(c), np.cos(c)
    sin_lat0, cos_lat0 = math.sin(lat0_rad), math.cos(lat0_rad)
    safe_rho = np.maximum(rho, 1e-12)
    sin_lat = np.where(
        rho < 1e-12,
        sin_lat0,
        np.clip(cos_c * sin_lat0 + (y * sin_c * cos_lat0) / safe_rho, -1.0, 1.0),
    )
    lat = np.arcsin(sin_lat)
    lon = np.where(
        rho < 1e-12,
        lon0_rad,
        lon0_rad + np.arctan2(x * sin_c, safe_rho * cos_lat0 * cos_c - y * sin_lat0 * sin_c),
    )
    return lon, lat


def _lonlat_deg_to_aeqd(
    lon_deg: np.ndarray,
    lat_deg: np.ndarray,
    lat0_deg: float,
    lon0_deg: float,
    radius: float = MARS_RADIUS_M,
) -> tuple[np.ndarray, np.ndarray]:
    lat0 = math.radians(lat0_deg)
    lat = np.radians(lat_deg)
    dlon = np.radians(((lon_deg - lon0_deg + 180.0) % 360.0) - 180.0)
    sin_lat0, cos_lat0 = math.sin(lat0), math.cos(lat0)
    sin_lat, cos_lat = np.sin(lat), np.cos(lat)
    cos_c = np.clip(sin_lat0 * sin_lat + cos_lat0 * cos_lat * np.cos(dlon), -1.0, 1.0)
    c = np.arccos(cos_c)
    k = np.where(c < 1e-12, 1.0, c / np.maximum(np.sin(c), 1e-12))
    x = radius * k * cos_lat * np.sin(dlon)
    y = radius * k * (cos_lat0 * sin_lat - sin_lat0 * cos_lat * np.cos(dlon))
    return x, y


def _render_hillshade_rgba(z: np.ndarray, valid: np.ndarray, dx: float, dy: float) -> np.ndarray:
    fill = np.where(valid, z, float(np.nanmedian(z[valid])))
    dzdy, dzdx = np.gradient(fill, dy, dx)
    nx, ny, nz = -dzdx, -dzdy, np.ones_like(z)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    light = np.array([-0.45, -0.45, 0.77], dtype=np.float64)
    light /= np.linalg.norm(light)
    illum = np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / norm, 0.0, 1.0)
    lo, hi = np.percentile(z[valid], [2, 98])
    tint = np.clip((fill - lo) / max(1e-9, hi - lo), 0.0, 1.0)
    shade = 0.36 + 0.64 * illum
    rgba = np.zeros((*z.shape, 4), dtype=np.uint8)
    rgba[..., 0] = np.clip((78 + 72 * tint) * shade, 0, 255).astype(np.uint8)
    rgba[..., 1] = np.clip((53 + 52 * tint) * shade, 0, 255).astype(np.uint8)
    rgba[..., 2] = np.clip((46 + 40 * tint) * shade, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 240, 0).astype(np.uint8)
    return rgba


def _elev_to_hypsometric_t(fill: np.ndarray, min_z: float, max_z: float) -> np.ndarray:
    span = max(1e-6, max_z - min_z)
    if span > 400.0 and min_z < -2560.0 and max_z > -2350.0:
        z_floor = -2555.0
        z_delta_peak = -2415.0
        t = np.zeros_like(fill, dtype=np.float64)
        low_mask = fill <= z_floor
        mid_mask = (fill > z_floor) & (fill <= z_delta_peak)
        high_mask = fill > z_delta_peak
        t = np.where(low_mask, np.clip((fill - min_z) / max(1e-6, z_floor - min_z), 0.0, 1.0) * 0.22, t)
        t = np.where(mid_mask, 0.22 + ((fill - z_floor) / (z_delta_peak - z_floor)) * 0.54, t)
        t = np.where(high_mask, 0.76 + np.clip((fill - z_delta_peak) / max(1e-6, max_z - z_delta_peak), 0.0, 1.0) * 0.24, t)
        return np.clip(t, 0.0, 1.0)
    return np.clip((fill - min_z) / span, 0.0, 1.0)


def _render_hypsometric_rgba(
    z: np.ndarray,
    valid: np.ndarray,
    dx: float,
    dy: float,
    min_z: float,
    max_z: float,
) -> np.ndarray:
    fill = np.where(valid, z, min_z)
    dzdy, dzdx = np.gradient(fill, dy, dx)
    nx, ny, nz = -dzdx, -dzdy, np.ones_like(z)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    light = np.array([-0.45, -0.45, 0.77], dtype=np.float64)
    light /= np.linalg.norm(light)
    illum = np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / norm, 0.0, 1.0)
    shade = 0.65 + 0.35 * illum

    t = _elev_to_hypsometric_t(fill, min_z, max_z)

    r = np.zeros_like(t)
    g = np.zeros_like(t)
    b = np.zeros_like(t)

    # 0.00 -> 0.22: Deep basin indigo-blue (25, 28, 135) to cyan-blue (20, 165, 215)
    m1 = t <= 0.22
    u1 = t / 0.22
    r = np.where(m1, 25 + u1 * (20 - 25), r)
    g = np.where(m1, 28 + u1 * (165 - 28), g)
    b = np.where(m1, 135 + u1 * (215 - 135), b)

    # 0.22 -> 0.46: Cyan-blue (20, 165, 215) to emerald green (34, 197, 94)
    m2 = (t > 0.22) & (t <= 0.46)
    u2 = (t - 0.22) / 0.24
    r = np.where(m2, 20 + u2 * (34 - 20), r)
    g = np.where(m2, 165 + u2 * (197 - 165), g)
    b = np.where(m2, 215 + u2 * (94 - 215), b)

    # 0.46 -> 0.62: Emerald green (34, 197, 94) to warm amber-gold (245, 165, 15)
    m3 = (t > 0.46) & (t <= 0.62)
    u3 = (t - 0.46) / 0.16
    r = np.where(m3, 34 + u3 * (245 - 34), r)
    g = np.where(m3, 197 + u3 * (165 - 197), g)
    b = np.where(m3, 94 + u3 * (15 - 94), b)

    # 0.62 -> 0.76: Warm amber-gold (245, 165, 15) to vivid peak red (235, 50, 40) [Central chunk peaks!]
    m4 = (t > 0.62) & (t <= 0.76)
    u4 = (t - 0.62) / 0.14
    r = np.where(m4, 245 + u4 * (235 - 245), r)
    g = np.where(m4, 165 + u4 * (50 - 165), g)
    b = np.where(m4, 15 + u4 * (40 - 15), b)

    # 0.76 -> 1.00: Vivid red (235, 50, 40) to high-rim crimson/rose crest (248, 175, 195)
    m5 = t > 0.76
    u5 = (t - 0.76) / 0.24
    r = np.where(m5, 235 + u5 * (248 - 235), r)
    g = np.where(m5, 50 + u5 * (175 - 50), g)
    b = np.where(m5, 40 + u5 * (195 - 40), b)

    rgba = np.zeros((*z.shape, 4), dtype=np.uint8)
    rgba[..., 0] = np.clip(r * shade, 0, 255).astype(np.uint8)
    rgba[..., 1] = np.clip(g * shade, 0, 255).astype(np.uint8)
    rgba[..., 2] = np.clip(b * shade, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 215, 0).astype(np.uint8)
    return rgba


def _reproject_aeqd_rgba_to_plate_carree(
    rgba_aeqd: np.ndarray,
    half_extent_m: float,
    cell_m: float,
    lat0_deg: float,
    lon0_deg: float,
    geo_bounds: list[float],
    out_w: int = 880,
    out_h: int = 880,
) -> Image.Image:
    south, west, north, east = geo_bounds
    lats = np.linspace(north - (north - south) / (2 * out_h), south + (north - south) / (2 * out_h), out_h)
    lons = np.linspace(west + (east - west) / (2 * out_w), east - (east - west) / (2 * out_w), out_w)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    x, y = _lonlat_deg_to_aeqd(lon_grid, lat_grid, lat0_deg, lon0_deg)

    h, w, _ = rgba_aeqd.shape
    col_f = (x + half_extent_m) / cell_m - 0.5
    row_f = (half_extent_m - y) / cell_m - 0.5
    inside = (row_f >= 0) & (row_f < h - 1) & (col_f >= 0) & (col_f < w - 1)

    r0 = np.clip(np.floor(row_f).astype(np.int32), 0, h - 2)
    c0 = np.clip(np.floor(col_f).astype(np.int32), 0, w - 2)
    dr = (row_f - r0)[..., None]
    dc = (col_f - c0)[..., None]

    v00 = rgba_aeqd[r0, c0].astype(np.float32)
    v01 = rgba_aeqd[r0, c0 + 1].astype(np.float32)
    v10 = rgba_aeqd[r0 + 1, c0].astype(np.float32)
    v11 = rgba_aeqd[r0 + 1, c0 + 1].astype(np.float32)
    interp = (1 - dr) * (1 - dc) * v00 + (1 - dr) * dc * v01 + dr * (1 - dc) * v10 + dr * dc * v11
    out = np.clip(np.round(interp), 0, 255).astype(np.uint8)
    out[~inside, 3] = 0
    return Image.fromarray(out, mode='RGBA')


def _composite_orbital_from_jezero_tiles(
    tiles_dir: Path,
    geo_bounds: list[float],
    out_w: int = 880,
    out_h: int = 880,
    z: int = 12,
) -> Image.Image | None:
    south, west, north, east = geo_bounds
    span = 180.0 / (2 ** z)
    x0 = int((west + 180.0) / span)
    x1 = int((east + 180.0) / span)
    y0 = int((90.0 - north) / span)
    y1 = int((90.0 - south) / span)

    canvas_w = (x1 - x0 + 1) * 256
    canvas_h = (y1 - y0 + 1) * 256
    mosaic = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    found = False
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = tiles_dir / str(z) / str(y) / f'{x}.webp'
            if p.is_file():
                tile = Image.open(p).convert('RGBA')
                mosaic.paste(tile, ((x - x0) * 256, (y - y0) * 256))
                found = True
    if not found:
        return None

    mosaic_west = -180.0 + x0 * span
    mosaic_north = 90.0 - y0 * span
    mosaic_east = -180.0 + (x1 + 1) * span
    mosaic_south = 90.0 - (y1 + 1) * span

    left_px = (west - mosaic_west) / (mosaic_east - mosaic_west) * canvas_w
    right_px = (east - mosaic_west) / (mosaic_east - mosaic_west) * canvas_w
    top_px = (mosaic_north - north) / (mosaic_north - mosaic_south) * canvas_h
    bottom_px = (mosaic_north - south) / (mosaic_north - mosaic_south) * canvas_h

    cropped = mosaic.crop((left_px, top_px, right_px, bottom_px)).resize((out_w, out_h), Image.Resampling.BILINEAR)
    return cropped


def compile_neighborhood(
    dem_path: Path = Path('data/raw') / DTM_NAME,
    bundle_dir: Path = Path('public/data'),
    rings: int = 2,
    grid_side: int = 550,
) -> dict:
    if not dem_path.is_file():
        raise FileNotFoundError(f'Missing raw DEM: {dem_path}. Run `python3 -m pipeline.acquire --only dem`.')

    manifest_path = bundle_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())

    # Central chunk is 220x220 at 20 m/cell = 4,400 m.
    # With `rings=2` (2 layers of chunks around the center), we have (2*rings + 1) = 5x5 chunks = 22,000 m x 22,000 m.
    chunks_per_side = 2 * rings + 1
    chunk_span_m = 220 * 20.0  # 4,400.0 m per chunk
    total_span_m = chunks_per_side * chunk_span_m  # 22,000.0 m for 5x5 chunks
    half_extent_m = total_span_m / 2.0  # 11,000.0 m
    cell_m = total_span_m / grid_side  # 40.0 m/cell for 550x550 grid

    lat0_deg = float(manifest['analysisCenterPlanetocentricLat'])
    lon0_deg = float(manifest['analysisCenterPositiveEastLon'])
    lat0_rad = math.radians(lat0_deg)
    lon0_rad = math.radians(lon0_deg)

    # Source Equirectangular Mars 2000 Sphere transform
    win_row, win_col, _, _ = manifest['sourceWindow']
    src_a, _, src_c, _, src_e, src_f = manifest['sourceRasterTransform']
    full_x0 = float(src_c) - win_col * float(src_a)
    full_y0 = float(src_f) - win_row * float(src_e)  # src_e is -20.0

    dem = np.array(Image.open(dem_path), dtype=np.float64)
    dem_h, dem_w = dem.shape

    rows, cols = np.meshgrid(np.arange(grid_side) + 0.5, np.arange(grid_side) + 0.5, indexing='ij')
    x = -half_extent_m + cols * cell_m
    y = half_extent_m - rows * cell_m
    lon_rad, lat_rad = _aeqd_to_lonlat_rad(x, y, lat0_rad, lon0_rad, MARS_RADIUS_M)

    src_x = MARS_RADIUS_M * (lon_rad % (2.0 * math.pi))
    src_y = MARS_RADIUS_M * lat_rad
    src_col = (src_x - full_x0) / 20.0 - 0.5
    src_row = (full_y0 - src_y) / 20.0 - 0.5

    in_bounds = (src_row >= 0) & (src_row < dem_h - 1) & (src_col >= 0) & (src_col < dem_w - 1)
    r0 = np.clip(np.floor(src_row).astype(np.int32), 0, dem_h - 2)
    c0 = np.clip(np.floor(src_col).astype(np.int32), 0, dem_w - 2)
    dr = src_row - r0
    dc = src_col - c0

    v00 = dem[r0, c0]
    v01 = dem[r0, c0 + 1]
    v10 = dem[r0 + 1, c0]
    v11 = dem[r0 + 1, c0 + 1]
    valid = (
        in_bounds
        & np.isfinite(v00) & (v00 > -1e30)
        & np.isfinite(v01) & (v01 > -1e30)
        & np.isfinite(v10) & (v10 > -1e30)
        & np.isfinite(v11) & (v11 > -1e30)
    )
    z = np.where(
        valid,
        (1.0 - dr) * (1.0 - dc) * v00
        + (1.0 - dr) * dc * v01
        + dr * (1.0 - dc) * v10
        + dr * dc * v11,
        np.nan,
    )
    z_f32 = z.astype('<f4')
    mask_u8 = valid.astype(np.uint8)

    elev_bin_path = bundle_dir / 'neighborhood-elevation.bin'
    mask_bin_path = bundle_dir / 'neighborhood-mask.bin'
    elev_bin_path.write_bytes(z_f32.tobytes(order='C'))
    mask_bin_path.write_bytes(mask_u8.tobytes(order='C'))

    min_z = round(float(np.nanmin(z[valid])), 2)
    max_z = round(float(np.nanmax(z[valid])), 2)

    # Compute perimeter polygon and geographic bounds for the 5x5 chunk grid
    steps = 40
    edge_pts: list[tuple[float, float]] = []
    for i in range(steps):
        edge_pts.append((-half_extent_m + (i / steps) * total_span_m, half_extent_m))
    for i in range(steps):
        edge_pts.append((half_extent_m, half_extent_m - (i / steps) * total_span_m))
    for i in range(steps):
        edge_pts.append((half_extent_m - (i / steps) * total_span_m, -half_extent_m))
    for i in range(steps):
        edge_pts.append((-half_extent_m, -half_extent_m + (i / steps) * total_span_m))

    ex = np.array([p[0] for p in edge_pts])
    ey = np.array([p[1] for p in edge_pts])
    elon_rad, elat_rad = _aeqd_to_lonlat_rad(ex, ey, lat0_rad, lon0_rad, MARS_RADIUS_M)
    elat_deg = np.degrees(elat_rad)
    elon_deg = ((np.degrees(elon_rad) + 180.0) % 360.0) - 180.0

    geo_bounds = [
        round(float(np.min(elat_deg)), 7),
        round(float(np.min(elon_deg)), 7),
        round(float(np.max(elat_deg)), 7),
        round(float(np.max(elon_deg)), 7),
    ]
    boundary_poly = [[round(float(la), 7), round(float(lo), 7)] for la, lo in zip(elat_deg, elon_deg)]

    # Render 5x5 neighborhood terrain hillshade and hypsometric heatmap in Plate Carree
    imagery_dir = bundle_dir / 'imagery'
    imagery_dir.mkdir(parents=True, exist_ok=True)

    hillshade_aeqd = _render_hillshade_rgba(z, valid, cell_m, cell_m)
    terrain_geo_img = _reproject_aeqd_rgba_to_plate_carree(
        hillshade_aeqd, half_extent_m, cell_m, lat0_deg, lon0_deg, geo_bounds, out_w=880, out_h=880
    )
    terrain_geo_path = imagery_dir / 'neighborhood-terrain-geo.webp'
    terrain_geo_img.save(terrain_geo_path, format='WEBP', quality=88, method=4)

    heatmap_aeqd = _render_hypsometric_rgba(z, valid, cell_m, cell_m, min_z, max_z)
    heatmap_geo_img = _reproject_aeqd_rgba_to_plate_carree(
        heatmap_aeqd, half_extent_m, cell_m, lat0_deg, lon0_deg, geo_bounds, out_w=880, out_h=880
    )
    heatmap_geo_path = imagery_dir / 'neighborhood-heatmap-geo.webp'
    heatmap_geo_img.save(heatmap_geo_path, format='WEBP', quality=90, method=4)

    orbital_geo_rel = None
    orbital_geo_sha = None
    orbital_img = _composite_orbital_from_jezero_tiles(bundle_dir / 'tiles' / 'jezero', geo_bounds, out_w=880, out_h=880)
    if orbital_img is not None:
        orbital_geo_path = imagery_dir / 'neighborhood-orbital-geo.webp'
        orbital_img.save(orbital_geo_path, format='WEBP', quality=86, method=4)
        orbital_geo_rel = 'imagery/neighborhood-orbital-geo.webp'
        orbital_geo_sha = _sha256(orbital_geo_path)

    # Build metadata for each of the 25 chunks (Center [0,0], Ring 1 [8 chunks], Ring 2 [16 chunks])
    chunk_cells = grid_side // chunks_per_side  # 110x110 cells per chunk at 40m
    dzdy, dzdx = np.gradient(np.where(valid, z, min_z), cell_m, cell_m)
    slope_deg = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))

    chunks_meta: list[dict] = []
    for cr in range(-rings, rings + 1):
        for cc in range(-rings, rings + 1):
            ring_level = max(abs(cr), abs(cc))
            r_idx = cr + rings
            c_idx = cc + rings
            r_start, r_end = r_idx * chunk_cells, (r_idx + 1) * chunk_cells
            c_start, c_end = c_idx * chunk_cells, (c_idx + 1) * chunk_cells
            sub_z = z[r_start:r_end, c_start:c_end]
            sub_v = valid[r_start:r_end, c_start:c_end]
            sub_s = slope_deg[r_start:r_end, c_start:c_end]

            x_west = cc * chunk_span_m - chunk_span_m / 2.0
            x_east = cc * chunk_span_m + chunk_span_m / 2.0
            y_north = -cr * chunk_span_m + chunk_span_m / 2.0
            y_south = -cr * chunk_span_m - chunk_span_m / 2.0

            cx_arr = np.array([x_west, x_east, x_east, x_west])
            cy_arr = np.array([y_north, y_north, y_south, y_south])
            clon_rad, clat_rad = _aeqd_to_lonlat_rad(cx_arr, cy_arr, lat0_rad, lon0_rad, MARS_RADIUS_M)
            clat_deg = np.degrees(clat_rad)
            clon_deg = ((np.degrees(clon_rad) + 180.0) % 360.0) - 180.0

            chunks_meta.append({
                'id': f'chunk_{cr:+d}_{cc:+d}',
                'rowOffset': cr,
                'colOffset': cc,
                'ring': ring_level,
                'label': 'Center Chunk (0, 0)' if ring_level == 0 else f'Ring {ring_level} · Chunk ({cr:+d}, {cc:+d})',
                'boundsLatLng': [
                    round(float(np.min(clat_deg)), 6),
                    round(float(np.min(clon_deg)), 6),
                    round(float(np.max(clat_deg)), 6),
                    round(float(np.max(clon_deg)), 6),
                ],
                'polygonLatLng': [[round(float(la), 6), round(float(lo), 6)] for la, lo in zip(clat_deg, clon_deg)],
                'minElevationMeters': round(float(np.nanmin(sub_z[sub_v])), 1) if sub_v.any() else None,
                'maxElevationMeters': round(float(np.nanmax(sub_z[sub_v])), 1) if sub_v.any() else None,
                'meanSlopeDegrees': round(float(np.nanmean(sub_s[sub_v])), 2) if sub_v.any() else None,
                'validCoverageRatio': round(float(sub_v.mean()), 4),
            })

    neighborhood_info = {
        'rings': rings,
        'chunksPerSide': chunks_per_side,
        'totalChunks': chunks_per_side * chunks_per_side,
        'sourceWindow': [int(win_row - rings * 220), int(win_col - rings * 220), chunks_per_side * 220, chunks_per_side * 220],
        'width': grid_side,
        'height': grid_side,
        'cellWidthMeters': cell_m,
        'cellHeightMeters': cell_m,
        'spanMeters': total_span_m,
        'rasterTransform': [cell_m, 0.0, -half_extent_m, 0.0, -cell_m, half_extent_m],
        'geographicBounds': geo_bounds,
        'boundaryPolygonLatLng': boundary_poly,
        'minElevationMeters': min_z,
        'maxElevationMeters': max_z,
        'elevationPath': 'neighborhood-elevation.bin',
        'elevationBytes': elev_bin_path.stat().st_size,
        'elevationSha256': _sha256(elev_bin_path),
        'maskPath': 'neighborhood-mask.bin',
        'maskBytes': mask_bin_path.stat().st_size,
        'maskSha256': _sha256(mask_bin_path),
        'terrainGeoPath': 'imagery/neighborhood-terrain-geo.webp',
        'terrainGeoSha256': _sha256(terrain_geo_path),
        'heatmapGeoPath': 'imagery/neighborhood-heatmap-geo.webp',
        'heatmapGeoSha256': _sha256(heatmap_geo_path),
        'orbitalGeoPath': orbital_geo_rel,
        'orbitalGeoSha256': orbital_geo_sha,
        'chunks': chunks_meta,
    }

    manifest.setdefault('mapDisplay', {})['neighborhood'] = neighborhood_info
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    return {
        'totalChunks': neighborhood_info['totalChunks'],
        'spanKm': total_span_m / 1000.0,
        'gridShape': [grid_side, grid_side],
        'minElevationMeters': min_z,
        'maxElevationMeters': max_z,
        'geographicBounds': geo_bounds,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dem', type=Path, default=Path('data/raw') / DTM_NAME)
    parser.add_argument('--bundle-dir', type=Path, default=Path('public/data'))
    parser.add_argument('--rings', type=int, default=2)
    parser.add_argument('--grid-side', type=int, default=550)
    args = parser.parse_args()
    summary = compile_neighborhood(args.dem, args.bundle_dir, args.rings, args.grid_side)
    print(json.dumps(summary, indent=2))
