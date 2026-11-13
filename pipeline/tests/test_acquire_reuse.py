import hashlib
import json
from pathlib import Path
from pipeline.acquire import SOURCES, fetch_one


def test_repeated_acquire_preserves_recorded_origin_when_bytes_match(tmp_path: Path):
    raw = b'II*\x00' + b'\x00' * 160
    destination = tmp_path / SOURCES['dem']['filename']
    destination.write_bytes(raw)
    url = SOURCES['dem']['urls'][0]
    (tmp_path / 'acquisition.json').write_text(json.dumps({'dem': {
        'url': url, 'sha256': hashlib.sha256(raw).hexdigest(),
        'retrievedAtUTC': '2026-11-13T10:00:00+00:00'
    }}))
    record = fetch_one('dem', tmp_path)
    assert record['url'] == url
    assert record['retrievedAtUTC'] == '2026-11-13T10:00:00+00:00'
    assert record['verifiedSourceFile'] is False  # Provenance is NOT scientific review.


def test_existing_but_changed_bytes_cannot_reuse_source_origin(tmp_path: Path):
    (tmp_path / SOURCES['dem']['filename']).write_bytes(b'II*\x00' + b'\x00' * 160)
    (tmp_path / 'acquisition.json').write_text(json.dumps({'dem': {
        'url': SOURCES['dem']['urls'][0], 'sha256': '0' * 64
    }}))
    result = fetch_one('dem', tmp_path)
    assert result['url'] == 'EXISTING_FILE_ORIGIN_UNCONFIRMED'
    assert result['retrievedAtUTC'] is None
