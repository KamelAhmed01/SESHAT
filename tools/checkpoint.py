"""Honest, repeatable SESHAT readiness snapshot. Pure local checks, no network.

Usage:
    python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md

This reports what EXISTS and which tests passed; it never turns local assertions
into NASA approval, real-data verification or a deployment claim.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> tuple[bool, str]:
    try:
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=90)
        detail = '\n'.join((completed.stdout + '\n' + completed.stderr).splitlines()[-7:]).strip()
        return completed.returncode == 0, detail
    except (OSError, subprocess.TimeoutExpired) as error:
        return False, str(error)


def snapshot(run_tests: bool = False) -> str:
    completed: list[str] = []
    implemented: list[str] = []
    pending: list[str] = []
    test_details: list[str] = []

    # Presence does not mean build success. Separate implementation from proof.
    for description, paths in (
        ('Next.js/Astryx/Tailwind workbench source', ['src/components/workbench/MissionWorkbench.tsx', 'src/app/providers.tsx', 'src/app/globals.css']),
        ('Leaflet coordinate-grid integration', ['src/components/cartography/LeafletGrid.tsx', 'src/cartography/coordinates.ts']),
        ('Directed route compiler and browser loader', ['pipeline/route_fields.py', 'src/data/loader.ts']),
        ('Real terrain and PDS ingestion tooling', ['pipeline/acquire.py', 'pipeline/real_ingest.py', 'pipeline/places.py']),
        ('Science targets and human source gate', ['pipeline/targets.py', 'pipeline/approve.py']),
        ('Optional imagery alignment pipeline', ['pipeline/optical.py']),
        ('Elevation profiles and exportable mission briefs', ['src/components/visualizations/ElevationProfile.tsx', 'src/engine/mission-brief.ts']),
        ('Scientific assumptions and AI engineering rules', ['AGENTS.md', 'docs/REAL_DATA_H0.md']),
    ):
        (implemented if all((ROOT / p).is_file() for p in paths) else pending).append(description)

    if run_tests:
        for label, command in (
            ('Python terrain/science tests', [sys.executable, '-m', 'pytest', '-q', 'pipeline/tests']),
            ('TypeScript engine compile', ['tsc', '-p', 'tsconfig.engine.json']),
            ('Node scientific/unit oracles', ['node', '--test', 'tests/unit/engine.test.cjs']),
        ):
            okay, info = run(command)
            (completed if okay else pending).append(label + (' — passed' if okay else ' — failed or unavailable'))
            test_details.append(f'- {label}: {"PASS" if okay else "FAIL"}; last output: `{info.replace(chr(96), "'")[:270]}`')
    else:
        pending.append('Re-run tests on this machine (use --run-tests)')

    screenshots = list((ROOT / 'screenshots').glob('seshat-acceptance-*.png'))
    if screenshots:
        completed.append('Standalone Chromium acceptance preview screenshots exist — synthetic only, not a Next.js build')
    else:
        pending.append('Standalone browser acceptance screenshots')

    official = ROOT / 'docs/event-evidence/official-challenge-resources.png'
    if not official.is_file():
        pending.append('Screenshot of NASA 2026 challenge Resources listing and a visibly used qualifying NASA source (C1)')
    else:
        implemented.append('Official Resources screenshot file present; verify its contents and the actual used data source manually')

    raw = ROOT / 'data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
    if not raw.is_file():
        pending.append('Actual USGS Jezero CTX DEM bytes downloaded, hashed, projection/coverage inspected')
    else:
        implemented.append('Local TIFF bytes present; validate catalog provenance, CRS and file identity')

    manifest_file = ROOT / 'public/data/manifest.json'
    if not manifest_file.is_file():
        pending.append('Real Mars study-area compiled into public/data/ (synthetic /demo is not accepted)')
    else:
        try:
            manifest = json.loads(manifest_file.read_text())
            status = manifest.get('status', 'unknown')
            if status == 'VERIFIED':
                implemented.append('Manifest DECLARES team-reviewed Mars data; independently inspect actual capture and sources')
            elif status == 'SOURCE_REVIEW_REQUIRED':
                implemented.append('Real/provisional bundle manifest present, still awaiting human review')
            else:
                pending.append(f'Nonproduction manifest status {status}; do not pass as real Mars evidence')
            precise = sum(t.get('location', {}).get('confidence') == 'VERIFIED_POINT' for t in manifest.get('scienceTargets', []))
            if precise < 2: pending.append(f'At least two independently cited, exact overlapping science targets (now {precise})')
            else: implemented.append(f'{precise} precise targets declared; check coordinate and observation evidence')
        except (ValueError, OSError):
            pending.append('Real-source manifest JSON parses and passes integrity loader')

    if (ROOT / 'pnpm-lock.yaml').is_file():
        implemented.append('Version-pinned pnpm lockfile committed or available locally')
    else:
        pending.append('Generate/commit pnpm-lock.yaml on connected laptop, change CI to frozen lockfile')

    if not (ROOT / 'node_modules/@astryxdesign/core').exists():
        pending.append('Install real Next.js + Astryx dependencies; run Next typecheck and build')
    else:
        implemented.append('Astryx local dependencies present; still run full Next build and E2E')

    if not (ROOT / 'src/themes/seshat/seshatTheme.ts').is_file():
        pending.append('Compiled bespoke SESHAT Astryx theme, beyond custom CSS color variables')
    else:
        implemented.append('Custom Astryx theme source exists; compile and inspect both modes')

    if not (ROOT / 'out/index.html').is_file():
        pending.append('Next production static export and genuine Next browser screenshot')
    else:
        implemented.append('Next static export output exists; conduct E2E, offline asset and accessibility review')

    remote_ok, remote = run(['git', 'remote', '-v'])
    if not remote_ok or not remote:
        pending.append('Connect SESHAT GitHub remote, push committed history, confirm teammate access')
    else:
        implemented.append('Git remote configured; remote push/CI pass not confirmed by this command')

    pending.extend([
        'Judge-ready live URL, TLS, Vercel deployment and fully local fallback verified on two laptops',
        'Cross-device production app E2E, basic keyboard/accessibility QA and source-bearing screenshots',
        'Five-slide pitch, demo video, real target-science explanations and independent human user test',
        'Source/AI disclosure, event eligibility evidence, and official project submission receipt',
    ])

    def checkbox(items: list[str], checked: bool):
        return '\n'.join(f'- [{"x" if checked else " "}] {x}' for x in items) or '- None'

    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    report = f'''# SESHAT — execution readiness checkpoint

Generated **{now}** using `python -m tools.checkpoint{" --run-tests" if run_tests else ""}`.

**Interpretation:** checked means source is present or a stated local test actually passed. It does **not** prove NASA endorsement, live deployment, real-source alignment, or Global Awards eligibility. Engine tests and frontend-build tests are separate.

## Verified locally

{checkbox(completed, True)}

## Implemented in source, still requiring runtime/science evidence

{checkbox(implemented, True)}

## Missing / blocked / unverified

{checkbox(pending, False)}

## Test execution evidence

{chr(10).join(test_details) if test_details else 'Not executed in this snapshot. Run with `--run-tests`. Each report records its own results.'}

## Immediate handoff order

1. **Shams/Malak — C1:** save official challenge Resources capture and identify the NASA data SESHAT actually uses. Do not substitute an unrelated NASA source.
2. **Amr + Malak — G1/G2:** download the exact original CTX/PDS bytes, inspect CRS/longitude, select a source-backed science ROI and two geological target points.
3. **Kamel/Ali — frontend:** create `pnpm-lock.yaml`, verify Astryx components + custom theme, run full production Next build, push the repo and deploy.
4. **Hams/Kamel — design:** inspect real Next desktop/mobile, typography, visual hierarchy, keyboard states and evidence labels; keep visual coherence distinct from default library styling.
5. **Shams/Ali — judge experience:** rehearse route-before/after delay, show actual source citations and limitations, capture offline demo and submission evidence.

Do not commit raw gigabyte archives, downloaded source secrets, npm `node_modules`, or unreviewed claimed source approval. Committing generated scientific bundles is allowed only after validation and a license/size review.
'''
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run-tests', action='store_true')
    p.add_argument('--write', type=Path, help='Also write a Markdown report to this repo-relative path')
    args = p.parse_args()
    result = snapshot(args.run_tests)
    if args.write:
        destination = args.write if args.write.is_absolute() else ROOT / args.write
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(result)
        print('Wrote:', destination)
    else:
        print(result)


if __name__ == '__main__':
    main()
