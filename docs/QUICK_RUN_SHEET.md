# SESHAT — live execution run sheet

**Owner:** Kamel / Ali · **Science:** Amr / Malak · **Design:** Hams / Kamel · **Pitch:** Shams / Ali

**North star:** An evidence-based Mars science map where a 15-minute delay visibly removes or weakens *returnable* scientific options. SESHAT is a research demonstrator, not EVA safety advice. Keep H0 evidence and NASA challenge Resource evidence in `docs/event-evidence/` without rewriting commit history.

## START · If you have just opened the repository

```bash
node -v && python3 --version
corepack enable
pnpm install                 # commits pnpm-lock.yaml on a connected laptop
python3 -m pip install -r pipeline/requirements.txt
python3 -m tools.verify --offline
pnpm typecheck && pnpm lint && pnpm build
pnpm exec playwright install chromium
pnpm test:e2e                # real static export, NOT the standalone demo harness
```

The release command `pnpm verify` runs these checks and must **FAIL** if build/dependencies are missing. `pnpm verify:offline` only proves local science/security oracles. UI screenshots from `tools/preview` are synthetic and do not prove the Next.js production rendering.

## SCIENCE · First priority after install

1. **Shams:** capture the official 2026 challenge Resources listing and organizer-start authorization, with URLs and dates. Never mark C0/C1 verified merely because a file is called NASA.
2. **Amr/Malak:** `python -m pipeline.acquire --only dem` → `python -m pipeline.real_ingest --center-lat LAT --center-lon LON` using a **source-backed Mars center**. H4 reprojects source Equirectangular pixels onto a **local Mars azimuthal-equidistant** metric grid; review `manifest.json` source CRS, analysis CRS, mask, and bounding corners before claiming real travel distances.
3. **Amr/Malak:** curate two independently source-linked exact targets within that ROI; run `python -m pipeline.targets docs/targets.example.json --bundle public/data`, then `python -m pipeline.preflight --bundle public/data`. If those targets lie outside the crop, choose a defensible new ROI — do not snap them into a convenient map.
4. **Ali + science reviewer:** verify the asymmetric paths, slope limits, no-data, reverse tree, one known-distance target, and science data attributions; approve with `python -m pipeline.approve --help` **only after** documented evidence gates and human sign-off. Model coefficients, 180-minute planning window, 20-minute reserve and target durations are assumptions.

## FRONTEND · Keep judges from seeing an unfinished app

- **Kamel/Ali:** Astryx (`@astryxdesign/core`) + Tailwind v4 is the single conventional UI component system; bespoke cartography and visualization use Leaflet `CRS.Simple`. Keep the theme, mission clock and field compiler on one configuration. After the build, capture real Next.js screenshots and test the initial map, target pick, outbound + return, three-speed sensitivity, +15 min shift, evidence drawer, custom pin and Markdown export.
- **Hams:** inspect desktop 1440px and mobile 390px for readable legends, map contrast, no overflowing controls, keyboard access, authentic source labels and coherent SESHAT typography. No dashboard slop, generic shadcn theming, unnecessary animation or invented science badges.
- **Shams/Ali:** rehearse one sourced science decision including which target becomes unavailable and why. Record a screen demo with a trustworthy offline fallback. Five-slide deck; the real product is the hero.

## DECISION / RECOVERY GATES

| Decision | Action |
|---|---|
| DEM download/projection/ROI fails | Keep source as `SOURCE_REVIEW_REQUIRED`; use documented diagnostic output; synthetic demo remains clearly labeled and cannot substitute for real scientific eligibility |
| No two defensible science points overlap | Move the study region, or describe regional observations honestly; never forge points |
| A candidate target is too far for selected budget | Run preflight and choose a defensible scenario; never modify measured path costs to manufacture a +15-minute effect |
| `pnpm build` or real E2E fails | Treat app as not release-ready; fix compile/runtime before new UI features |
| Astryx bespoke theme fails | Use the tested Neutral foundation and SESHAT token overrides; no broad library replacement |
| Production DNS/network fails | Serve the frozen static `out/` export offline, verify on two laptops |
| Last release window | No stretch work; freeze source/data, audit evidence and submit with receipt |

## HARD TRUTH — current state

A committed implementation and passing synthetic tests are **not** verified real Mars outputs. The authoritative status is `docs/IMPLEMENTATION_STATUS.md` + `docs/VERIFICATION_LATEST.md`. GitHub push, real TIFF, source eligibility, precise coordinates, npm/Next build, production screenshots, Vercel deployment, accessibility QA and final submission remain independently verifiable gates.
