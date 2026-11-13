# SESHAT final master execution plan

**Edition 2.0 · 13 November 2026 · SESHAT Explorers**

**Challenge:** Interplanetary Survival Guide: Martian Map

**Build baseline:** `main`

This is the current team plan for the Cairo submission. The [event ledger](event-brief.md) records organizer evidence and the [release report](VERIFICATION_RELEASE.md) records software checks.

**Local deadline:** Saturday, November 14 at **1:00 p.m. Cairo time**, as confirmed by the team. **Delivery target:** 12:15 p.m. Cairo time. Submit through the Cairo form and the global team Project tab. The global portal window is Saturday at 9:00 a.m. through Sunday at 11:59 p.m. local time. The team reports a Friday 9:00 a.m. build start. Written authorization and the local pitch slot still require organizer evidence. [Cairo FAQs](https://spaceappscairo.com/faqs) · [Global schedule](https://www.spaceappschallenge.org/2026/) · [Global terms](https://www.spaceappschallenge.org/legal/)

## 1. Mission and acceptance criteria

A simulated astronaut leaves a hypothetical landing site near Jezero's western fan, compares published sedimentary exposures, and returns to base. The app uses MRO CTX topography and imagery together with Mars 2020 Perseverance sample records and surface imagery. Perseverance's historical landing appears separately for context.

| Phase | Accepted behavior |
| --- | --- |
| 1 · Plan and approve | Select one stop in **Single** mode or build a multi-stop itinerary of up to four in **Multiple** mode. Add documented sites or a valid custom map point, change activity duration, and set priorities. Compare the astronaut's order against optimized directed routes and a feasible subset when available. Review terrain, travel and activity schedule, resource margins, and outdoor contingency stops before locking the baseline. |
| 2 · Execute and replan | Move partway along an approved leg or complete a stop. Track simulated position, elapsed time, resource usage, and completed visits. A recorded event pauses movement and recomputes the remaining itinerary from the current cell. Inspect the proposal against the previous remaining plan, then approve, hold, or choose a supported direct abort route. |
| 3 · Continue, return, and archive | Repeat the event and review loop as needed. Completed stops and traveled legs remain in history. The mission completes when the simulated astronaut reaches the scenario landing site. Export JSON for geometry, event inputs and decisions, Markdown for a readable report, or print the displayed plan. **Resume saved mission** recovers the latest state for this browser and terrain bundle. |

### Planning rules

- Use the configured scenario budgets of **180 min, 540 L O₂, and 900 Wh**, with reserves of **20 min, 90 L, and 150 Wh**. Normal approval requires all three margins to be nonnegative at **0.8×, 1.0×, and 1.2×**. The default activity duration is 20 min. [Scenario configuration](../src/config/mission-scenario.json)
- The planner checks permutations of the selected stops, including the return leg. Within a feasibility rank, it prefers the shorter modeled travel time. The gentler-terrain option applies a slope penalty to path selection. If deferrals are needed, the astronaut's listed priorities determine which stops to retain first. A replan can propose shorter activities before dropping a prioritized stop. [Planner](../src/engine/multi-leg-planner.ts)
- The graph uses directed, grade-weighted movement on the 20 m local analysis grid. NoData blocks routing and may leave a route verdict unknown. The model blocks edges above the configured 25° threshold. A contingency waypoint requires a local slope below 4° and enough modeled resources to return at the conservative pace. [Terrain routing](../src/engine/traverse-graph.ts) · [Waypoint criteria](../src/engine/multi-leg-planner.ts)
- The landing site, mobility model, consumables, and events are scenario assumptions. Environment fields report the limits of available data. Local weather, radiation forecasts, physical shelters, boulder-scale hazard detection, and live suit or instrument telemetry are outside this release. Use **research prototype** in the pitch and project description.

### Event inputs and effects

Each event records a simulated timestamp, location, input channel, category, and applicable measurements or field note. The channels are manual field input, simulated suit sensor, and simulated mission instrument.

| Category | Effect |
| --- | --- |
| Mission delay | Adds elapsed time and stationary resource consumption. |
| Resource loss | Subtracts the recorded oxygen and/or battery use from the available supply. |
| New terrain hazard | Adds a map exclusion zone and evaluates detours. |
| Terrain or conditions changed | Reduces the pace used to predict the remaining traverse. |
| Destination inaccessible | Excludes the chosen upcoming stop from the proposal. |
| New scientific discovery | Evaluates a user-entered map point and activity within the remaining stop capacity and resource reserves. |

Normal revision approval uses the same reserve rule as the baseline. During review or hold, a supported direct abort route remains available and flags reserve risk when relevant. If the graph has no supported return path, the abort action is unavailable. Hold position and record the unresolved route. [Execution state and event handling](../src/engine/lifecycle-store.ts)

## 2. Rehearse the judge story

On a machine with Node 22 or newer, pnpm and Python 3 installed, run the following from the repository root. Use a second terminal for the static server if needed.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start:export
```

Open `http://127.0.0.1:4173/`.

1. Add **Shuyak · Cape Nukshak**, **Hazeltop · Wildcat Ridge**, and **Swift Run · Skinner Ridge**. Switch to **Orbital**. Show the sequence, modeled arrival times, and return reserves.
2. Choose **Approve & lock baseline plan**, then **Complete next stop**. Shuyak appears as completed.
3. Under **Record an event**, choose **Destination inaccessible**, select **Hazeltop · Wildcat Ridge**, and choose **Record event & recalculate**. Show Shuyak in history, Hazeltop deferred, and the proposed route to Swift Run and base.
4. Choose **Approve revision & continue**, **Complete next stop**, then **Return to Landing Site**. The tested run returns at **T+01:31** after visits to Shuyak and Swift Run.
5. Download the JSON archive and show the retained baseline, event, and approval.

[Planning screenshot](../screenshots/seshat-jezero-planning.png) · [Replan screenshot](../screenshots/seshat-jezero-replan.png)

## 3. Resource audit and downloads

All five links were inspected on the [challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources).

| Resource | Download path and role |
| --- | --- |
| [NASA/JPL Mars Trek](https://trek.nasa.gov/mars/) | In the layers sidebar, search **Jezero**. Select **MRO CTX, Jezero DEM, Controlled** or **MRO CTX, Jezero Mosaic, Controlled**, then **Download**. The DEM drives routing, grade, and relief. The 6 m CTX mosaic provides an aligned orbital basemap. [DEM GeoTIFF](https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0) · [Orbital GeoTIFF](https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0) |
| [USGS–NASA Planetary Geologic Mapping Program](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | **List View → Jezero → USGS SIM 3464**. The report supplies regional unit context at 1:75,000. The full GIS database is about 333 MB. Use the report or a cropped/reprojected unit layer if needed. [Report](https://doi.org/10.3133/sim3464) · [GIS download directory](https://pubs.usgs.gov/sim/3464/) |
| [Curiosity’s proposed path up Mount Sharp](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | **Downloads → Original** gives a 2.86 MB GIF. The annotated route is a presentation reference from Gale crater. |
| [NASA Worldview](https://worldview.earthdata.nasa.gov/) | **Data** passes supported Earth layers to Earthdata Search. **Take a snapshot** exports a view. The linked product serves Earth imagery and events. |
| [Perseverance Raw Images](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Filter by sol and camera. Open a result for instrument, time, credit and the **Download** link. The app uses the related NASA-published WATSON abrasion images for Skinner and Wildcat Ridge, and Hazcam context for Enchanted Lake. [WATSON image pair](https://science.nasa.gov/resource/two-abrasion-patches-from-perseverance-at-jezero-delta/) · [Hazcam context](https://science.nasa.gov/resource/enchanted-view-of-jezero-rocks/) |

The original USGS DEM and the Mars Trek download have different file hashes. Raster inspection found identical CRS, affine, shape, NoData mask and values for all 2,413,152 cells. The USGS file retained by the acquisition pipeline is the same CTX terrain product. The app also directly consumes Mars Trek's orthomosaic. These are material uses of a listed resource. Final award eligibility remains an organizer decision. [USGS CTX DTM catalog](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic) · [NASA Global Organizing Team guidance](https://github.com/nasa/spaceapps/discussions/1827)

The CTX file is 1,596 × 1,512, equirectangular with a 3,396,190 m Mars sphere. The analysis crop is 220 × 220 in local Mars azimuthal equidistant coordinates, with 45,771 usable cells and 2,629 NoData cells. The matched optical layer covers the complete output grid. The original proposed crop at 18.448°N, 77.445°E put Swift Run on NoData and the other two sites out of bounds.

| Sample-site anchor | Source-reported latitude and east longitude | Nominal travel round trip |
| --- | --- | --- |
| Swift Run · Skinner Ridge | 18.458931°, 77.40617078° | 33.93 min |
| Hazeltop · Wildcat Ridge | 18.45863707°, 77.40588851° | 33.19 min |
| Shuyak · Cape Nukshak | 18.45068954°, 77.40143171° | 37.60 min |

The points come from the Mars 2020 sample dossiers, chapters 11, 14 and 16. Hawksbill Gap is the broader region for Swift Run and Hazeltop. The UI labels the locations as source-reported pending independent review. The current bundle keeps the team's `SOURCE_REVIEW_REQUIRED` status. [PDS sample dossiers](https://pds-geosciences.wustl.edu/missions/mars2020/returned_sample_science.htm) · [NASA sample catalog](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/)

### Reproduce the terrain, imagery and reachability check

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

## 4. Verification and submission

The local release report records **27 Python and security checks, 37 engine tests, and 5 browser tests passing**. Lint, TypeScript, and the Next.js static export passed. The rehearsal completed with external network requests blocked. The branch includes the compiled terrain and aligned imagery, so the offline rehearsal can run from a copy of `out/` using a local HTTP server. [Release verification](VERIFICATION_RELEASE.md) · [Checkpoint](CHECKPOINT_REPORT.md)

| Gate | Owner | Close it with |
| --- | --- | --- |
| Organizer start and eligibility evidence | Shams / Kamel | Archive the written Cairo start time, its applicable approval, the challenge Resources capture, and the local submission instructions. Record the pitch slot and format when confirmed. |
| Independent science review | Amr / Malak | Review the planetary frame, datum, coverage, published sample coordinates, image captions and attribution. Record the reviewers and evidence. The current bundle remains `SOURCE_REVIEW_REQUIRED`. |
| Hosted delivery and backup | Kamel / Ali, with Hams on QA | Check the public app, demo and project links from a signed-out browser. Run the selected scenario on the deployed build. Rehearse the local export on the backup laptop. |
| English demo and project copy | Shams / Ali | Prepare one official demo link. The working default is a five-slide deck covering the mission question, data, baseline, event and revision, and return with limitations. Cairo's FAQ permits up to seven slides or a video up to 30 seconds with English subtitles. Include the exact data credits and AI disclosure. |
| Submission | Kamel / Shams | Submit through both portals, verify that each submission is recorded, and save both receipts and timestamps. |

### Saturday handoff

These are internal targets in Cairo time. The team-confirmed local cutoff is **1:00 p.m.**.

| By | Action |
| --- | --- |
| 9:00 a.m. | Confirm both submission routes and check the global Project tab. |
| 10:30 a.m. | Finish the independent science review, public smoke test, and offline rehearsal. |
| 11:30 a.m. | Freeze the submission links, English demo, credits, and AI disclosure. |
| 12:15 p.m. | Submit through both portals and capture receipts. |
| 1:00 p.m. | Local submission closes. |

If the hosted app fails, use the local export for the live rehearsal and keep fixing the required public link. If a science review item remains open, keep its source-reported or provisional label and limit the claim in the demo. If an upload fails, record the error and use the remaining time to retry through the affected portal. [Cairo FAQs](https://spaceappscairo.com/faqs) · [Global submission window](https://www.spaceappschallenge.org/2026/)
