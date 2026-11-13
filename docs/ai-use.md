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
