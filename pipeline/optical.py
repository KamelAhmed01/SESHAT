"""Align real orbital optical GeoTIFF to an already compiled Mars terrain ROI.

NO arbitrary stretching, no Earth reprojection, no claims of verified imagery.
The optional layer is hashed and remains SOURCE_REVIEW_REQUIRED pending review.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image
import rasterio
from rasterio.crs import CRS
from rasterio.warp import reproject, Resampling
from affine import Affine
from pyproj import CRS as PyprojCRS


def align_optical(image: Path, bundle: Path, source_title: str, source_url: str):
    if not image.is_file(): raise FileNotFoundError(image)
    if not source_url.startswith('https://') or not source_title.strip():
        raise ValueError('Source title and public HTTPS catalog URL required')
    manifest_path=bundle/'manifest.json'
    m=json.loads(manifest_path.read_text())
    if m['status']=='DEMO_SYNTHETIC' or m.get('planetaryBody')!='Mars':
        raise ValueError('Only real Mars analysis bundles can receive an orbital layer')
    transform=Affine(*m['rasterTransform'])
    target_crs=CRS.from_wkt(m['crsWkt'])
    height,width=m['height'],m['width']
    with rasterio.open(image) as src:
        if not src.crs or src.count < 1:
            raise ValueError('Orbital imagery lacks usable georeferencing')
        r=float(PyprojCRS.from_wkt(src.crs.to_wkt()).ellipsoid.semi_major_metre)
        if not 3_000_000<r<3_600_000 or abs(r-float(m['sourceBodyRadiusMeters']))>100:
            raise ValueError('Orbital product and terrain do not share a validated Mars planetary radius')
        # First RGB bands or single-band grayscale. Warp into the exact DEM-aligned grid.
        count=min(src.count,3)
        bands=[]
        alpha = np.zeros((height,width),dtype=np.uint8)
        reproject(source=rasterio.band(src,1),destination=alpha,
                  src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,
                  dst_transform=transform,dst_crs=target_crs,dst_nodata=0,
                  resampling=Resampling.nearest)
        for b in range(1,count+1):
            array=np.zeros((height,width),dtype=np.float32)
            reproject(source=rasterio.band(src,b),destination=array,
                      src_transform=src.transform,src_crs=src.crs,src_nodata=src.nodata,
                      dst_transform=transform,dst_crs=target_crs,dst_nodata=np.nan,
                      resampling=Resampling.bilinear)
            bands.append(array)
    coverage=np.isfinite(bands[0])
    if not coverage.any():
        raise ValueError('Optical imagery has no overlap with the chosen DEM crop; do not stretch')
    rgb=[]
    for layer in (bands if len(bands)==3 else [bands[0]]*3):
        valid=layer[coverage]
        lo,hi=np.percentile(valid,[1,99])
        if hi <= lo: hi=lo+1
        scaled=np.clip((np.nan_to_num(layer,nan=lo)-lo)/(hi-lo)*255,0,255).astype(np.uint8)
        rgb.append(scaled)
    rgba=np.stack([*rgb,np.where(coverage,255,0).astype(np.uint8)],axis=-1)
    path=bundle/'imagery'/'orbital-aligned.webp';path.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(rgba,mode='RGBA').save(path,format='WEBP',lossless=True)
    data=path.read_bytes()
    m['optical']={
        'path':'imagery/orbital-aligned.webp','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
        'sourceId':source_title,'sourceUrl':source_url,'sourceFileSha256':hashlib.sha256(image.read_bytes()).hexdigest(),
        'alignment':'REPROJECTED_ONTO_DEM_ANALYSIS_GRID','reviewStatus':'SOURCE_REVIEW_REQUIRED',
        'validPixelCount':int(coverage.sum()),'pixelCount':height*width,
        'sourcePixelsPerBand':count,
    }
    manifest_path.write_text(json.dumps(m,indent=2)+'\n')
    print(f'Aligned optical layer: {int(coverage.sum())}/{height*width} pixels, review remains mandatory')
    return m['optical']

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--image',type=Path,required=True)
    p.add_argument('--bundle',type=Path,default=Path('public/data'))
    p.add_argument('--source-title',required=True)
    p.add_argument('--source-url',required=True)
    a=p.parse_args()
    align_optical(a.image,a.bundle,a.source_title,a.source_url)
