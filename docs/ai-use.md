# AI-assisted engineering disclosure and review log

AI tools help draft implementation, tests and documentation. **All route-model assumptions, dataset provenance, commits and release claims require human review.** NASA does not endorse generated results.

## Core engine & geodesy log — 2026-11-13

- Task: Correct Mars equirectangular ground-distance handling, consolidate mission defaults, and add security/verification artifacts.
- Generated with: AI coding assistance; developer verified the change against synthetic Mars CRS and route fixtures.
- Inputs: committed terrain engine source, published Astryx API and source-coordinate conventions.
- Evidence: see `pipeline/tests/test_projection_metric.py`, `tests/security/test_headers.py`, `tests/unit/engine.test.cjs`, and `docs/VERIFICATION_LATEST.md`.
- Limitations: NASA resource membership, actual DEM bytes, Vercel response behavior, npm-based production build and user study were not demonstrated in that offline run.
- Commit convention: include `AI-Assisted: yes` and the verification report path in the commit message. Human reviewers must recheck the key math and claims.


## Mission lifecycle — 2026-11-13

- Inspected the official Resources tab and catalog products, compared the downloaded USGS and Mars Trek rasters, and implemented the planning, event review and return flow.
- Published PDS positions and NASA images are credited in [the resource audit](MISSION_LIFECYCLE.md). Mobility, consumption and all event measurements are scenario assumptions or simulated input.
- Test evidence is in [the release report](VERIFICATION_RELEASE.md). The project still requires independent team science review, organizer evidence, and hosted delivery verification.
- Consolidated the current execution plan and checked its mission behavior against the implementation, local links and shell examples. The Saturday checkpoints and five-slide demo are proposed team defaults.

## UI, CI & documentation cleanup — 2026-11-14

- Task: Fix duplicate `pnpm` version specification in `.github/workflows/verify.yml`, remove phase steppers, numbered eyebrows, and internal milestone labels across UI, unit test descriptions, preview harness, and docs, and clean local feature branches back to `main`.
- Concrete limits: Reverted concurrent unintegrated working-tree edits (`SiteContext.tsx`, `mission_context.py`, geologic/thermal overlays) back to `main`; source review gate remains `SOURCE_REVIEW_REQUIRED` (`coordinateFrameVerified: false`, `challengeResourceQualified: false`) pending human team signoff, and live Vercel deployment headers are unverified until pushed/deployed.
- Verifiers: `tools/preview/build.py` + `tools/preview/test_preview.py`, `pnpm verify` (`docs/VERIFICATION_RELEASE.md`), `tools/checkpoint --run-tests` (`docs/CHECKPOINT_REPORT.md`).

## Solo release check — 2026-11-14

- Used AI assistance to compare the pushed build, local data cache, and operating plan. Removed assigned workstreams and recorded the tested judge flow, downloaded sources, and delivery gaps.
- Evidence includes GitHub Actions run `43526772353`, `pnpm verify`, `pipeline.preflight`, local documentation link checks, and a manual browser rehearsal through the landing site return. Cached and hashed the full PDS dossier.
- The cached geology, thermal inertia and MEDA products are pending integration. The browser rehearsal used a local server. Production access and organizer evidence remain open.

## Mission story audit and production baseline — 2026-11-14

- Used AI assistance and separate design and browser-detector reviews to map the requested mission story onto the app. Compared public Mobbin map and incident patterns. Recorded operator decisions and acceptance checks in the mission plan.
- Published the existing static export as a public Vercel baseline. Verified HTTP response headers and byte-matched the served HTML and manifest to the local export. A fresh Chromium session planned the mission, approved a revision, resumed after reload, returned, and inspected the downloaded JSON. All six event categories also reached revision review in local Chromium.
- The review identifies planned changes to the phase layout, exploration, simulated detection and sourced environment context. The current public site is the earlier verified build.

## Tiled Mars planning and handoff — 2026-11-14

- Traced the single image and pan limit to the Leaflet viewer and checked the extent of the downloaded CTX raster against its Mars CRS. Used AI assistance to specify a geographic display, a coverage gate and an offline tile fallback while keeping the scientific grid independent.
- Checked both official WMTS capability documents, adjacent image requests at levels 6 and 12, and the 42 Viking tiles at levels 0–2. Updated the [mission plan](MISSION_LIFECYCLE.md#6-seamless-mars-map) and prepared an execution prompt. The tiles and viewer changes are planned work.
