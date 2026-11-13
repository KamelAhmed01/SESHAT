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

## Live execution checklist (H3)

[`docs/CHECKPOINT_REPORT.md`](docs/CHECKPOINT_REPORT.md) distinguishes **verified local tests**, **implemented but not production-integrated work**, and **missing external gates**. Refresh the report before each handoff or team merge:

```bash
python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md
```

The H2 workbench source adds DEM-based outbound/return elevation profiles and a downloadable evidence-labeled mission brief (`.md`). The analysis now distinguishes a known modeled hard obstruction from insufficient data, conservatively returning `UNKNOWN` if missing cells might hide a route. Data acquisition can be safely re-run without erasing a previously recorded original URL/hash when the bytes match. Browser acceptance still uses **synthetic terrain** and is not the Next.js runtime.

For the next team priority, open `docs/CHECKPOINT_REPORT.md`: **official Resources evidence, real CTX/PDS downloads, two precise source-backed targets, npm lockfile + Astryx theme, production Next build, deployment, and final submission** remain open.

## H3: Opportunity ledger and original Astryx theme

The decision board evaluates **every** source-backed candidate through the same scientific functions used for a selected route. Its ledger shows the ROBUST / MARGINAL / INFEASIBLE / UNKNOWN states, nominal time margins, and which opportunities are lost or downgraded after a departure delay. UNKNOWN is not counted as a lost opportunity. The map pin layer excludes approximate geological regions and uses text-only tooltips. Evidence-panel keyboard focus handling has been added to the React source.

The bespoke design system lives in `src/themes/seshat/seshatTheme.ts` and extends Meta Astryx Neutral using `defineTheme`; it currently uses Astryx's documented **runtime CSS injection**, not a falsely claimed precompiled theme. The official installed `@astryxdesign/cli` must compile and validate it on a networked laptop before deployment. Use the pinned dependencies in `package.json` and consult `pnpm exec astryx docs theme` for the installed CLI's exact build command.

Repeatable local checks when the required tools are present:

```bash
python3 tools/preview/build.py
python3 tools/preview/test_preview.py
python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md
```

The acceptance preview is **not** the Next.js runtime: its synthetic terrain and labels exist solely to test visual states and user interactions. Real NASA terrain, scientific targets, full Next build, live deployment and official challenge Resources evidence are separate open gates.
