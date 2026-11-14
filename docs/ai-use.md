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

## Seamless Mars tiled map & geographic viewer (Checkpoint 1) — 2026-11-14

- Task: Replace the local image-bounded Mars map with a seamless planetocentric Plate Carrée (`L.CRS.EPSG4326`, spherical `R = 3,396,190 m`) Leaflet viewer carrying bundled Viking MDIM 2.1 (levels 0–2 global + Jezero corridor levels 3–7), 6 m MRO CTX Jezero mosaic pyramid (levels 8–12 full, 13 western fan), Plate Carrée AEQD-reprojected relief/orbital/geology/thermal overlays, PDS MEDA pressure context metadata, and `Browse only · outside modeled terrain` click gating.
- Concrete limits: Source review status remains `SOURCE_REVIEW_REQUIRED` (`coordinateFrameVerified: false`, `challengeResourceQualified: false`); remote Mars Trek tiles above bundled levels require connectivity while Jezero routing and core workflow operate offline; live Vercel deployment left for post-review.
- Verifiers: `.venv/bin/python -m pytest -q pipeline/tests tests/security` (30 passed), `pnpm run check:engine:offline` (42 passed), `pnpm verify` (Python/Node/lint/typecheck/Next static export + 8 Playwright E2E passed; [release report](VERIFICATION_RELEASE.md)), and `python -m tools.checkpoint --run-tests` ([checkpoint report](CHECKPOINT_REPORT.md)).

## Separated stop execution, interrupted-science replanning & UI polish (Checkpoint 2) — 2026-11-14

- Task: Separate mission execution phases (`Move` -> `Arrive at stop` -> `Explore +10 min` -> observation logging -> `Complete stop`), add deterministic simulated sensor/instrument readings, preserve explored stop time and observations during reload/interruption, compute dual `Finish stop & continue` vs `Leave stop now (keep partial science)` replan proposals under fixed 0.8x/1.0x/1.2x reserves, expose live-position `evaluatePositionOpportunities` and environmental context/unavailable-field disclosure in UI/archives, add keyboard coordinate inputs for hazard/discovery events and programmatic phase-heading focus, fix full-name target wrapping, export `docs/examples/seshat-interrupted-science-archive.json`, and capture updated desktop/mobile screenshots from the static export.
- Concrete limits: Source review status remains `SOURCE_REVIEW_REQUIRED` (`coordinateFrameVerified: false`, `challengeResourceQualified: false`); live Mars weather/dust/radiation telemetry and simulated readings remain offline scenario simulations rather than live spacecraft telemetry; production Vercel deployment left for post-review.
- Verifiers: `.venv/bin/python -m pytest -q pipeline/tests tests/security` (30 passed in 0.86s), `pnpm run check:engine:offline` (44 passed, 0 failed), `.venv/bin/python -m tools.preview.build` + `.venv/bin/python tools/preview/test_preview.py` (`BROWSER QA PASSED`), `pnpm verify` (all 8 stages including 10 Playwright tests on the real Next.js static export passed; [release report](VERIFICATION_RELEASE.md)), and `python -m tools.checkpoint --run-tests` ([checkpoint report](CHECKPOINT_REPORT.md)).

## Field map revamp and implementation audit — 2026-11-14

- Used AI assistance to examine the prior tiled map and lifecycle implementation, create two ImageGen concept references, and rebuild the main workbench around one map and one mission panel. Public Mobbin screens informed the arrangement. The blank panel, mission planning, replan and return use the checked-in scientific assets and engine.
- Compared 508 map cell centers against pyproj. The largest difference was 0.000000014 m on the checked grid. The six scientific routing buffers matched `ef10e83` byte for byte and matched their manifest hashes. This confirms numerical consistency against the configured model and reference frame.

## Unified Neighborhood Overlays & High-Resolution 3D Surface Rendering — 2026-11-14

