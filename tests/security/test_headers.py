"""Deployment policy regression tests. Actual response headers still need a live Vercel test."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]


def test_vercel_headers_present_and_narrow():
    config = json.loads((ROOT/'vercel.json').read_text())
    assert config['headers'][0]['source']=='/(.*)'
    headers={h['key'].lower():h['value'] for h in config['headers'][0]['headers']}
    assert headers['x-content-type-options']=='nosniff'
    assert headers['x-frame-options']=='DENY'
    assert 'camera=()' in headers['permissions-policy']
    policy=headers['content-security-policy']
    assert "default-src 'self'" in policy
    assert "object-src 'none'" in policy
    assert "frame-ancestors 'none'" in policy
    tokens = {tok.rstrip(';') for tok in policy.split()}
    assert 'http:' not in tokens and 'https:' not in tokens
    assert 'https://trek.nasa.gov' in tokens
    assert "'unsafe-eval'" not in policy


def test_security_policy_explains_review_required():
    doc=(ROOT/'docs/SECURITY_AND_DEPLOYMENT.md').read_text()
    assert 'production response' in doc.lower()
    assert 'unsafe-inline' in doc
