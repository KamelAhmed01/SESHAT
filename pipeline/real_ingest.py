"""One-command ingestion of an actual NASA/USGS Jezero DEM into /public/data.

Input MUST be the downloaded real GeoTIFF. This script never creates fake terrain.
Output stays SOURCE_REVIEW_REQUIRED until a human checks Resources and frames.

  python -m pipeline.acquire
  python -m pipeline.real_ingest
"""
from __future__ import annotations
import argparse
import json
import hashlib
from pathlib import Path
import numpy as np
import rasterio
from pyproj import CRS, Transformer
from .acquire import DTM_NAME, SOURCES
from .compile import compile_dem


def find_window_and_base(dem: Path, side: int, center_row: int | None,
                         center_col: int | None) -> tuple[tuple[int, int, int, int], tuple[int, int]]:
    with rasterio.open(dem) as src:
        cy = center_row if center_row is not None else src.height // 2
        cx = center_col if center_col is not None else src.width // 2
        if not (0 <= cy < src.height and 0 <= cx < src.width):
            raise ValueError('Chosen absolute raster center lies outside the real DEM')
        height, width = min(side, src.height), min(side, src.width)
        row = min(max(0, cy - height // 2), src.height - height)
        col = min(max(0, cx - width // 2), src.width - width)
        values = src.read(1, window=rasterio.windows.Window(col,row,width,height),masked=True)
        valid = (~np.ma.getmaskarray(values)) & np.isfinite(np.ma.getdata(values))
        if not valid.any():
            raise ValueError('ROI has no valid terrain. Select a different center near target evidence.')
        local_r, local_c = cy-row, cx-col
        if not valid[local_r,local_c]:
            vr,vc=np.nonzero(valid)
            nearest=np.argmin((vr-local_r)**2+(vc-local_c)**2)
            local_r,local_c=int(vr[nearest]),int(vc[nearest])
        return (row,col,height,width),(int(local_r),int(local_c))


def ingest(dem: Path, out: Path, side=220, row: int | None=None, col: int | None=None,
           latitude: float | None=None, longitude: float | None=None):
    if not dem.is_file():
        raise FileNotFoundError(f'Missing real DEM: {dem}. Run `python -m pipeline.acquire --only dem` on a networked laptop.')
    if (latitude is None) != (longitude is None):
        raise ValueError('--center-lat and --center-lon must be supplied together')
    if latitude is not None:
        if not -90 <= latitude <= 90 or not 0 <= longitude < 360:
            raise ValueError('Planetocentric latitude [-90,90] and positive-east longitude [0,360) required')
        with rasterio.open(dem) as src:
            projected=CRS.from_wkt(src.crs.to_wkt()) if src.crs else None
            if not projected:
                raise ValueError('Unprojected DEM; cannot use Mars geographic center')
            radius=float(projected.ellipsoid.semi_major_metre)
            if not 3_000_000 < radius < 3_600_000:
                raise ValueError('DEM is not in a Mars-class planetary frame')
            geographic=CRS.from_proj4(f'+proj=longlat +a={radius} +b={radius} +no_defs')
            x,y=Transformer.from_crs(geographic,projected,always_xy=True).transform(longitude,latitude)
            row,col=map(int,rasterio.transform.rowcol(src.transform,x,y))
    window, base=find_window_and_base(dem,side,row,col)
    source=SOURCES['dem']
    acquisition=dem.parent/'acquisition.json'
    record=json.loads(acquisition.read_text()).get('dem',{}) if acquisition.exists() else {}
    file_sha=hashlib.sha256(dem.read_bytes()).hexdigest()
    registered=record.get('url','') in source['urls'] and record.get('sha256')==file_sha
    if not registered:
        print('CAUTION: Exact file origin is unverified; the source identity remains local/provisional.')
    args=argparse.Namespace(
        dem=str(dem),window=window,base_cell=base,output=str(out),
        source_id='USGS_MARS2020_CTX_DTM_20M_DOI_10_5066_P906QQT8' if registered else 'LOCAL_DEM_PROVENANCE_PENDING',
        source_url=record.get('url') if registered else source['publication'],
        max_side=max(side,250),
    )
    compile_dem(args)
    manifest_file=out/'manifest.json'
    manifest=json.loads(manifest_file.read_text())
    manifest['sourceFileSha256']=file_sha
    manifest['sourceFileProvenance']= 'DOWNLOADED_FROM_LISTED_HOST_SHA_MATCHED' if registered else 'UNVERIFIED_LOCAL_FILE'
    manifest['sourceAcquiredAtUTC']=record.get('retrievedAtUTC') if registered else None
    manifest_file.write_text(json.dumps(manifest,indent=2)+'\n')
    print('Source raster ROI:',window,'local base:',base)
    print('Do not relabel as VERIFIED without actual science/coordinate and official Resources review.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dem',type=Path,default=Path('data/raw')/DTM_NAME)
    p.add_argument('--output',type=Path,default=Path('public/data'))
    p.add_argument('--side',type=int,default=220)
    p.add_argument('--center-row',type=int)
    p.add_argument('--center-col',type=int)
    p.add_argument('--center-lat',type=float,help='Verified Mars planetocentric latitude for crop center')
    p.add_argument('--center-lon',type=float,help='Verified positive-east longitude for crop center')
    a=p.parse_args()
    ingest(a.dem,a.output,a.side,a.center_row,a.center_col,a.center_lat,a.center_lon)
