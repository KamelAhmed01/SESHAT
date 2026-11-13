"""Acquire real public Mars archives; NO claim of NASA Space Apps Resources eligibility.

Requires internet on a teammate's machine. Raw downloads live under data/raw (gitignored).
No synthetic fallback is ever downloaded under the real-source filename.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import requests

DTM_NAME = 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
SOURCES = {
    'dem': {
        'filename': DTM_NAME,
        'urls': [
            f'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/{DTM_NAME}',
            f'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/{DTM_NAME}',
        ],
        'citation': 'USGS, Mars 2020 Terrain Relative Navigation CTX DTM Mosaic, DOI:10.5066/P906QQT8',
        'publication': 'https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic',
        'max_bytes': 70 * 1024 * 1024,
    },
    'places': {
        'filename': 'best_interp.csv',
        'urls': [
            'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv',
        ],
        'citation': 'NASA PDS Mars 2020 rover PLACES localization bundle, best_interp table',
        'publication': 'https://pds-geosciences.wustl.edu/missions/mars2020/places.htm',
        'max_bytes': 60 * 1024 * 1024,
    }
}


def validate_signature(kind: str, data: bytes) -> None:
    if kind == 'dem' and not (data.startswith(b'II*\x00') or data.startswith(b'MM\x00*') or data.startswith(b'II+\x00') or data.startswith(b'MM\x00+')):
        raise ValueError('Downloaded DEM is not a TIFF: check redirect, server error and file identity')
    if kind == 'places' and (b'<' in data[:100] and b'html' in data[:200].lower()):
        raise ValueError('PDS returned an HTML page rather than CSV')
    if kind == 'places' and b',' not in data[:4096]:
        raise ValueError('PDS localization table is not comma-separated; inspect manually')


def fetch_one(kind: str, destination: Path, timeout: int = 25) -> dict:
    item = SOURCES[kind]
    destination.mkdir(parents=True, exist_ok=True)
    out = destination / item['filename']
    if out.exists():
        data = out.read_bytes()
        validate_signature(kind, data)
        digest = hashlib.sha256(data).hexdigest()
        result = {'kind': kind, 'file': str(out), 'bytes': len(data), 'sha256': digest,
                  'url': 'EXISTING_FILE_ORIGIN_UNCONFIRMED', 'citation': item['citation'],
                  'verifiedSourceFile': False, 'warning': 'Existing file: independently verify origin against original download!'}
        return result

    errors = []
    for url in item['urls']:
        temp = out.with_suffix(out.suffix + '.download')
        try:
            h = hashlib.sha256()
            size = 0
            with requests.get(url, stream=True, timeout=(8, timeout), allow_redirects=True,
                              headers={'User-Agent': 'SESHAT-hackathon-data-pipeline/0.2 (academic research)'}) as response:
                response.raise_for_status()
                with temp.open('wb') as stream:
                    for chunk in response.iter_content(chunk_size=256 * 1024):
                        if not chunk:
                            continue
                        size += len(chunk)
                        if size > item['max_bytes']:
                            raise ValueError('Download exceeded maximum expected size; source may have changed')
                        h.update(chunk)
                        stream.write(chunk)
            with temp.open('rb') as stream:
                validate_signature(kind, stream.read(4096))
            if size < 100:
                raise ValueError('File unexpectedly short')
            os.replace(temp, out)
            return {'kind': kind, 'file': str(out), 'bytes': size, 'sha256': h.hexdigest(),
                    'url': url, 'citation': item['citation'], 'publication': item['publication'],
                    'retrievedAtUTC': datetime.now(timezone.utc).isoformat(),
                    'verifiedSourceFile': False,
                    'warning': 'Downloaded source; scientific frame, coverage and Resources eligibility NOT yet reviewed'}
        except (requests.RequestException, ValueError, OSError) as exc:
            errors.append(f'{url} => {type(exc).__name__}: {exc}')
            temp.unlink(missing_ok=True)
    raise RuntimeError(f'Unable to retrieve {kind}. Check venue network or download manually.\n' + '\n'.join(errors))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--only', choices=['dem', 'places', 'all'], default='all')
    p.add_argument('--out', type=Path, default=Path('data/raw'))
    args = p.parse_args()
    keys = ['dem', 'places'] if args.only == 'all' else [args.only]
    results = [fetch_one(key, args.out) for key in keys]
    ledger = args.out / 'acquisition.json'
    old = json.loads(ledger.read_text()) if ledger.exists() else {}
    old.update({r['kind']: r for r in results})
    ledger.write_text(json.dumps(old, indent=2) + '\n')
    print(json.dumps(results, indent=2))
    print('NEXT: python -m pipeline.inspect', args.out / DTM_NAME)
    print('IMPORTANT: downloaded != aligned != official challenge-Resources-qualified != scientifically verified.')

if __name__ == '__main__':
    main()
