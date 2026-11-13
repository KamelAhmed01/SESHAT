# SESHAT — real Mars data integration runbook

**Status:** pipeline implemented and real CTX + orbital datasets ingested into `public/data/`; independent team review and official 2026 challenge Resources capture remain open. Do not treat test fixtures (`public/demo/`) as planetary evidence.

## Team role split

- **Shams or Malak:** Open the [official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources), save a screenshot/PDF under `docs/event-evidence/official-challenge-resources.png`, and record the exact NASA resource URL that is **actually used by SESHAT** in `docs/sources.md`. The program's official Resources list is not conclusively readable from this authoring environment. Do not assume any independently useful USGS dataset is automatically a qualifying challenge-listed NASA source.
- **Amr:** Run the USGS/PDS downloads and inspect the real file's coordinate reference frame, NoData, vertical units and coverage. Keep the raw bytes outside git in `data/raw`.
- **Malak and Hams:** Check target-specific papers and PDS pose metadata; propose at least **two independently documented exact points** inside a single terrain ROI. Rover pose ≠ an outcrop without a link to a specific geological observation.
- **Kamel or Ali:** Run the frontend install/verification and maintain one stable demo branch. Do not let concurrent coding agents alter the GIS binary contract.

## A. Install and retrieve real Mars files

In a clean terminal at repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate            # Linux/macOS
python -m pip install -r pipeline/requirements.txt

# Downloads real CTX 20m DEM (~9.3 MB catalog) and PDS PLACES CSV (about 8 MB)
python -m pipeline.acquire

# No guessed CRS or vertical interpretation
python -m pipeline.inspect \
  data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif \
  --output data/reports/ctx-dtm-inspection.json
python -m pipeline.places data/raw/best_interp.csv \
  --out data/reports/places-review.json
```

Authoritative data source links:

- USGS CTX DTM (Mars Reconnaissance Orbiter): <https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic> — DOI:10.5066/P906QQT8. Direct filename: `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`.
- PDS rover PLACES (Perseverance, Mars 2020): <https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv> and <https://pds-geosciences.wustl.edu/missions/mars2020/places.htm>. For exact field definitions read its matching PDS4 label / archive documentation.
- NASA official challenge: <https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/>.

If venue DNS/network fails, download the **exact original URL** on a teammate's hotspot or browser and store the original bytes in `data/raw`. If manual copying bypasses the downloader's recorded URL/SHA, the system correctly marks source provenance **unverified**. Record its original download URL and SHA rather than editing the manifest to force a success state.

## B. Verify a chosen 4–5 km science study area

The CTX DTM samples at roughly **20 projected m/pixel**. A `--side 220` source window covers roughly 4.4 km north–south but a smaller real east–west ground extent near 18.5°N. The compiler reprojects that window into a **220×220 local Mars AEQD grid** with separately recorded 20 m analysis sampling; source-window coverage outside the true bounds becomes NoData, never fabricated terrain. The real full extent is much larger: **do not take its center as a guaranteed Western Delta science location**.

If verified mission-observation lat/lon are available, choose the crop by **planetocentric latitude and positive-east longitude**:

```bash
python -m pipeline.real_ingest --side 220 \
  --center-lat YOUR_VERIFIED_PLANETOCENTRIC_LAT \
  --center-lon YOUR_VERIFIED_POSITIVE_EAST_LONGITUDE
```

Until then, running `python -m pipeline.real_ingest --side 220` creates an **exploratory central crop** only. This is allowed as a temporary planning surface, not as evidence that particular science targets lie there.

Always inspect `public/data/manifest.json`: confirm `planetaryBody`, `sourceBodyRadiusMeters`, **`sourceCrsWkt` and `sourceRasterTransform`**, **local** `crsWkt` and `rasterTransform`, `analysisProjection`, `sourceWindow`, NoData mask, and source SHA. Recheck geographic target alignment after the warp. GeoTIFF bytes and a plausible file name **do not prove** the file is the linked USGS product.

If the point is outside the selected 220×220 cells, `pipeline.targets` **fails**. Change ROI and recompile. Never snap a scientific target to the nearest convenient cell.

## C. Add documented scientific targets

`docs/targets.example.json` is a **region-only template**, not a claim of validated geolocation. To create routable science points, replace that template with *independently researched* `VERIFIED_POINT` entries: unique ID, real name, planetocentric latitude, east longitude, exact `coordinateSource` HTTPS link, `coordinateReviewer`, source-linked scientific evidence and assumption-labeled activity duration.

```bash
python -m pipeline.targets docs/targets.example.json --bundle public/data
```

An `APPROXIMATE_REGION` stays unroutable / `UNKNOWN`, even if it has interesting science. Extracting Sol rows from PLACES is useful for rover context, but **not sufficient** to label a rock outcrop as a precise target.

Run the distance/budget gate before declaring target feasibility:

```bash
python -m pipeline.preflight --bundle public/data \
  --output data/reports/science-reachability.json
