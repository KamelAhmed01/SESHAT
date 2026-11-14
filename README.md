# SESHAT

**Mars surface science traverse planner & opportunity workbench.**

SESHAT is an evidence-traceable planetary surface science planning prototype built for the NASA Space Apps Challenge. Using real MRO Context Camera (CTX) elevation models, controlled orbital imagery, and documented Mars 2020 Perseverance sample sites on Jezero Crater's western fan, it models multi-stop traverse itineraries, reserve margins across three pace regimes (`0.8×`, `1.0×`, `1.2×`), event-driven replanning, and dynamic reachability contraction under departure delay.

- **Route Planner (`/`)** opens on all 25 Jezero terrain chunks. Add science stops in the 2D or 3D view, check the round trip and reserves, and report field changes. Qualifying detours update the path and explain the next action.
- **Dev Workbench (`/dev/`)** contains the existing planning and rehearsal tools, the opportunity frontier, evidence details and JSON/Markdown export.
- **Synthetic Test Scene (`/dev/?demo=1`)** is the labeled acceptance fixture for deterministic UI and graph testing.

The shared budget, reserve, speed, and terrain grade model parameters live in [`src/config/mission-scenario.json`](src/config/mission-scenario.json).

---

## Quick Start

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To build and serve the static production export locally:

```bash
pnpm build
pnpm start:export
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

---

## Architecture & Stack

- **Web Workbench**: Next.js 16 (App Router, `output: 'export'`), React 19, TypeScript, Tailwind CSS v4, and Meta Astryx (`@astryxdesign/core`).
- **Cartography & Profiles**: Leaflet `CRS.Simple` north-up grid mapping to Mars local Spherical Azimuthal Equidistant (AEQD) coordinates, DEM elevation contours, Perseverance WATSON/Hazcam surface views, and SVG elevation profiles.
- **Traverse Engine (`src/engine/`)**: Directed, grade-weighted 8-connected graph search enforcing separate outbound and return cost fields, explicit NoData blocking, and 3-speed reserve verification (`180 min` / `540 L O₂` / `900 Wh`).
- **Offline Terrain Compiler (`pipeline/`)**: Python 3 + Rasterio/NumPy/SciPy tools that ingest GeoTIFF topography and orbital mosaics into row-major little-endian binary buffers and SHA-256 verified manifests.

---

## Scientific Honesty & Review Gate

SESHAT is a research prototype, not EVA safety guidance or NASA-endorsed mission software.

- The shipped terrain bundle under `public/data/` is compiled from USGS MRO CTX 20 m elevation data, Mars Trek 6 m CTX controlled orthomosaic imagery, and three NASA PDS Mars 2020 sample-site anchors (*Swift Run · Skinner Ridge*, *Hazeltop · Wildcat Ridge*, and *Shuyak · Cape Nukshak*).
- Runtime data loading verifies schema, grid invariants, byte sizes, and SHA-256 digests (`src/data/loader.ts`) while keeping `status: "SOURCE_REVIEW_REQUIRED"` until independent team coordinate and Resource verification is completed via `pipeline.approve`.
- Mobility speeds, grade coefficients, consumables, and budgets are explicit `SCENARIO_ASSUMPTION` parameters.

See [`docs/MISSION_LIFECYCLE.md`](docs/MISSION_LIFECYCLE.md) for the full mission flow and resource audit, and [`docs/REAL_DATA_H0.md`](docs/REAL_DATA_H0.md) for pipeline reproduction commands.

---

## Verification

Run the strict release verification suite (Python/security tests, TypeScript engine compile, Node scientific oracles, ESLint, Next.js static export, and Playwright E2E tests):

```bash
pnpm verify
```

Additional local checks:

```bash
# Offline scientific & security oracles only
python3 -m tools.verify --offline

# Standalone synthetic visual-acceptance harness (not the Next.js build)
python3 tools/preview/build.py && python3 tools/preview/test_preview.py

# Refresh local readiness snapshot
python3 -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md
```
