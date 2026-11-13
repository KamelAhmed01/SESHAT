"""Inspect an actual raster without guessing its planetary CRS or NoData rules."""
import argparse
import json
from pathlib import Path
import rasterio


def inspect(path: str) -> dict:
    with rasterio.open(path) as src:
        return {
            'file': str(path), 'driver': src.driver, 'width': src.width, 'height': src.height,
            'bandCount': src.count, 'crsWkt': src.crs.to_wkt() if src.crs else None,
            'bounds': tuple(src.bounds), 'transform': tuple(src.transform),
            'pixelSizeNativeUnits': (src.res[0], src.res[1]), 'nodata': src.nodata,
            'bandUnits': src.units, 'datasetTags': src.tags(),
            'band1MinMaxMetadata': src.tags(1),
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('raster')
    parser.add_argument('--output')
    args = parser.parse_args()
    report = json.dumps(inspect(args.raster), indent=2)
    print(report)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(report + '\n')
