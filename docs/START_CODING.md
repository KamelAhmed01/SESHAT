# SESHAT — Build handoff (authorized H0)

The team has confirmed permission to start project coding. The project is a **real foundation committed locally**; it is **not yet a verified Mars science demo**.

## 1. First machine setup

Node 22+ and Python 3.12+ are recommended. Use **pnpm** on all laptops.

```bash
corepack enable
pnpm install
# Commit pnpm-lock.yaml and switch CI to --frozen-lockfile after first install
pnpm exec astryx init
pnpm exec astryx component Button
pnpm dev
```

`astryx init` can modify `AGENTS.md`. Review and **merge**, don't overwrite the SESHAT constitution.

To build the offline static export:

```bash
pnpm typecheck
pnpm test
pnpm build
python3 -m http.server 4173 -d out
```

Open `http://localhost:4173`. Do not distribute `out/` before a real build has passed.

**Environment limitation during creation:** the assistant's container could not reach `registry.npmjs.org` (EAI_AGAIN), so npm dependencies and browser E2E were not installed or executed. The package versions are pinned in `package.json`, but there is **no invented `pnpm-lock.yaml`**. The first connected machine must run `pnpm install`, commit the generated lockfile and check the official Astryx APIs against the installed version. If versions clash, resolve and re-pin together.

## 2. Real scientific compiler

```bash
python3 -m pip install -r pipeline/requirements.txt
python3 -m pytest -q pipeline/tests
python3 pipeline/inspect.py data/raw/jezero_ctx_20m.tif --output docs/data-evidence/ctx_inspection.json
```

Once authoritative **projected Mars metric CRS**, source alignment, and candidate target overlap are checked, use an actual valid crop:

```bash
python3 pipeline/compile.py \
  --dem data/raw/jezero_ctx_20m.tif \
  --window ROW COL HEIGHT WIDTH \
  --base-cell BASE_ROW BASE_COL \
  --source-id VERIFIED_SOURCE_IDENTIFIER \
  --source-url https://REAL-SOURCE-URL \
  --output public/data
```

Replace every uppercase token with an **inspected** value. Default crop limit is 250×250 cells. The compiler creates a DEM-derived hillshade (not an ortho-photo), six aligned binary buffers, exact SHA-256 hashes, grid metadata, and a **SOURCE_REVIEW_REQUIRED** manifest. This command does NOT verify NASA challenge-Resources eligibility, CRS ontology or target coordinates by itself.

To promote to `VERIFIED` the team must separately prove: authoritative input + license, source-to-Mars CRS, official challenge-resource qualification, grid/target overlap, target evidence, code oracles and external review. Set `coordinateFrameVerified` and `challengeResourceQualified` only with recorded source proof. Current targets remain absent by design.

## 3. Immediate task queue

| Priority | Domain | Task / proof |
|---|---|---|
| 1 | Kamel + Ali | Start repo and Vercel preview; `pnpm install` then commit lockfile; Astryx Button and static-export smoke |
| 1 | Shams | Store authorized H0 and official challenge Resources exact URL in `docs/event-evidence/` and `docs/sources.md` |
| 1 | Amr | Inspect CTX native CRS / size / NoData, crop overlap; run Python tests and record readout |
| 1 | Hams + Kamel | Apply custom compiled Astryx SESHAT theme after checking CLI template and docs; sign off first screenshot |
| 1 | Malak | Inspect `best_interp.csv` plus XML coordinate/frame columns; establish target evidence before declaring verified locations |
| 2 | Ali | Cross-check directional path binaries, map transform, E2E custom pin and frontier against real accepted crop |
| 2 | Shams + Hams | Draft source-backed target story and the judge's +15-minute hero interaction |

## 4. Important limitations

- The map shows **only a grid scaffold until source data is loaded**; this is intentional, not Mars imagery.
- Route costs are deterministic regional scenario modeling, not EVA-certified safety calculations.
- The `+15 min` clock is implemented; terrain frontier and custom-pin assessment become scientific features only after verified bundle gates.
- Browser test, installed Astryx theme, visual screenshot approval and a real Vercel URL are still **unverified**.
- No external GitHub repo was available through the connected account at creation time. Push the local commit to the team's intended repo; do not push to another person's unrelated repo.