- Task: Eliminate central-chunk overlay seams and visual inconsistencies across 2D/3D layers after expanding to the 2-ring neighborhood (25 chunks, 22×22 km):
  1. Fix elevation heatmap overlay: prevent `elevationHeatmapPng` from drawing a disjointed narrow-range center-chunk heatmap on top of the continuous `neighborhood-heatmap-geo.webp`, ensuring seamless hypsometric tinting across the entire 22×22 km region.
  2. Fix terrain hillshade stacking: in terrain mode, let `neighborhood-terrain-geo.webp` provide the single continuous shaded relief base without double-darkening the central chunk with redundant `study-area-geo.webp`.
  3. Upgrade 3D ground texture quality: implemented bilinear texture sampling with dual-resolution hierarchy (sampling the 880×880 zoomed-in texture `orbital-geo.webp` / `study-area-geo.webp` inside the central chunk and `neighborhood-orbital-geo.webp` / `neighborhood-terrain-geo.webp` across the neighborhood).
  4. Increased 3D terrain mesh geometry from 88×88 to 110×110 quads (12,100 vertices) for crisper crater rims and topography.
- Concrete limits: Source review status remains `SOURCE_REVIEW_REQUIRED`; routing calculations strictly adhere to the canonical 20 m AEQD Jezero western fan grid.
- Verifiers: `tsc --noEmit` (clean), 46 Node scientific oracles passed (`tests/unit/*.test.cjs`), `next build` static export succeeded (in 2.0s), and `tools.checkpoint` updated (`docs/CHECKPOINT_REPORT.md`).
- Rebuilt the bedrock layer from the original Stack et al. supplement. The crop has 32 conflicting cells and two uncovered cells. All 34 are represented as unknown. Filtered historical MEDA pressure by observation sol, a stated 0–2,000 Pa plausibility screen, and availability of the matching product label. Confirmed pressure record counts of 34,385, 31,203 and 24,788 for sols 490, 509 and 575.
- Material scope still open from the prior plan includes the active mission's multi-resource before/after opportunity frontier. The separate opportunity view uses a time budget. Terrain and observations retain their source-review status. See the [local release verification](VERIFICATION_RELEASE.md) for the executed checks.

## 3D Camera Controls & 25-Chunk Neighborhood Navigation — 2026-11-14

- Task: Fix 3D camera obstruction and enable navigation points/stops across all 25 neighborhood chunks:
  1. Fix 3D camera: centered vertical rotation around visual terrain midpoint, corrected perspective foreshortening math, removed occluding opaque pedestal curtain walls that drew over the terrain, switched default left-drag to orbit (with Shift/right-drag to pan), and added "Top" (88°), "3D" (52°), and "Reset" camera preset buttons.
  2. Multi-chunk navigation points & routing: implemented `routeNeighborhood` and `elevationAtCell` across the 550×550 neighborhood grid (`neighborhood-elevation.bin`), enabled selecting and adding stops across all 25 chunks in both 2D and 3D with continuous coordinates `[-440..659]`, and rendered 3D pins and route geometry across chunk boundaries.
- Concrete limits: Source review status remains `SOURCE_REVIEW_REQUIRED`; central chunk routes retain the exact precomputed 20 m Dijkstra graph.
- Verifiers: `tsc -p tsconfig.engine.json` (clean), 47 Node scientific oracles passed (`tests/unit/*.test.cjs`), `next build` static export succeeded, and `tools.checkpoint` updated (`docs/CHECKPOINT_REPORT.md`).

## Map layers legend & elevation heatmap (hypsometric tint) — 2026-11-14

- Task: Add a precision cartographic map layers legend (`MapLegend.tsx`) explaining active Geology (Stack et al. 2020 bedrock units) and Thermal Inertia (Edwards & Buz 2021 TIU ramp) layers with elevation disambiguation notes. Implement a dynamic client-rendered Elevation Heatmap layer (`elevationHeatmapPng`) using the verified USGS MRO CTX 20 m DTM and standard planetary hypsometric tinting (deep blue/violet for crater floor at -2,586 m through cyan, green, and amber to coral red at delta rim at -2,419 m) draped under 20 m/5 m contour lines. Add "Elevation" layer toggles across both MissionLifecycle and MissionWorkbench with active legend synchronization. Enhance point inspection to display geologic unit and thermal inertia values alongside elevation.
- Concrete limits: Hypsometric colors map linearly to authentic DTM elevation bytes (`elevation.bin`) with strict `mask.bin` bounds; no invented elevation values; existing contour geometry and shaded relief remain aligned to Mars AEQD.
- Verifiers: `tsc -p tsconfig.engine.json`, `node --test tests/unit/*.test.cjs` (45 passed, 0 failed), Next.js static build (`next build` succeeded), and `python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` (passed).