```

This rejects targets that exceed even optimistic straight-line travel, and separately reports modeled directed paths. It does not guarantee any route is safe.

## D. Optional, genuinely aligned orbital imagery

When you have a **georeferenced**, public Mars orbital optical GeoTIFF that actually overlaps the chosen terrain area (e.g. the USGS Mars 2020 CTX 6m orthomosaic; inspect product size before downloading), use:

```bash
python -m pipeline.optical \
  --image data/raw/REAL_ORBITAL_GEOTIFF.tif \
  --bundle public/data \
  --source-title 'Mars 2020 CTX orthomosaic / exact product ID' \
  --source-url 'https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-context-camera-orthorectified-image-mosaic'
```

The command uses the **local metric analysis CRS and affine** from `manifest.json`, reprojects from the orbital source CRS to the **exact same rows and columns**, emits a hashed WebP, and makes the app's **Terrain / Orbital** layer switch available. A mismatched or disjoint image is rejected. No manual CSS stretch or Mars-to-Earth Web Mercator hack.

## E. Team science/Resources review gate

**Do not execute this gate until the evidence really exists**. For actual global judging the team needs a NASA data source **listed in this selected 2026 challenge's Resources**, visibly integrated into the app, source-linked science targets, and an independently checked coordinate mapping.

Once two exact source-backed targets are in the accepted crop and the Resources capture exists:

```bash
python -m pipeline.approve \
  --bundle public/data \
  --reviewer 'Actual reviewing team member' \
  --official-resource-url 'https://ACTUAL_NASA_RESOURCE_LISTED_BY_CHALLENGE' \
  --resources-capture docs/event-evidence/official-challenge-resources.png \
  --notes 'At least 30 characters documenting frame, coverage, target coordinate and source checks' \
  --confirm
```

This is a **team review attestation**, not NASA endorsement or astronaut flight validation. The CLI rejects unverified-origin files, incomplete evidence, and fewer than two verified coordinate-backed targets. The manifest is cryptographically checked for its numeric files and imagery.

## F. Verify, screenshot, and ship

```bash
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm dev
```

- Open `/` on localhost to see actual compiled Mars data (never `/demo`). Check first-click custom destination, science target cards, route pair, speed margins, +15 min frontier and source drawer.
- Open `/?demo=1` **only** for labelled synthetic integration testing.
- Save 1440×900 and 390×844 screenshots of the **running Next app**; keep them distinct from the existing *standalone* visual acceptance harness screenshots.
- Verify deployment on Vercel, static exported offline fallback, local fonts/images, and hot-spot operation. Do not claim Vercel or npm build passed until actual output is captured.
- Capture the official project submission and final link before the organizers' deadline.

## Stop-and-fix signals

- The official Resource listed in the challenge is not the one SESHAT visibly uses.
- GeoTIFF has Earth radius / unknown CRS, wrong planetary longitude convention, or unsupported vertical units.
- Scientific target source offers only a region, or its purported exact coordinate falls outside DEM bounds.
- Orbital imagery does not spatially overlap or cannot be independently aligned.
- The screenshot shows a route on synthetic terrain without a prominent synthetic label.
- The app claims future Mars weather, instantaneous astronaut safety, validated EVA speed, or certainty at 20 m pixel scale.

For review traceability, store actual source screenshot, inspected JSON reports, reviewer signoff and test output in `docs/event-evidence/` or `data/reports/` (keep large raw rasters out of git).
