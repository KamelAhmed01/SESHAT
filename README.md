# SESHAT

**Mars surface science, under a changing clock.**

SESHAT is an evidence-traceable planetary surface science opportunity workbench for the NASA Space Apps Challenge. It models how an assumed returnable exploration frontier contracts under time delay, directional terrain and science activity.

## Start here

Read **[`docs/START_CODING.md`](docs/START_CODING.md)** and **[`AGENTS.md`](AGENTS.md)** before implementation. The scientific/product contract is in **[`SESHAT_FINAL_MASTER_EXECUTION_BOOK_v1.2.md`](SESHAT_FINAL_MASTER_EXECUTION_BOOK_v1.2.md)**.

```bash
corepack enable
pnpm install
pnpm dev
```

**Stack:** Next.js static-export App Router, React 19, Meta Astryx UI components + Tailwind CSS v4 (using the official CSS layer cascade), Leaflet `CRS.Simple`, offline Python/Rasterio/SciPy terrain compiler.

**Scientific honesty:** the UI does not ship fake terrain, fabricated science pins, or NASA-certified activity numbers. After downloading and reviewing actual Mars data, a bounded metric analysis grid can be compiled to local binary files. The data manifest remains `SOURCE_REVIEW_REQUIRED` until supported validation gates are recorded.

**Current state:** Implemented H0+ route engine, source-locked real-data downloader, PDS CSV reviewer, exact Mars ROI ingestion, source-linked target converter, optional DEM-aligned orbital imagery, evidence approval gates, and UI flow. This is **not** proof that NASA source bytes or deployed Next have passed acceptance in this authoring environment.

**Released-data integration instructions:** [`docs/REAL_DATA_H0.md`](docs/REAL_DATA_H0.md). For explicitly labeled synthetic app testing: `/?demo=1`. For a **standalone browser layout acceptance harness** (not a Next.js screenshot): `python tools/preview/build.py` and `python tools/preview/test_preview.py` after fixture generation.

## Offline code checks

```bash
# No npm install required for these if global TypeScript and Python science deps exist:
tsc -p tsconfig.engine.json
node --test tests/unit/*.test.cjs
python3 -m pytest -q pipeline/tests
```

See [`docs/REAL_DATA_H0.md`](docs/REAL_DATA_H0.md) for real Mars source acquisition, source review, and target alignment. `screenshots/seshat-acceptance-*.png` are explicitly synthetic **visual-harness** renders rather than production Next screenshots.
