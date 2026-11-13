# Jezero mission lifecycle

The Cairo team confirmed a Saturday, November 14, 2026, 1:00 p.m. local submission deadline. Use 12:15 p.m. Cairo time as the team's delivery target. Cairo requires its own form and the global team project page. The global window opens Saturday at 9:00 a.m. and closes Sunday at 11:59 p.m. local time. Keep the organizer's written Friday build-start record with the team. [Cairo FAQs](https://spaceappscairo.com/faqs) · [Global schedule](https://www.spaceappschallenge.org/2026/) · [Global terms](https://www.spaceappschallenge.org/legal/)

## Rehearse the judge story

Run `pnpm build`, then `pnpm start:export` and open `http://127.0.0.1:4173/`.

1. Add **Shuyak · Cape Nukshak**, **Hazeltop · Wildcat Ridge**, and **Swift Run · Skinner Ridge**. Switch to **Orbital** and show the sequence and return reserves. The scenario landing site is near the western fan. The historical Perseverance landing is a separate map marker.
2. Choose **Approve & lock baseline plan**, then **Complete next stop**. In the default three-stop scenario, the completed stop is Shuyak.
3. Under **Record an event**, choose **Destination inaccessible** and select **Hazeltop · Wildcat Ridge**. Choose **Record event & recalculate**. The review preserves Shuyak and defers Hazeltop.
4. Choose **Approve revision & continue**, **Complete next stop**, then **Return to Landing Site**. In the tested default scenario, the simulated return is T+01:31 after visits to Shuyak and Swift Run.
5. Download the JSON mission archive. It contains the frozen baseline, active plan, traveled geometry, event inputs, and review decisions. The Markdown and print actions provide readable summaries. Use **Resume saved mission** to recover the browser's latest recorded state.

Use the science cards to compare sedimentary observations at Amalik, Wildcat Ridge and Skinner Ridge. The planning budget is 180 min, 540 L O₂ and 900 Wh, with separate reserves of 20 min, 90 L and 150 Wh. These are scenario parameters. Approval requires meeting all three reserves at each modeled speed (0.8×, 1.0× and 1.2×). The DEM is sampled at 20 m. The planner models grade and NoData, and computes optional outdoor contingency stops from the local grid and modeled reserve. No shelter structures, boulder hazards, current weather, or physiology are inferred. Simulated sensors and instruments use the same manual review flow as field input.

## Resource audit and downloads

I opened all five links on the [challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources).

| Resource | Download path and role |
| --- | --- |
| [NASA/JPL Mars Trek](https://trek.nasa.gov/mars/) | In the layers sidebar, search **Jezero**. Select **MRO CTX, Jezero DEM, Controlled** or **MRO CTX, Jezero Mosaic, Controlled**, then **Download**. The DEM drives routing, grade, and relief. The 6 m CTX mosaic provides an aligned orbital basemap. [DEM GeoTIFF](https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0) · [Orbital GeoTIFF](https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0) |
| [USGS–NASA Planetary Geologic Mapping Program](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | **List View → Jezero → USGS SIM 3464**. The report supplies regional unit context at 1:75,000. The full GIS database is about 333 MB. Use the report or a cropped/reprojected unit layer if needed. [Report](https://doi.org/10.3133/sim3464) · [GIS download directory](https://pubs.usgs.gov/sim/3464/) |
| [Curiosity’s proposed path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | **Downloads → Original** gives a 2.86 MB GIF. The annotated route is a presentation reference from Gale crater. |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | **Data** passes supported Earth layers to Earthdata Search. **Take a snapshot** exports a view. The linked product serves Earth imagery and events. |
| [Perseverance Raw Images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Filter by sol and camera. Open a result for instrument, time, credit and the **Download** link. The app uses the related NASA-published WATSON abrasion images for Skinner and Wildcat Ridge, and Hazcam context for Enchanted Lake. [WATSON image pair](https://science.nasa.gov/resource/two-abrasion-patches-from-perseverance-at-jezero-delta/) · [Hazcam context](https://science.nasa.gov/resource/enchanted-view-of-jezero-rocks/) |

The original USGS DEM and the Mars Trek download have different file hashes. Raster inspection found identical CRS, affine, shape, NoData mask and values for all 2,413,152 cells. The USGS file retained by the H4 acquisition pipeline is the same CTX terrain product. The app also directly consumes Mars Trek's orthomosaic. These are material uses of a listed resource. Final award eligibility remains an organizer decision. [USGS CTX DTM catalog](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic) · [NASA Global Organizing Team guidance](https://github.com/nasa/spaceapps/discussions/1827)

The CTX file is 1,596 × 1,512, equirectangular with a 3,396,190 m Mars sphere. The analysis crop is 220 × 220 in local Mars azimuthal equidistant coordinates, with 45,771 usable cells and 2,629 NoData cells. The matched optical layer covers the complete output grid. The original proposed crop at 18.448°N, 77.445°E put Swift Run on NoData and the other two sites out of bounds.

| Sample-site anchor | Source-reported latitude and east longitude | H4 nominal travel round trip |
| --- | --- | --- |
| Swift Run · Skinner Ridge | 18.458931°, 77.40617078° | 33.93 min |
| Hazeltop · Wildcat Ridge | 18.45863707°, 77.40588851° | 33.19 min |
| Shuyak · Cape Nukshak | 18.45068954°, 77.40143171° | 37.60 min |

The points come from the Mars 2020 sample dossiers, chapters 11, 14 and 16. Hawksbill Gap is the broader region for Swift Run and Hazeltop. The UI labels the locations as source-reported pending independent review. The current bundle keeps the team's `SOURCE_REVIEW_REQUIRED` status. [PDS sample dossiers](https://pds-geosciences.wustl.edu/missions/mars2020/returned_sample_science.htm) · [NASA sample catalog](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/)

## Reproduce the terrain, imagery and reachability check

The generated bundle is in `public/data`. The following commands build a scratch copy of the numeric terrain and aligned mosaic without modifying the shipped bundle. The three small credited surface-photo derivatives and the historical landing marker are already included in the shipped bundle.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r pipeline/requirements.txt
python -m pipeline.acquire --only dem
python -m pipeline.real_ingest --side 220 --center-lat 18.452 --center-lon 77.414 --output data/review-jezero
curl --fail --location --output data/raw/trek-ctx-orthomosaic.tif 'https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'
python -m pipeline.optical --image data/raw/trek-ctx-orthomosaic.tif --bundle data/review-jezero --source-title 'Mars Trek MRO CTX, Jezero Mosaic, Controlled' --source-url 'https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'
python -m pipeline.targets docs/targets.jezero.json --bundle data/review-jezero
python -m pipeline.preflight --bundle data/review-jezero
```

The orthomosaic download used SHA-256 `842b457afee7c2672022b66e3f60be836c6d52e99474015bfd9ced60099b8615`. The alternate Mars Trek DEM download used `46fb2e1e9f9c1fdd02939c2a96f3e173a8731bd146fbeb969b2060e0a3c8e97e`. The compiler's USGS source SHA and local projection are in [the runtime manifest](../public/data/manifest.json). NASA and USGS data and images retain their original credits and use terms. [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) · [USGS data reuse](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted)

## Delivery gates

- **Data review** — Amr and Malak check the source coordinate frame, terrain datum, target names and instrument captions, then sign the evidence under the existing H4 review procedure.
- **Judge demo** — Shams and Ali rehearse the inaccessible-stop scenario. The Cairo FAQ permits an English deck of up to seven slides or a video of up to 30 seconds with English subtitles. Preserve the already-tested local static export.
- **Public delivery** — Verify the public project link in a signed-out browser. Submit the same project through Cairo's form and the global team Project tab, and retain both receipts.
- **Scope** — Spatial routing, consumables and the adaptation loop work locally. Local event authorization, independent science attestation, public hosting and portal submission are separate evidence items.

[Production planning screenshot](../screenshots/seshat-jezero-planning.png) · [Production revision screenshot](../screenshots/seshat-jezero-replan.png)
