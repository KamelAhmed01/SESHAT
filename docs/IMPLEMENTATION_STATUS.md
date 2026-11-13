# SESHAT implementation status — H4 checkpoint

This is the executable-source status, not a NASA claim. Refer to [`CHECKPOINT_REPORT.md`](CHECKPOINT_REPORT.md) for the most recent automated snapshot and the strict [`VERIFICATION_RELEASE.md`](VERIFICATION_RELEASE.md) for blockers.

## Committed source and locally executed checks

- [x] Next.js / Astryx / Tailwind / Leaflet map workbench source, science targeting and deterministic routing engine.
- [x] Real DEM acquisition/inspection/ingestion pipelines, PDS table inspection, optional orbital alignment and evidence/human approval gate.
- [x] **Mars ground-distance correction**: original equirectangular CRS and transform retained; local spherical Mars azimuthal-equidistant metric analysis grid generated and labeled. Bilinear elevation, explicit NoData, correct analysis geometry and target coordinate mapping.
- [x] **One versioned scenario**: `src/config/mission-scenario.json` drives React budget/reserve/speed and Python terrain coefficients. These values remain hypothetical research assumptions.
- [x] **Target distance/reachability preflight**: optimistic flat lower bound versus actual directed outbound + return fields. Source points must be independently verified.
- [x] **Security code/config checks**: Vercel HTTP header configuration and unit assertions. Production HTTP behavior still must be inspected.
- [x] **Browser test code**: real Next.js static-export Playwright suite and production server config. This suite has been authored, not run on a built application.
- [x] **CI and review artifacts**: fail-fast frozen pnpm lockfile gate, Python/TS/Next and Playwright jobs, review template, AI assistance log, and compact team run sheet.
- [x] **Offline test run**: `docs/VERIFICATION_OFFLINE.md` — passing local scientific and security checks, not production certification.
- [x] **Synthetic browser acceptance**: map/frontier/target selection/export/mobile harness passed. This is not real Mars or the actual production React build.

## Outstanding evidence gates — not passed

- [ ] C0: Archive written Cairo organizer authorization and any applicable global-organizer permission for Friday H0.
- [ ] C1: Official 2026 selected-challenge Resources capture and proof of an **actually used** qualifying NASA source.
- [ ] G1: Download/inspect/hash the actual USGS/PDS original bytes, confirm Mars planetary frame and vertical datum.
- [ ] G2: Validate source target coordinates against the ROI and one independently verified geodesic/location oracle; obtain at least two precise scientific targets.
- [ ] Frontend: generate and commit `pnpm-lock.yaml` on an internet-connected machine; install Astryx/Next. Build, typecheck, lint and **run real Playwright E2E**.
- [ ] Capture genuine Next.js desktop/mobile evidence and produce the production static export/offline copy.
- [ ] Connect team GitHub remote, push honest H0–H4 history, confirm access and CI.
- [ ] Deploy live Vercel/Cloudflare URL; verify TLS and actual security headers, then offline fallback on two machines.
- [ ] Human scientific review, independent UX trial, demo/pitch/video and official submission receipt.

**Security caveat:** The current CSP deliberately permits `unsafe-inline` for the static app and Astryx runtime integration; this is not the same as a hardened nonce/hash CSP. Do not claim strict CSP validation until the deployed application is tested.

**Build caveat:** This author's container cannot resolve the npm registry. The release verifier correctly reports **FAIL** until dependency lockfile, real Next.js build and production Playwright prove otherwise. Never substitute synthetic preview screenshots as real app screenshots.