## NASA Space Apps Challenge Resources qualification & provenance — 2026-11-14

- Task: Audit and confirm direct utilization of datasets listed under the official NASA Space Apps Challenge 2026 Resources tab (`https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources`). Update `docs/sources.md` candidate C1 to confirmed, upgrade the in-app "Sources" panel to a structured NASA Challenge Data showcase with quantitative metric cards (48,400 DTM cells, 90,376 PDS MEDA records, 3 verified PDS sample core targets, 200+ Viking/CTX tiles) and explicit operational roles for each NASA mission product, and link the official challenge resources in the map legend and evidence drawer.
- Concrete limits: SESHAT explicitly distinguishes authentic NASA mission measurements (PDS DTM, PDS MEDA, PDS sample dossier coordinates, WATSON/Hazcam photography) from scenario assumptions (astronaut walk speed factors and consumable reserve equations); NASA is credited as the open data source, not an endorsing authority.
- Verifiers: `tsc -p tsconfig.engine.json`, `node --test tests/unit/*.test.cjs` (45 passed, 0 failed), Next.js static build (`next build` succeeded), and `python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` (passed).

## Unified workbench, SSoT token bridge & full Astryx adoption — 2026-11-14

- Task: Retire the legacy dark `.cc-backdrop` shell (`/?opportunities=1`), unify `/` and `/?demo=1` onto the light-default `.field-workbench` (`MissionLifecycle`) UI, adopt Meta Astryx `seshatTheme` compiled via `@astryxdesign/cli` with a 3-layer `--seed-*` → `--token-*` → `--color-*` SSoT bridge and header `ThemeControlPopup` (`Light` / `Dark` / `System`, presets, seed color pickers, scale/density/radius controls), pin `.field-map` (`overflow-x: clip` + sticky split layout), surface live `evaluatePositionOpportunities` inside the unified workbench, upgrade workbench/cartography controls to `@astryxdesign/core` components (`SegmentedControl`, `ToggleButtonGroup`, `Selector`, `NumberInput`, `TextInput`, `ProgressBar`, `Collapsible`, `Banner`, `Badge`, `Card`, `IconButton`, `Link`, `Spinner`, `Popover`, `Slider`), tokenize `ElevationProfile` SVG strokes, purge dead `.cc-*` CSS, remove accidental `package-lock.json` and superseded `seshat-jezero-*.png` screenshots, and update E2E suites.
- Concrete limits: Source review status remains `SOURCE_REVIEW_REQUIRED` pending independent team signoff; no changes were made to Mars AEQD math, `src/config/mission-scenario.json`, or `public/data/` scientific binaries; hosted Vercel deployment verification remains post-review.
- Verifiers: `.venv/bin/python -m tools.verify --offline` (Python pytest + security, TS scientific compile, Node 45/45 scientific oracles PASS), `pnpm verify` (all 8 stages including ESLint, Next.js static export build, and 11/11 Playwright E2E tests on `out/` PASS), and `.venv/bin/python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` (written and verified).

## Astronaut autonomy triage, live two-tier frontier, thermal footing & operator QoL (`feat/astronaut-autonomy-qol`) — 2026-11-14

- Task: Implement five astronaut-autonomy and operator QoL enhancements on branch `feat/astronaut-autonomy-qol`:
  1. Two-tier live Point-of-No-Return opportunity frontier (`liveFrontierMembership` / `summarizeFrontier` across time, O₂, and battery Wh at conservative 0.8× pace), rendered as a toggleable map overlay (`Frontier`) with synchronized legend and map-click reachability status.
  2. Thermal-inertia surface footing & trafficability (`firmGround` route preference + per-leg `meanThermalInertia`, `lowThermalFraction`, and `footingLabel` over Edwards & Buz 2021 data, degrading gracefully when unavailable).
  3. Multi-branch 60-second crew science triage (`triageReplanBranches`: Priority plan, Rapid-pass science salvage, Gentler-slope detour, Consolidated footing) with live map preview switching in `ChangeReview`.
  4. Mars–Earth light-time comms-delay autonomy callout and `earthSyncPacket` (`seshat-earth-sync-v1`) embedded in JSON and Markdown archives.
  5. Operator QoL upgrades: one-click `Load all sites` preset, single-mode top-priority trim helper, and route preference selector for 1–4 stops.
