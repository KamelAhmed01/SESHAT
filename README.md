# SESHAT


**Current build:** the Jezero mission planner opens at `/`. Start with the [mission rehearsal and resource audit](docs/MISSION_LIFECYCLE.md). The H4 opportunity frontier is at `/?opportunities=1`; `/?demo=1` uses the labeled synthetic fixture.

> **Current operator entrypoint:** [`docs/QUICK_RUN_SHEET.md`](docs/QUICK_RUN_SHEET.md). The definitive local metric model/assumption source is [`src/config/mission-scenario.json`](src/config/mission-scenario.json).


**Mars surface science, under a changing clock.**

SESHAT is an evidence-traceable planetary surface science opportunity workbench for the NASA Space Apps Challenge. It models how an assumed returnable exploration frontier contracts under time delay, directional terrain and science activity.

## Start here

Read **[`docs/START_CODING.md`](docs/START_CODING.md)** and **[`AGENTS.md`](AGENTS.md)** before implementation. The scientific/product contract is in **[`SESHAT_FINAL_MASTER_EXECUTION_BOOK_v1.3.md`](SESHAT_FINAL_MASTER_EXECUTION_BOOK_v1.3.md)**.

```bash
corepack enable
pnpm install
pnpm dev
```

**Stack:** Next.js static-export App Router, React 19, Meta Astryx UI components + Tailwind CSS v4 (using the official CSS layer cascade), Leaflet `CRS.Simple`, offline Python/Rasterio/SciPy terrain compiler.

**Scientific honesty:** the UI does not ship fake terrain, fabricated science pins, or NASA-certified activity numbers. After downloading and reviewing actual Mars data, a bounded metric analysis grid can be compiled to local binary files. The data manifest remains `SOURCE_REVIEW_REQUIRED` until supported validation gates are recorded.

**Current state:** The checked-in bundle uses real CTX terrain and orbital imagery, plus three published Perseverance sample-site anchors. The browser runs single- and multi-stop planning, nominal and conservative reserve checks, event-driven revisions, and mission archives. See [release verification](docs/VERIFICATION_RELEASE.md) for local checks and [delivery gates](docs/MISSION_LIFECYCLE.md#delivery-gates) for external evidence.

**Released-data integration instructions:** [`docs/REAL_DATA_H0.md`](docs/REAL_DATA_H0.md). For explicitly labeled synthetic app testing: `/?demo=1`. For a **standalone browser layout acceptance harness** (not a Next.js screenshot): `python tools/preview/build.py` and `python tools/preview/test_preview.py` after fixture generation.

## Offline code checks

```bash
# No npm install required for these if global TypeScript and Python science deps exist:
tsc -p tsconfig.engine.json
node --test tests/unit/*.test.cjs
python3 -m pytest -q pipeline/tests
```

See [`docs/REAL_DATA_H0.md`](docs/REAL_DATA_H0.md) for real Mars source acquisition, source review, and target alignment. `screenshots/seshat-acceptance-*.png` are explicitly synthetic **visual-harness** renders rather than production Next screenshots.

## Verification and handoff

[`docs/CHECKPOINT_REPORT.md`](docs/CHECKPOINT_REPORT.md) distinguishes **verified local tests**, **implemented but not production-integrated work**, and **missing external gates**. Refresh the report before each handoff or team merge:

```bash
python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md
```

The H2 workbench source adds DEM-based outbound/return elevation profiles and a downloadable evidence-labeled mission brief (`.md`). The analysis now distinguishes a known modeled hard obstruction from insufficient data, conservatively returning `UNKNOWN` if missing cells might hide a route. Data acquisition can be safely re-run without erasing a previously recorded original URL/hash when the bytes match. The standalone harness uses synthetic terrain. The production browser suite also tests the real-data lifecycle.

For the submission sequence, use the [mission rehearsal and delivery gates](docs/MISSION_LIFECYCLE.md).

## H3: Opportunity ledger and original Astryx theme

The decision board evaluates **every** source-backed candidate through the same scientific functions used for a selected route. Its ledger shows the ROBUST / MARGINAL / INFEASIBLE / UNKNOWN states, nominal time margins, and which opportunities are lost or downgraded after a departure delay. UNKNOWN is not counted as a lost opportunity. The map pin layer excludes approximate geological regions and uses text-only tooltips. Evidence-panel keyboard focus handling has been added to the React source.

The bespoke design system lives in `src/themes/seshat/seshatTheme.ts` and extends Meta Astryx Neutral using `defineTheme`; it currently uses Astryx's documented **runtime CSS injection**, not a falsely claimed precompiled theme. The official installed `@astryxdesign/cli` must compile and validate it on a networked laptop before deployment. Use the pinned dependencies in `package.json` and consult `pnpm exec astryx docs theme` for the installed CLI's exact build command.

Repeatable local checks when the required tools are present:

```bash
python3 tools/preview/build.py
python3 tools/preview/test_preview.py
python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md
```

The acceptance preview is **not** the Next.js runtime: its synthetic terrain and labels exist solely to test visual states and user interactions. The production browser checks and the standalone fixture have separate evidence.

## H4 verification and source review

`python3 -m tools.verify --offline` checks the local Python, security and Node scientific contracts; it does **not** build Next.js. `pnpm verify` runs the release sequence, including the static build and Playwright. See `docs/VERIFICATION_LATEST.md`, `docs/SECURITY_AND_DEPLOYMENT.md` and `docs/QUICK_RUN_SHEET.md`. Source equirectangular metres are not treated as surface metres: `pipeline.compile` reprojects into a bounded local Mars AEQD raster before graph compilation. Model and UI derive assumptions from one JSON file.
