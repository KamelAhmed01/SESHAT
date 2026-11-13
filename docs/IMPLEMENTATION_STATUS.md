# Implementation status — H3 local execution checkpoint

## Executed and proved in the authoring environment

- [x] Source tree, Next.js App Router static export configuration, Meta Astryx component/provider CSS layer foundation, Tailwind v4 and Leaflet local-grid viewer created.
- [x] Deterministic mission clock, manifest verifier, inspectable no-data/UNKNOWN state, and scenario feasibility engine implemented.
- [x] SciPy directed 4/8-neighbor graph compiler with no-corner-cut, slope constraints, source/no-data masks, outward/reverse Dijkstra and little-endian binary exporter.
- [x] 29 TypeScript-engine synthetic oracles passed using global TypeScript and Node test runner (including modeled hard-vs-unknown blockage, profile math and brief export).
- [x] 19 Python tests passed: routing plus Mars-class GeoTIFF, source-provenance, repeat-download SHA preservation, ROI centering, target importer and optical alignment fixtures.
- [x] Outbound/return DEM-scale elevation profiles implemented in Next source and exercised in the browser harness; report export produces a Markdown evidence brief and clearly marks synthetic/pending data. The actual Next app has NOT been built here.
- [x] H3 evidence-gated all-target opportunity ledger, conservative lost-vs-unknown semantics, Astryx custom theme source, precise marker filtering, and evidence-drawer keyboard focus behavior implemented in React source (production build still unverified).
- [x] Machine-readable checkpoint command implemented: `python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md`.
- [ ] Actual NASA/USGS GeoTIFF bytes acquired in this sandbox: **not yet; network/DNS blocked**. Verified remote catalogs and direct product URLs, implemented downloader and acceptance-tested ingestion on controlled Mars-projected GeoTIFF fixture; official 2026 challenge-Resources membership still needs human capture.
- [ ] Exact science-target coordinates proven against PDS geology and overlap: **not yet**. Validation/importer exists and rejects unsourced precision.
- [ ] `pnpm install`, Next production build and compiled SESHAT Astryx custom theme **not run**; authoring container cannot reach npm registry. **Done:** standalone Chromium visual-acceptance screenshots and interaction tests (explicitly not Next app).
- [ ] Vercel deployment and custom domain: **not configured**; no accessible team repository.
- [x] Standalone Chromium acceptance checks: selected target, round-trip values, +15-minute shrink, reset, evidence drawer, synthetic elevation profile, Markdown test export, mobile overflow. **Not equivalent** to production Next E2E.
- [ ] Production Next browser E2E, deployment and Global Awards submission: **not yet**.

## Handoff rules

The checked-in H0 model parameters and timer are research **scenario assumptions**. Actual Mars output requires reviewed source inputs. Do not change the bundled manifest to VERIFIED for screenshot aesthetics. Run `pnpm install` on an internet-connected team machine, commit the generated `pnpm-lock.yaml`, switch CI to `--frozen-lockfile`, and run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before claiming the frontend works. H3 Astryx theme source is committed, but compiled CSS and the full Next.js build remain unverified until networked installation.

## Single source of truth for execution status

Use [`CHECKPOINT_REPORT.md`](CHECKPOINT_REPORT.md). Refresh using `python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` after each milestone. Source implemented != source installed != browser integration verified != global submission accepted.