- Concrete limits: One-way light-time (`14.33 min`), stationary wait burn, rapid-salvage compression ratio (`0.6×`), and thermal-inertia sinkage penalty remain explicitly labeled `SCENARIO_ASSUMPTION`; `SOURCE_REVIEW_REQUIRED` remains open pending team signoff; no modifications were made to `src/config/mission-scenario.json` or `public/data/` binaries.
- Verifiers: `source .venv/bin/activate && pnpm verify` (all 8 stages PASS: 30 Python tests, TS scientific compile, 48/48 Node unit/oracle tests, lockfile check, ESLint, TS typecheck, Next.js static export, and 12/12 Playwright E2E tests; see `docs/VERIFICATION_RELEASE.md`) and `python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` (`docs/CHECKPOINT_REPORT.md`).

## 2-Layer Chunk Neighborhood (5×5 Chunks · 22×22 km) & 3D Terrain View — 2026-11-14

- Task: Compile the first two layers of chunks around the central 220×220 chunk (`Ring 1` [8 chunks] + `Ring 2` [16 chunks] + `Center` [1 chunk] = 25 chunks covering `1,100 × 1,100` source USGS 20 m CTX DEM pixels = `22.0 × 22.0 km` in Spherical Mars AEQD) via `pipeline/neighborhood.py`, producing `neighborhood-elevation.bin`, `neighborhood-mask.bin`, `neighborhood-terrain-geo.webp`, `neighborhood-heatmap-geo.webp`, and `neighborhood-orbital-geo.webp` (~1.65 MB total). Add a Google Maps-style interactive 3D Terrain View (`Mars3DView.tsx`) with orbit/tilt/zoom/vertical-exaggeration controls, 5×5 neighborhood vs. center chunk scope switching, draped map layers (Terrain, Orbital, Elevation Heatmap, Geology, Thermal), and 3D elevated route polylines and target pins.
- Concrete limits: Active 20 m precomputed Dijkstra fields cover the central chunk (`220 × 220` cells), while routes spanning the surrounding 24 chunks (`[-440..659, -440..659]`) use an 8-connected terrain-aware A* solver over the 550×550 neighborhood DEM (`40 m` spacing with `20 m` center refinement) enforcing canonical `src/config/mission-scenario.json` slope (`25°` max), uphill/downhill coefficients (`4.0` / `1.8`), hazard avoidance, and quadratic grade penalty; source review status remains `SOURCE_REVIEW_REQUIRED`.
- Verifiers: `python3 -m pipeline.neighborhood`, `tsc --noEmit`, `tsc -p tsconfig.engine.json`, `node --test tests/unit/*.test.cjs` (47 passed, 0 failed), Next.js static export (`next build` succeeded), and `python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md`.

## Map-first navigation and full Jezero coverage — 2026-11-14

- Task: Compared the current workbench and Google Maps directions in the browser. Added the route planner at `/` and moved the existing workbench and synthetic entry to `/dev/`. Restored both of Ali's outer rings in the public 2D and 3D views, including stop selection. Shared the terrain eligibility checks with route events and checked the exact cells used for neighborhood route geometry and cost.
- Limits: Input remains operator-reported. The live return frontier uses the central grid, and the original scenario and data binaries are unchanged. This checkpoint does not establish source approval, deployment, or challenge eligibility.
- Evidence: Python pipeline and security 30/30, Node scientific and engine 50/50, synthetic Chromium acceptance passed. `pnpm verify` failed at the standard Turbopack build on a local port restriction and its browser phase ran against an older export. A fresh `pnpm exec next build --webpack` passed, then `pnpm test:e2e` passed 15/15 against that export. Static-export screenshots include the 25-chunk overview, Ring 2 route and 3D view, and before/after hazard routing on desktop and mobile.
