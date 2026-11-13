# SESHAT final master execution plan

**Edition 2.3 · 14 November 2026 · SESHAT Explorers**

**Challenge:** Interplanetary Survival Guide: Martian Map

**Build baseline:** `main` at `d98faf4` · [Public baseline build](https://seshat-jezero.vercel.app/)

This is the solo execution plan for the Cairo submission. The [event ledger](event-brief.md) records organizer evidence and the [release report](VERIFICATION_RELEASE.md) records software checks.

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

### Downloaded environmental and geologic context

The following source files are cached in the local, ignored `data/raw` directory. The release at `d98faf4` uses CTX terrain, CTX imagery and rover evidence. The downloaded context below still needs integration and validation before any of it appears in the app or archive.

| Download and local filename | Processing and use |
| --- | --- |
| [Jezero Thermal Inertia Map V1](https://zenodo.org/records/4931348) · [GeoTIFF](https://zenodo.org/api/records/4931348/files/Jezero_Thermal_Inertia_v1.tiff/content) · `Jezero_Thermal_Inertia_v1.tiff` | Map physical thermal inertia at its native 100 m resolution. A 20 m map overlay would be a display resampling. Retain NoData, units, and the Edwards and Buz credit. The layer describes surface thermal properties. |
| [Stack et al. 2020 photogeologic map](https://doi.org/10.1007/s11214-020-00739-x) · [GIS supplement](https://static-content.springer.com/esm/art%3A10.1007%2Fs11214-020-00739-x/MediaObjects/11214_2020_739_MOESM3_ESM.zip) · `jezero-photogeology.zip` | Clip to western fan, reproject to the local Mars grid, and use unit labels as site context. Flag conflicting overlaps and uncovered cells as unknown. Record attribution and changes per the [publisher's license correction](https://link.springer.com/article/10.1007/s11214-025-01204-3). |
| [NASA PDS Mars 2020 MEDA](https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/) · `meda/` | Use the PS pressure CSVs and matching labels for sols 490, 509 and 575. Keep the observation sol, valid record count and Pa units. Pressure is historical rover context. The downloaded TIRS records require independent quality review before display. |

Use the downloads to produce a local static bundle with source hashes. The browser can then render the mission offline. The USGS SIM 3464 GIS archive remains available for regional background. A live ArcGIS query adds network dependence and the reviewed service lists a viewing-only constraint. The direct downloads cover the planned area without scraping.

The CTX file is 1,596 × 1,512, equirectangular with a 3,396,190 m Mars sphere. The analysis crop is 220 × 220 in local Mars azimuthal equidistant coordinates, with 45,771 usable cells and 2,629 NoData cells. The matched optical layer covers the complete output grid. The original proposed crop at 18.448°N, 77.445°E put Swift Run on NoData and the other two sites out of bounds.

| Sample-site anchor | Source-reported latitude and east longitude | Nominal travel round trip |
| --- | --- | --- |
| Swift Run · Skinner Ridge | 18.458931°, 77.40617078° | 33.93 min |
| Hazeltop · Wildcat Ridge | 18.45863707°, 77.40588851° | 33.19 min |
| Shuyak · Cape Nukshak | 18.45068954°, 77.40143171° | 37.60 min |

The points come from the Mars 2020 sample dossiers, chapters 11, 14 and 16. Hawksbill Gap is the broader region for Swift Run and Hazeltop. The UI labels the locations as source-reported pending independent review. The current bundle keeps its `SOURCE_REVIEW_REQUIRED` status. The complete 232-page PDF is cached as `data/raw/mars2020-initial-reports-vol2-release2.pdf` with SHA-256 `7a9ed0e1ea15eb3ffa61c5c52082e42da0e884a2d1a11e92795f5265535c6469`. [PDS sample dossier PDF](https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf) · [NASA sample catalog](https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/)

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

## 4. Release status and solo submission sequence

The local release report records **27 Python and security checks, 37 engine tests, and 5 browser tests passing**. Lint, TypeScript, and the Next.js static export passed. The automated rehearsal completed with external network requests blocked. The browser rehearsal also finished at T+01:31 after deferring Hazeltop. [Release verification](VERIFICATION_RELEASE.md) · [GitHub CI for `d98faf4`](https://github.com/KamelAhmed01/SESHAT/actions/runs/43526772353)

1. **Preserve the working build.** Keep `out/` as an offline copy and rehearse §2. Keep the evidence status `SOURCE_REVIEW_REQUIRED` until the planetary frame, datum, coverage, coordinates, credits, and challenge-source evidence receive a documented review.
2. **Deploy and check public access.** The tested baseline is deployed on Vercel. A signed-out browser completed §2, resumed from local storage, and downloaded an archive with Shuyak and Swift Run completed, along with the recorded Hazeltop event. The live HTML and terrain manifest matched the tested export byte for byte. The configured security headers were present. Use the public Vercel URL for judging while `seshat.kmls.dev` returns HTTP 525. [Public baseline](https://seshat-jezero.vercel.app/) · [Response header checks](SECURITY_AND_DEPLOYMENT.md)
3. **Finish the English demo.** The five-slide outline is mission question, real data and assumptions, baseline, event and review, and return with archive. The Cairo FAQ accepts up to seven English slides or a video up to 30 seconds with English subtitles. Host the demo where judges can open it without signing in. [Cairo FAQs](https://spaceappscairo.com/faqs)
4. **Prepare the Project tab.** Enter project name, short summary, public demo URL, public final project URL, full description, NASA data, other data, and AI use. Cite the shipped CTX and PDS assets from §3. Describe the AI-assisted engineering work and the deterministic runtime. [Global submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
5. **Capture organizer and submission evidence.** Confirm the local form and pitch format. Archive the written Friday start authorization, challenge Resources capture, and the applicable organizer instructions. Submit through the Cairo form and the global team Project tab. Capture both receipts and timestamps.

### Saturday checkpoints

These are internal targets in Cairo time. The team-confirmed local cutoff is **1:00 p.m.**.

| By | Action |
| --- | --- |
| 9:00 a.m. | Confirm both submission routes and check the global Project tab. |
| 10:30 a.m. | Finish the public smoke test and offline rehearsal. Record the science review evidence available at that time. |
| 11:30 a.m. | Freeze the submission links, English demo, credits, and AI disclosure. |
| 12:15 p.m. | Submit through both portals and capture receipts. |
| 1:00 p.m. | Local submission closes. |

If the hosted app fails, use the local export for the live rehearsal and keep fixing the required public link. If a science review item remains open, keep its source-reported or provisional label and limit the claim in the demo. If an upload fails, record the error and use the remaining time to retry through the affected portal. [Cairo FAQs](https://spaceappscairo.com/faqs) · [Global submission window](https://www.spaceappschallenge.org/2026/)

## 5. Full story audit and implementation plan

The public baseline demonstrates planning, event-driven revision, and return. The product changes below are planned on `codex/mission-story-audit`. Two operator views share one persistent Jezero map. **Plan** covers pre-departure. **Execute** contains movement, work at a stop, event review, revised-plan approval, and return. Repeating that sequence fulfills the continuous adaptation phase.

**Decisions confirmed:** one persistent map, a separate arrival and science activity, simulated detection before astronaut recording, and preservation of partial science work when an event interrupts it. Environmental context uses sourced historical data and explicit unavailable states. The release keeps the scenario budgets and mandatory reserves fixed. Astronauts can edit stops, priorities, activity durations and route preference. Normal baseline and revision approval retain all three reserve checks at all three speeds. The public rehearsal keeps the inaccessible-stop event after the first completed visit.

| Story requirement | What was observed in the current build | What closes the gap |
| --- | --- | --- |
| 1.1–1.2 · Landing and stop selection | Fixed hypothetical base, historical landing marker, one to four stops, documented sites, grid selection, editable duration and priorities. The initial mission map hides the three documented site pins. Adjacent stations overlap when selected. The map initially draws the whole 4.4 km window while the tested route is concentrated near base. | Show named site pins and a matching stop list before selection. Inspect a pin before adding it. Fit the draft route in the viewport, preserve manual map zoom, and group nearby markers at low zoom. Show consequences before switching a multi-stop draft to single mode. Keep coordinate entry available for keyboard use. |
| 1.3 · Prediction and evidence | Directed routes, peak and mean slope, ascent and descent, steep-edge counts, NoData constraints and calculated contingency waypoints. CTX imagery and rover evidence are included. Archives contain scenario text for weather-related limits. | Add a layer and route-leg/site inspector for grade and coverage. Label degraded coverage and steep segments, including the 20 m resolution. Add cited bedrock and thermal context and historical MEDA pressure with units and observation sol. Return explicit unavailable states for roughness where unmeasured, local weather, illumination and radiation. Describe contingency stops as modeled outdoor waypoints. |
| 1.4–1.5 · Alternatives, constraints, preview | Compares stop orders, uses all three reserves at three speeds, shows a lower-slope option for one stop, and can propose a feasible subset. The planner compares orders over one path per directed pair for the chosen routing objective. It does not exhaust paths that trade time against oxygen or battery. The approval button appears before the evidence that governs approval. | Compare fast and lower-slope candidates under the same resource constraints for both mission types. Explain whether each displayed option meets the modeled reserve and name the limiting resource and pace. Keep stop-by-stop travel, arrival, science time, departure, and return together. Expose where the search is limited to evaluated paths. |
| 1.6 · Approved baseline | The app locks and starts the baseline in one click. JSON includes route geometry and data provenance. Markdown includes schedule and reserve tables, site evidence and contingency stops. It infers mission mode from stop count, which can disagree with the user's selected mode. | Show the final itinerary and binding reserve beside the approval. Lock and export the approved baseline before the explicit **Start traverse** action. Preserve selected mission configuration, priority policy, accepted alternatives and caveats in the exported baseline. Keep a baseline export available through execution. |
| 2.1 · Navigation and exploration | Position, traveled path, elapsed time, spending and completed visits update. The comparison uses the latest completed stop or return, and **Complete next stop** combines arrival with the full planned activity. | Separate **Move → Arrive → Explore → Complete stop**. Track actual simulated activity time and observations at each stop. Show the approved estimate and simulated actual for the same leg or stop. Keep completed traversal and science records immutable in later revisions. If an event interrupts exploration, preserve the observations, time and supplies already spent. A proposed revision can finish the remaining work or leave the stop with partial science recorded. |
| 2.2–2.3 · Detect and record | All six event categories produced a pending review in Chromium. The three input channels are labels for manually submitted forms. There is no incoming telemetry or detection stage. Hazard and discovery placement outside the current cell requires pointing at the map. | Receive a deterministic simulated reading at a named route or activity milestone. Show measured value, threshold or trigger, source, event time and place. Let the astronaut review and record it. Keep a separate manual observation form and a keyboard location option. Store the astronaut's location and the observation location where they differ. |
| 2.4–2.5 · Replan, inspect, decide | Replans from current position, preserves completed stops, handles all six event categories and blocks movement during review. Hold and direct abort work. Review can highlight the previous next stop even when the revision defers it. It shows nominal deltas by default, while approval is governed by all three speeds. | Replace execution controls with a prominent pause and review. Keep the map in place and show traveled, previous, proposed, hazard and exit routes with distinct encodings. Show why each stop or leg changes, absolute remaining reserves and deltas, and the conservative binding constraint. Hold pauses progression and keeps the proposal available for renewed review. Keep direct return visible during execution, with explicit reserve risk or unavailable route feedback. |
| 3 · Continue and archive | Approval, reload, resume, completion and downloaded JSON passed in a signed-out production browser. Hold followed by direct return was rehearsed locally. Engine tests cover repeated event effects. | Exercise a two-event browser scenario across movement and exploration, including a held revision and explicit return, then verify original and revised schedules, partial work, decisions, return outcome and exported data. Browser reload should preserve intermediate review and exploration states as well as approved execution. |

### Operator layout

- **Always visible.** The map is the primary workspace. A slim header shows Jezero, mission phase and Sources. The map carries a scale, leg/stop labels, astronaut position, and a compact legend for the displayed layers. The same map position persists during event logging and review. On mobile, a reachable panel holds the current action without pushing the map and decision several screens apart.
- **Plan panel.** Start with **Choose a science site**. Inspect a brief site finding, optionally open its image and citation, then add the stop. The itinerary shows priority, editable activity and predicted arrival. An adjacent reserve summary shows time, oxygen and energy after return at 0.8×, with the 1.0× and 1.2× comparisons available. Place **Approve baseline** next to the feasibility result. Keep route-choice evidence near the decision.
- **Execute panel.** Show current leg or activity, upcoming waypoint, simulated actual versus approved estimate, and direct return. The next action is **Move**, **Arrive**, **Explore**, or **Complete stop** as appropriate. Surface an incoming simulated reading as an event card. A manual event is a deliberate action with a labeled form.
- **Review and return.** Promote the detected or logged event and the astronaut's current position. Show what changes, why, and the expected impact on return time and all reserves. The active decision is **Approve revision**, **Hold**, or **Return directly**. On reaching base, show time and reserve outcomes, completed and deferred work, and the archive downloads.
- **Remove metric clutter.** Retire the fictional operator profile, notification dot, duplicated provenance controls, inert navigation, independent camera tile, time-only index and duplicate doughnuts. Open imagery and route profiles in the context of a selected site or leg. Give actual use and projected total different labels.

Mobbin references were inspected as public screens. AllTrails keeps the route clear over satellite imagery. Placify puts the route and numbered stops with a compact summary. Citizen keeps the map visible while surfacing a selected incident in a detail panel. These interaction patterns inform placement and hierarchy. SESHAT uses its own terrain, imagery, symbols and terminology. [AllTrails Trail Map](https://mobbin.com/explore/screens/2caef3e5-b046-4244-a10b-24bd8d82ab7e) · [Placify Route Generated](https://mobbin.com/explore/screens/7dd6540b-dda7-482c-8d6c-25cfd0c233e3) · [Citizen Incident Overview Map](https://mobbin.com/explore/screens/08f999aa-03ee-42fd-a21b-385029dc419f)

### Browser design findings

The two independent reviews used the static export on desktop and mobile. The design review scored 20/40 across the Nielsen heuristics. The main failures affect the first-time planner, the astronaut responding to an event, and keyboard navigation.

| Priority | Evidence | Release acceptance |
| --- | --- | --- |
| High · Planning approval | At 1440×900, the baseline approval appeared near y404, while feasibility appeared near y939 after three stops. All three catalog labels truncated. | Show the full stop names, next step and conservative reserve beside the approval. |
| High · Contradictory review | Following the Hazeltop event, the execution panel still listed Hazeltop as the next waypoint. The review used 1× deltas without a pace label. | Show paused execution, deferred Hazeltop, proposed Swift Run and the three reserve checks. Distinguish the effect of the event from the benefit of the revised itinerary. |
| High · Mobile layout | At 390 px, site selection and approval required scrolling in opposite directions. At 320 px, Expand map was clipped even though the document had no horizontal overflow. | Keep the primary action and current information reachable at both widths, with the entire active route visible when fitted. |
| High · Keyboard and focus | Baseline approval and event submission dropped focus to the document body. Hazard and discovery positions could be changed through a mouse action only. | Focus the active view on transition, give the map controls accessible names, and provide keyboard location entry for both event types. |
| High · Optional asset failure | A 404 on the optional orbital image replaced the usable terrain planner with an error. One throttled local Chromium run took 16.16 s to show the planning heading. | Keep CTX terrain and routing usable when an optional layer fails. Measure cold startup on the static export after deferring optional imagery and display assets. |

The detector marked 31 element groups in the desktop planner, predominantly small text and nested panels. Its source-only Inter warning did not describe the rendered headings, which used the macOS system fallback. The independent reviews agree that the cartographic imagery and approval model are the product's strongest elements. The issues to fix are hierarchy, honest metric labels, and keyboard and mobile operation.

### Build order and acceptance tests

1. **Build the persistent map and reorganize the existing flow.** Implement §6 as an independently reviewable slice. Put route, reserve and primary action together, then make review a distinct state inside the same map workspace. Check at 1440×900, 1280×720, 390 px and 320 px. A keyboard-only user must be able to add a point, place an event and approve or hold with focus in the active view.
2. **Complete planning evidence and alternatives.** Compile the downloaded geologic and environmental products to the existing grid, document source hashes and unknowns, and make those layers optional in the loader. A missing context layer must leave routing usable. Verify a single stop, four-stop ordering, NoData, a constrained subset, and displayed route tradeoffs against independent reserve values. Export the approved baseline with its scenario and sources.
3. **Complete the execution state and simulated detection.** Treat travel and science progress as separate, persist a pending reading across reload, and apply its effect once when recorded. Keep previous and proposed plan inputs tied to the same mission position. Exercise all six event categories and both simulated channels, plus manual logging. Run an inaccessible-target rehearsal and a second event during exploration.
4. **Integrate remaining opportunity and return conditions.** Use current position, route direction, pace, hazards, actual time/O₂/Wh, and return reserves. Compare before and after from the same position. Show which terrain cells remain reachable with a return and which named stops still fit their science time. Keep unsupported coverage explicit. Verify that adding a delay cannot restore a previously lost opportunity under the same routes and conditions.
5. **Gate production on a fresh-browser run.** Test both approved revision and direct return, plus a deliberately blocked landing route. Confirm real and simulated data labels. Review hosted keyboard and mobile behavior, confirm archive contents, and repeat with outbound internet blocked locally. The current public build remains usable for rehearsal while these changes are developed.

For the interrupted-science case, arrive at Shuyak, record an observation and a portion of fieldwork, then introduce a simulated resource reading. Reload with that reading pending. Record it once and verify that review starts at Shuyak, retains the partial observation and consumed supplies, and evaluates only unfinished activity. Exercise both finishing that stop and leaving it with partial work recorded. Return and verify both histories in the export.

### Release boundary

Keep the rehearsed inaccessible-stop path for judging. The full-story build earns promotion when one run demonstrates the new phase layout, a recorded simulated reading, an event during an active science stop, a reviewed revision, and return with a valid archive. Close the separate demo and submission requirements in §4 before the 12:15 p.m. delivery target. Any remaining integration work must be described as planned in the submission.

## 6. Seamless Mars map

The current mission view loads one image over the 220 × 220-cell, 20 m routing grid. Its pan bounds are tied to that 4.4 × 4.4 km image. The downloaded controlled Jezero CTX orthomosaic covers a much wider footprint, approximately 77.160–77.699°E and 18.211–18.721°N. These are raster extent bounds. The actual image mask determines coverage. [Current viewer](../src/components/cartography/LeafletGrid.tsx) · [Analysis geometry](../public/data/grid.meta.json)

### What the astronaut sees

Start centered on the western fan with the landing site, the three documented sites, and the outline of the modeled area. Pan, scroll or pinch to move between the fan, the crater and wider Mars. Visible tiles load at the appropriate zoom. Leave the route, position, and progress on the same map when the panel changes from planning to execution or review. Provide **Back to Jezero**, **Fit mission**, a scale, a source credit, and a layer control for **Orbital** and **Terrain**. Add optional evidence overlays from §5 through the same control as they become available.

A site click opens an inspector before adding a stop. Inside covered modeled terrain, the inspector can add a custom point or select an event location. Outside the modeled area it shows coordinates and **Browse only · outside modeled terrain**. Inside the modeled boundary with NoData it shows **Terrain data unavailable**. Neither state adds a route stop or accepts a route-affecting event there. Panning, zooming, switching layers, and fitting the route never edit a draft. The requested zoom and center persist across mission states, with explicit fit actions for moving the viewport.

### Imagery, tiling and coordinate contracts

| Layer | Source and delivery | Scientific role |
| --- | --- | --- |
| Planet-wide color overview | NASA/JPL Mars Trek serves the USGS Viking MDIM 2.1 232 m source on a plate carrée WMTS pyramid. Bundle all 42 level 0–2 JPEGs as same-origin fallback. The probe returned 2,307,443 bytes total. Fetch only visible level 3–7 tiles from Mars Trek. Display the nearest available local parent imagery if an online tile fails. | Background imagery. The 232 m label describes the source product. WMTS level 7 samples at about 326 m/px at the equator. Attribution stays visible. [Mars Trek API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) · [Viking catalog](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) |
| Wider Jezero orbital imagery | Build a local level 8–13 WebP tile pyramid from `data/raw/trek-ctx-orthomosaic.tif`, the downloaded 6 m controlled raster. Tile only intersecting coverage, preserving transparent NoData. Use bounds plus a sparse tile index to avoid missing requests. Use parent imagery beyond available detail and a lower-resolution background beyond the regional footprint. | Browsing and visual context. Pixel coverage is independent of whether traversability is modeled. [Official regional WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml) |
| Mission overlays | Keep the current local CTX numeric bundle, aligned relief and mission vectors. Generate georeferenced display rasters and redraw mission routes, hazards, stops and frontiers at their georeferenced positions. Render boundary and NoData explicitly. | Only the existing Mars AEQD grid, its terrain mask and approved scenario are valid inputs to routing and reserve calculations. [Scientific manifest](../public/data/manifest.json) |

The NASA Viking tile template is `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{row}/{col}.jpg`. Verified levels are 0–7, with 256 px images, northwest origin 180°W/90°N and `2^(z+1)` columns by `2^z` rows. North is row zero. Normalize wrap at the antimeridian, clamp rows to the advertised extent, and treat the southern and eastern footprint edges consistently. A genuine fetch returned HTTP 200 for Viking `6/25/91` and `6/25/92`, and for Jezero `12/1628/5857` and `12/1628/5858`. The tiles responded with the expected image types and `Access-Control-Allow-Origin: *`. [Viking WMTS capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml)

Use one Leaflet Mars geographic display for the real workbench, with a plate carrée transformation matching that tile matrix. The map uses planetocentric latitude and positive-east longitude on the 3,396,190 m Mars sphere. Override Earth distance behavior and derive the scale with the Mars radius. Keep the existing local grid viewer for synthetic data. Transform mission-grid pixel centers through the manifest affine and Mars AEQD before placing them in the geographic display. For clicks, invert the transform, check the exact grid bounds, then check the mask. Derive the entire coverage outline this way. Reproject raster pixels into the geographic display during asset compilation or with a tested per-pixel mapping. A rectangular extent alone cannot align the AEQD raster. Leave routing inputs, directed costs, archive grid coordinates and projection metadata intact, and include the separate display metadata in the map provenance.

Record layer URLs, credit, native spacing, footprint, projection, source SHA and derivative manifest in the build outputs. Download and tile through reproducible pipeline commands with fixed source inputs and an atomic output. Keep raw files out of Git and `out/`. Load tiles on view without fetching a full raster at initial paint. Use versioned cacheable paths and same-origin regional assets. For remote imagery, scope the CSP image allowlist to `https://trek.nasa.gov`. The mission, wider Jezero and a low-resolution Mars overview must remain usable with outbound requests blocked. A failed optional layer must never make the scientific bundle unavailable.

### Acceptance before review

1. From the starting view, drag beyond the former 4.4 km boundary, cross a regional tile seam, zoom out to Mars, pan across the antimeridian and use **Back to Jezero** and **Fit mission**. Verify at least two distinct adjacent tiles render and inspect their visual alignment. Confirm credit, units, visible detail and the browse-only state.
2. Compare mission-grid corners, center, three catalog sites and representative random cells with an independent pyproj oracle. Keep coordinate error below 1 m and preserve cell identity at tested centers. Exercise east/west sign, masked cells and both boundary conventions. Verify plotted leg endpoints and clicks select the same cells as the current route engine. Keep the existing numerical route parity tests passing.
3. At 1440×900, 1280×720, 390 px and 320 px, test mouse, keyboard and touch equivalents. Confirm no clipped controls, map actions leave the itinerary untouched, and the viewport persists when switching phases, reviewing a revision and toggling an overlay. Capture real planning and review screenshots.
4. Block `trek.nasa.gov` and fail one optional layer. Navigate wider Jezero and the bundled low-zoom Mars overview, then complete the core three-stop rehearsal through return and export. Verify no corrupted tiles, remote secrets, or outside-coverage routes. Record cold initial transfer and the size of the offline package.
5. For this release, treat displayed Mars coverage and routable coverage as two distinct things. Expanding the route graph requires a separate terrain-ingestion and validation change. Use the checked 20 m Jezero bundle for every approval and return calculation covered by this plan.
