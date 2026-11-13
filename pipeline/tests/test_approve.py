import pytest
from pipeline.approve import approve
from .test_real_ingest import make_tiff
from pipeline.real_ingest import ingest


def test_reject_provenance_laundering(tmp_path):
    dem=tmp_path/'mars.tif';make_tiff(dem)
    dest=tmp_path/'out';ingest(dem,dest,side=18)
    capture=tmp_path/'resources.png';capture.write_bytes(b'x'*200)
    with pytest.raises(ValueError,match='unproven source origin'):
        approve(dest,'Team reviewer','https://spaceappschallenge.org',capture,
                'All necessary source and coordinate checks supposedly passed',True)
