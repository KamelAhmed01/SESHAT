# SESHAT
## Mars surface science, under a changing clock

**Master execution book · NASA Space Apps Cairo 2026**  
**Team:** SESHAT Explorers · Kamel · Ali · Hams · Amr · Shams · Malak  
**Challenge:** Interplanetary Survival Guide: Martian Map  
**Planning baseline:** 48-hour authorized sprint, using event-relative gates  
**Document edition:** v1.2 · 13 November 2026 · execution-rehearsed, decision-locked specification

> **Our product promise**  
> SESHAT helps a surface-science mission planner see which documented Martian scientific opportunities remain reachable *and returnable* as terrain, activity time, return reserve, and remaining mission time interact. A simulated delay changes the geography of opportunity. Every change can be explained, inspected, and traced to data or to a clearly named planning assumption.

**Research prototype, not flight software.** SESHAT does not certify safe routes, predict astronaut survival, perform live EVA operations, or claim to have a validated Mars-suited walking model. Its value is a rigorous, understandable **planning and trade-off demonstration**.

---

## Reader's map

This book is written for **six teammates and the coding assistants they supervise**. It is not an idea proposal or a comparison of alternative plans. It is the common implementation contract and execution schedule.

| Read this | If you need to know |
|---|---|
| §§ 1–3 | Why the project matters, eligibility constraints, and what the finished product must prove |
| §§ 4–7 | Science scenario, real data, geospatial pipeline, and mathematical decision model |
| §§ 8–10 | Feature set, application architecture, and detailed interaction/design rules |
| §§ 11–13 | Repository contracts, AI-assisted engineering procedure, and team operating model |
| §§ 14–17 | The event-relative build sequence, testing, submission, and judge presentation |
| §§ 18–20 | Failure handling, definition of done, and sources with evidence status |
| Appendices A–F | Model oracle, H0 work queue, release packet, evidence handoff, runnable reference contracts, and failure-injection rehearsal |

**Operating status.** This is an implementation plan, not a claim that the team has already built the app or that project tests have passed. Published source metadata and official library documentation have been checked; final raster contents, field-generated coordinates, venue approval, installed-version commands and production performance require real H0 evidence. Appendix F rehearses likely failures; Appendix E gives implementation contracts and commands.

**Working conventions.** `H0` means the **documented, organizer-authorized** beginning of SESHAT implementation, not an assumed Friday morning. `H+12` means 12 elapsed hours after that moment. `P0` is an indispensable competition feature, `P1` is an expected premium feature, and `P2` is a conditional enhancement. A feature is *shipped* only if its inputs, behavior, error handling, and visual treatment have passed their acceptance tests. 

Information is labeled **Verified**, **To verify at H0**, **Scenario assumption**, or **Contingency** where the distinction affects a consequential claim. Research sources are cited as `[R#]`, resolved in §20. Nothing labeled “To verify” may quietly become an asserted fact in code or presentation.

---

# 1. The decision we are building around

A standard Mars map answers *where things are*. A route finder answers *how to get there*. SESHAT answers a harder question:

> **With the time and return reserve we have left, which scientifically meaningful stops should we still attempt—and how does that decision change if we lose fifteen minutes or move more slowly than planned?**

That difference must be visible without an explanatory monologue.

### The product in one judge journey

1. **Observe.** The application opens directly into a layered map of a bounded region of **Jezero crater's western delta**. The map, its sources, and its valid-data extent are evident.
2. **Choose a science objective.** Documented targets relevant to the objective appear with clear evidence and location confidence.
3. **Inspect a traverse.** Select a target; see a realistic modeled outbound route, a separate return calculation, on-site activity, reserved time, and remaining margin.
4. **Understand robustness.** Reassess the result at `0.8×`, `1.0×`, and `1.2×` movement-speed assumptions. A target becomes **ROBUST**, **MARGINAL**, **INFEASIBLE**, or **UNKNOWN** for transparent reasons.
5. **Disturb the plan.** Press **+15 min delay**. A terrain-bounded **round-trip opportunity frontier** contracts and at least one documented target changes decision state in the *declared demonstration scenario*.
6. **Explain the difference.** The **Why changed** explanation reconciles its numbers exactly. The planner can inspect the input dataset, source observation, resolution, and assumptions.
7. **Explore beyond the scripted demo.** A valid custom pin recomputes a hypothetical traverse. If validated, an optional Perseverance route overlay contextualizes rover exploration without claiming that rover and human traversability are identical.

**The memorable insight:** *Time has a geography.* Losing time does not merely shrink a counter; it changes where science is practically reachable under the stated model.

### Users and their actual work

**Primary user:** a *future Mars surface traverse/science-planning analyst*, considering a bounded EVA scenario before human operations. **Secondary:** a planetary scientist supplying scientific priorities and interpreting Mars observations. We do not claim to have interviewed astronauts or to know an operational crew's current requirements.

Their jobs are to compare opportunities, conserve planning reserves, recognize data limitations, understand a change of recommendation, and communicate a decision to teammates. NASA's APRES planning system combines activities, timelines, resource constraints, and decision support; NASA Open MCT similarly demonstrates the value of correlating mission information in one view [R10–R11]. Recent NASA human-factors studies of EVA displays support visible information hierarchy, contextual filtering, and manageable workload [R12]. These are **design analogies**, not evidence that SESHAT is an operational NASA tool.

### Award position

**Primary goal:** a plausible **Best Mission Concept**. **Supporting strengths:** distinctive **Best Use of Data** and scientifically defensible **Best Use of Science**. The exact global awards and judging instructions must be checked for 2026; the 2025 published descriptions establish these award lenses [R06–R07].

| Judging lens | Proof the judge can touch |
|---|---|
| Impact | An intelligible mission-planning decision and a demonstrable change when time is lost |
| Creativity | The time-dependent opportunity frontier plus an explanation of lost scientific options |
| Validity | Real NASA observation/terrain inputs, correctly handled geometry and NoData, tested math, bounded claims |
| Relevance | A multi-mission layered Martian surface view used for route, destination, and science planning |
| Presentation | A visually excellent single workflow, an accessible public link, and a concise defensible explanation |

**Competitive benchmark.** NASA's 2025 Best Mission Concept winner *PureFlow* was an interactive habitat systems-engineering tool that let users design, model, and test a space habitat under environmental stress. Its value was not merely displaying space information: it allowed a consequential, inspectable engineering decision. The 2025 Best Use of Data winner *Resonant Exoplanets* converted large mission datasets into a novel scientific workflow. These documented outcomes support our product principle, but they do **not** establish a secret scoring formula or likelihood of winning [R07].

---

# 2. Competition and compliance contract

## 2.1 The event clock is a hard prerequisite

There are three pieces of information that must be held simultaneously:

- **NASA global site:** 2026 challenge dates **14–15 November**. Project submission opens **14 November, 09:00** and closes **15 November, 23:59**, each in applicable local time [R01].
- **Cairo local website:** public registration materials describe the Cairo edition as **13–14 November**, a **48-hour** hackathon [R03].
- **NASA Global Organizing Team:** published November 2026 answers say that teams should not begin building projects before the default **Saturday, 14 November at 09:00 local time**; an earlier start can trigger disqualification. The 2026 legal terms expressly contemplate other local days **only if approved in writing by the Global Organizing Team** [R02, R04].

The team has been told that Cairo starts on Friday. **That does not itself resolve the official authorization conflict.** Also, “Friday–Saturday” and “48 consecutive hours” are not enough to compute an end time without specific start/end clocks.

**Gate C0 — Shams, before writing application code:** obtain the Cairo organizer's dated instruction (email, published event announcement, or written on-site confirmation) that names the authorized start and local judging/pitch deadline; if an earlier-than-global start is claimed, ask whether it was approved by the Global Organizing Team. Save the message/screenshot in `docs/event-evidence/` and record `H0`, `T_available`, local pitch cutoff, and global submission cutoff in `docs/event-brief.md`. If approval cannot be demonstrated, **do not rely on Friday as an authorized earlier coding start**. Escalate to the organizer and follow the latest authoritative written instruction. The team may research, read docs, and organize its members before H0; **do not create project implementation in advance** [R02, R04].

**Schedule rule:** §14 is a *48-hour capacity plan*. If the actual local build window is shorter, run the compression procedure in §14.9 instead of pretending there are 48 hours. The **earliest binding deadline wins**; submit before it, not at the last moment.

## 2.2 NASA-data eligibility is not generic “NASA imagery”

The 2026 Global Organizing Team has stated that global eligibility requires **at least one NASA data source provided within the selected challenge's Resources tab** [R05]. Therefore:

1. At H0, open the **official 2026 Martian Map challenge**, including **Resources**.
2. Capture the name and exact URL of at least one relevant *listed* NASA dataset/resource; integrate it materially into the product.
3. Record which user-facing layer or calculation consumes it. A decorative citation does not satisfy our quality bar.
4. Add other NASA/USGS/PDS sources as needed, and cite **all** data, code, images, fonts, and external tools in the submission.
5. If none of the planned Jezero sources appears on the official list, either incorporate a qualifying listed resource or revise the selected dataset plan **before claiming global eligibility**.

The challenge itself asks for a **layered, integrated view** of a Martian place or route, drawing on **multiple NASA science missions** to assist human surface exploration [R08]. A single photographic basemap with handcrafted science pins will not be adequate.

## 2.3 Licensing, openness, disclosure, and presentation

NASA's 2026 legal terms require that original submitted material be available without restriction or under an OSI-compliant license, that third-party material satisfy its relevant reuse conditions, and that resources be appropriately cited. They warn that failing to cite materials can affect eligibility and awards [R02].

**Repository:** use a **public GitHub repository by submission**, with an explicit **Apache-2.0** project license unless the team encounters incompatible component/data licenses. The repo can remain private while implementation is underway; make it public and verify in incognito well before submission. Do not commit unlicensed third-party media, enormous raw raster archives, credentials, or private information.

**AI:** record all coding/design/research assistance in `docs/ai-use.md`; distinguish AI-assisted implementation from the scientific input/model. The **2025** global judging guidance required AI declarations and visible watermarks on AI-generated imagery/video; the **2026 guide** must supersede it where applicable [R09]. Safer default: **do not use AI-generated imagery in the scientific map or submitted hero media**. If generated illustration is necessary, clearly label and watermark it as required and do not incorporate or modify protected NASA branding.

**Demo format:** 2025 judged submissions used **up to seven slides including title/end slides OR up to 30 seconds of video**, with unrestricted links [R09]. **This is a 2025 precedent, not yet proof of every 2026 field.** Shams reads the current submission form and guide when published. Build a **five-slide official demo candidate**, a separately recorded **≤30-second alternate**, and a **90-second live backup recording** that is *not* submitted as the official 30-second demo unless 2026 rules permit it.

**Do not show NASA's official logos in a way that implies sponsorship, affiliation, certification, or endorsement.** Cite NASA datasets and missions in plain text according to the applicable brand-use guidance.

## 2.4 Submission gates

| Gate | Evidence |
|---|---|
| C0 — authorized start | Organizer communication and exact H0 |
| C1 — challenge source | At least one **listed** challenge-Resources NASA input used materially |
| C2 — rights | Licenses and attributions recorded for every included material |
| C3 — truthful claims | Source-backed claims checked; assumptions and limitations visible |
| C4 — public delivery | Project URL, repository, and demo links open without sign-in |
| C5 — submitted | Official project page explicitly reports **Submitted**, with timestamp/screenshot |

---

# 3. The finished product: deliberate ambition

**Target quality:** a genuine research instrument: accurate science semantics, a readable layered map, a responsive decision model, editorial-grade typography, coherent interactions, and a reliable presentation. **Not** a minimum working prototype and **not** a feature dump.

### P0 — competition core (cannot be dropped)

| Product capability | Acceptance condition |
|---|---|
| A real bounded Jezero study area | At least one NASA Resources-qualified source; coherent mapped imagery/terrain and documented coordinate/coverage limits |
| Multiple missions' observations | MRO terrain/image data **and** actual Mars 2020/PDS surface positioning or recorded scientific observations materially drive visible geometry or evidence; not merely two MRO instruments or a text-only mission credit |
| Three documented science opportunities | Three source-backed narratives; route assessments only for point-verified targets with confirmed grid coverage; approximate regions remain visible science context but must not receive fictitious point-to-outcrop travel times |
| Geospatially credible map | Ortho/terrain raster and all overlays share a validated transform; provenance can be inspected |
| Round-trip traverse model | Distinct outbound/return paths/times where direction matters, site activity and return reserve, with unit-labeled assumptions |
| Time-aware frontier | Derived from actual route-cost field, not a circle or hardcoded animation |
| Three speed scenarios | `0.8× / 1.0× / 1.2×` with deterministic feasibility and four explicit states |
| +15 minute counterfactual | Reproducible and narratively meaningful state change; transparent scenario, no fabricated real-world numbers |
| Why changed | Explanation numerically equals the engine output; shows which constraint changed |
| Science/evidence inspection | Named datasets, resolution, dates, target evidence, confidence and limitations |
| Proof of implementation | Hand oracles, geospatial sanity checks, production build, live URL, local fallback, no invented test results |
| Judge experience | One clear end-to-end journey with no mandatory login, no broken UI, and a submission-ready story |

### P1 — premium finish (plan for these, not “nice to have”)

- **Custom location inspector:** choose a valid map point, compute a hypothetical route, and clearly distinguish it from a documented science target.
- **Elevation/grade profile:** a compact route-attached profile showing which terrain change matters; units and uncertainty clear.
- **Rover context overlay:** authentic Perseverance traverse or geolocated stops if a verified mission track aligns with the study area; interpret, **never** claim a rover path is a suited-crew path.
- **Progressive comparison:** compare a selected target with the next feasible alternative, focusing on margin, sensitivity, and scientific justification—not a leaderboard of invented “science scores”.
- **Good scientific cartography:** intentional line hierarchy, restrained masks, scale/orientation in the analysis frame, layer toggles, contrast-aware labels, and no false resolution.
- **Microinteraction craft:** meaningful frontier transition, stable layouts, keyboard access, empty/error/loading states, responsive presentation display.
- **Credible validation:** a small realistic task-based study with reported raw observations; no fake interviews or unsupported generalizations.
- **High-confidence offline judging:** identical demo data on two laptops and a short recorded fallback.

### P2 — admitted only after the core passes

- A second **verified** scientific objective and visibly different target ranking.
- A second **verified** rover/astronaut comparison path, with separate cost models clearly sourced; otherwise just show contextual rover geometry.
- A shareable mission-scenario permalink (serialized non-sensitive state; no backend), if it passes static/offline tests.
- A 2D small-multiple before/after comparison view for presentation screens, if more legible than animation.

**Not part of this competition build:** live astronaut telemetry, life-support physiological prediction, real-time weather hazard certification, end-to-end “crew safety probability”, a generative AI adviser choosing routes, invented mineral scores, global Mars coverage, a full 3D engine, arbitrary mission architecture, or multi-user accounts. These are not excluded for being “complex”; they are excluded because available time and evidence cannot validate them as responsible product claims.

**Priority principle:** invest in a finished, unusually coherent workflow and rich evidence. A feature that is present but unreliable or misleading **reduces** competitive quality.

---

# 4. The scientific scenario and target evidence

## 4.1 Study site and mission framing

**Study region:** a bounded common-overlap crop around the **Jezero western delta / fan**, subject to raster and target coverage verification. It offers a documented Mars 2020 scientific narrative, excellent terrain data candidates, and the chance to combine surface observations with orbital remote sensing [R13–R16].

**Scenario story:** A notional crew begins at a selected base point, has a remaining EVA clock and return reserve, and wants to study the geological history of Jezero's delta. The planner compares three opportunities. A delay occurs before departure (or at a stated point before target selection). SESHAT revises feasibility and displays what changed. **Do not mix pre-departure and mid-traverse semantics**; the hero demo uses **pre-departure elapsed mission time**. A mid-route replanner would need an explicitly updated current position and is out of scope unless separately implemented and tested.

The starting base is a **scenario-defined planning point**, not a claim that NASA intends to establish a human base at Perseverance's sample depot. Present its lat/lon, surface raster evidence, and status as a planning assumption.

## 4.2 Science target candidates—not invented pins

| Candidate | What makes it scientifically meaningful | Research reference | Still required at H0 |
|---|---|---|---|
| **Cape Nukshak** | A documented section of the western delta's Shenandoah formation and regional stratigraphy | NASA/planetary geology literature [R16] | Exact representative point, coordinate convention, raster coverage |
| **Hawksbill Gap** | Route/stratigraphic context near the delta; NASA documents its selection for Perseverance's climb rather than Cape Nukshak | NASA Science [R17] | Whether selected marker is route-region or pinpointed observation; avoid false outcrop specificity |
| **Wildcat Ridge** | Actual sampled outcrop, abrasion and rock cores documented by NASA | NASA/JPL [R18] | Sol/pose or map-feature coordinates and common raster overlap |
| **Skinner Ridge** *(source-backed alternate)* | NASA identifies a second Perseverance sampling location in the Jezero delta | NASA Science [R19] | Exact point, source imagery and coverage; useful if another candidate fails |

The names and geological context are source-backed. **The precise coordinates, elevations, slope angles, traverse times, and specific instrument-result associations are NOT yet verified here.** Never import coordinates or calculated times from planning examples as “NASA measurements.” No claim of organic-bearing rock at one target should be generalized into detected life or a verified biosignature.

A site name can cover an area. Our marker must represent either a demonstrably geolocated observation or a transparently labeled **approximate science region**. A rover pose near an outcrop is **not automatically the sample point**: record whether the geometry is a direct geolocated sample, a documented rover-pose proxy, or a regional centroid. If a proxy is used, the UI says **“Rover position near site; not an exact outcrop coordinate.”** Do not treat a regional name as a precise landing-coordinate truth.

### Target acceptance ladder

1. **Evidence:** direct NASA/PDS/peer-reviewed documentation identifies the site and what was studied; record the source and a concise claim.
2. **Geometry:** derive a rover pose, archived map feature, or a documented location from the **PDS Mars 2020 Rover PLACES** bundle / Analyst's Notebook where applicable [R15]. Retain the original reference frame and location source.
3. **Transform:** convert to the project's internal **Mars-local metric analysis grid**; never mix raw lat/lon with grid meters.
4. **Visual check:** marker overlays the relevant georeferenced orthoimage and a second reviewer confirms site-region plausibility.
5. **Coverage:** point and route lie within valid raster overlap; check distance to study boundary, NoData islands, and sampled elevation.
6. **Source precision:** store the original source's uncertainty/granularity. A published place name on a map does **not** imply sub-meter accuracy.
7. **Two-person sign-off:** Amr checks spatial handling; Malak checks science evidence (Hams assists if needed).
8. **Status:** `VERIFIED_POINT`, `APPROXIMATE_REGION`, or `USER_SELECTED`. Production UI prints the distinction.

If exact coordinates cannot be validated, choose a different documented science site with higher-quality geolocation inside the crop. **Do not compute a target-specific route, metric or ROBUST/MARGINAL class to an `APPROXIMATE_REGION`.** Show its science narrative and `LOCATION_UNVERIFIED` / `UNKNOWN` until an accepted coordinate exists. **Do not widen the crop or invent a coordinate merely to preserve a target name.** A scientifically documented but approximate target can appear as context, but it must not be presented as precision pathfinding to a verified rock sample.

## 4.3 A bounded model, not a mission safety simulator

The user may change: science objective, one of the known targets, EVA time budget, elapsed delay, reserve, and speed scenario. The evaluator calculates outcomes **only for verified inputs**; the map labels unsupported areas. If the team cannot prove the alignment or relevant target evidence, the product must fail *honestly*, not appear more confident than the data.

**Provenance is part of the user journey**, not an appendix hidden for judges. A single click should answer: “Which NASA mission? Which instrument? Which product? At what scale? How was it transformed? What does this layer actually support?”

---
# 5. Data provenance and geospatial compiler

The strength of the product begins before the UI. The compiler converts traceable, differently structured planetary observations into one **bounded, reproducible spatial contract**. No source raster is a JavaScript array disguised as science.

## 5.1 Candidate inputs and what they are allowed to prove

| Source family | Mission/instrument | Use | Verification needed |
|---|---|---|---|
| USGS Mars 2020 terrain-relative-navigation HiRISE DTM and ortho products | **Mars Reconnaissance Orbiter / HiRISE** | High-detail elevation and mapped visual context for a bounded crop | Correct product, download, map projection, native cell spacing, vertical units, common target coverage [R13] |
| USGS Mars Sample Return Jezero HiRISE DTM/orthomosaics | **Mars Reconnaissance Orbiter / HiRISE** | Higher-quality optional local mosaic where coverage supports targets | Product bounds, download size, advertised accuracy and mosaic registration [R14] |
| **USGS 2020 TRN CTX DTM (first-access candidate)** | **Mars Reconnaissance Orbiter / CTX** | 20 m/pixel real elevation; fast metadata, coverage and graph start; USGS catalog lists an approximately **9.3 MB** file | Inspect actual projection, data mask, vertical datum, overlap and scientifically appropriate spatial scale [R13, R28] |
| PDS Mars 2020 PLACES | **Perseverance / Mars 2020** | Rover localizations/trajectory geometry or site-pose cross-check | Reference frame, local-to-global transformations, sol reference, release notes [R15] |
| PDS Mars 2020 science records | **Perseverance instruments** | Target identity, objective, source notes, observation context | Exact observation record or cited mission page, point/regional confidence [R15–R19] |
| NASA Mars Trek and challenge-listed NASA resources | Multi-mission portal (depending on layer) | Official challenge-Resource qualification, optional supporting imagery/context | Confirm this exact source is in 2026 challenge Resources and layer license/API constraints [R05, R08] |

**Why this is genuinely multi-mission:** orbital imagery/elevation come from **Mars Reconnaissance Orbiter**; a real, geolocated **Mars 2020 Perseverance** PLACES record or PDS scientific observation must be integrated into the accepted target evidence and shown in the product, not only cited in the README. Identify these as different missions in the app. Merely using HiRISE and CTX from the same spacecraft would be multi-instrument, **not** necessarily multi-mission.

### Fast H0 source acquisition (metadata-first, not download-size theater)

The first-access CTX candidate is documented by USGS as a **20 m Jezero TRN DTM with a 9.3 MB external file**. This is a source-catalog size claim, **not** proof that its whole coverage overlaps all candidate science sites. Use the product's own landing page, file and companion XML/LBL [R28].

```bash
mkdir -p data/raw docs/data-evidence
curl -L --fail --retry 2 --output data/raw/jezero_ctx_20m.tif \
  'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
gdalinfo -json data/raw/jezero_ctx_20m.tif > docs/data-evidence/ctx_gdalinfo.json
sha256sum data/raw/jezero_ctx_20m.tif > docs/data-evidence/ctx_sha256.txt
```

On a Mac without `sha256sum`, use `shasum -a 256 ...`. The required tooling is `gdalinfo`/GDAL and Python's GIS dependencies. **First inspect `gdalinfo` for a usable spatial reference, pixel scale, bounds, NoData and elevations**; never use the filename to infer CRS details. If the host is down, use the official USGS catalog-linked alternative/mirror **only after checking checksum and provenance**. Never silently switch to an unlicensed screenshot.

The companion **CTX ortho is a separate product**, not guaranteed to be 9.3 MB. Inspect its size and projection separately before download. For very large imagery, try `gdal_translate -projwin ... /vsicurl/https://...` **only after** confirming HTTP byte-range support and a suitable TIFF layout (a COG or reasonably window-addressable TIFF); `/vsicurl/` is not a guaranteed sub-15-MB transfer. Prefer the correctly registered bounded crop and meaningful display quality over an unbounded full download. Keep the original native pixel scale and any resampled output scale in the manifest. **If a licensed, spatially registered orthoimage cannot be acquired in time, render a clearly labeled hillshade derived from the real accepted DEM instead**; do not claim it is observed optical imagery or silently omit surface-visual context. The MRO-derived hillshade still needs documented **Mars 2020** observation or PLACES input to support the multi-mission narrative. At **20 m DEM spacing**, route slopes are regional/model-scale only, not small rock or astronaut footing hazards.


**Toolchain contingency:** before attempting a large pipeline, test `python3 --version`, `python3 -c 'import numpy, scipy, rasterio'` and `gdalinfo --version`. The direct GDAL CLI may be unavailable on some laptops; Rasterio's installed wheels can inspect georeferencing and perform bounded crops without installing the system `gdalinfo` binary. If neither toolchain loads promptly, use Ali's/Kamel's known-working Docker environment with a pinned scientific Python image, or shift processing to the teammate whose machine is functional. Do **not** spend H0–H4 compiling native GDAL from source on multiple laptops. Pin one package manager for JS (`pnpm`) and one lock/requirements set for GIS; avoid drift.

**PDS positions:** the official PLACES localizations directory lists `best_interp.csv` (~8.2 MB) and its PDS4 label `best_interp.csv.xml` [R29]. Acquire **both** from the same release, verify the CSV schema against the label before using any column names, and inspect the release notes/reference frame. A Sol interval is a search filter for a scientific observation, **not the exact coordinates of a named outcrop**. Each accepted marker needs an observation-to-pose link and a spatial review; otherwise it is a proxy or approximate region.

**Do not require the runtime browser to fetch planetary imagery from a NASA server.** Acquire legally redistributable source data, process a small validated crop, record attribution, and ship a modest static bundle. This makes the exact judge experience repeatable offline.

## 5.2 Data-selection gates (G1–G5)

| Gate | Question | Required evidence | Failure response |
|---|---|---|---|
| **G1 — access** | Can we legally access and reuse the resource during the event? | Download/terms/attribution entry; at least one challenge-listed NASA resource | Choose another qualifying source; do not invent a copy |
| **G2 — registration** | Do imagery, elevation, base and target locations share a demonstrated coordinate mapping? | CRS/source metadata; 3–5 spatial cross-checks; overlay screenshot | Fix transform; otherwise disable routing on that layer |
| **G3 — terrain** | Is terrain sufficiently complete and meaningful in the site crop? | Cell spacing, vertical units, NoData count, scale limits, slope sanity plots | Crop smaller, use suitable coarser DEM, or **distance-only validated mode** |
| **G4 — science** | Do real source-backed targets occupy verified coverage? | Target ledger with records, exact or approximate statuses, coverage checks | Replace target or show approximate-context only |
| **G5 — proof** | Can the team reproduce/inspect one route and its time? | Manifest, source checksum, oracle, screenshot, fixed seed if any | Block hero claim until proof passes |

**H4 checkpoint:** by H4 have a single accepted study-area decision and one actual NASA-origin raster reading successfully. The strongest possible fail is an early, honest change of crop; the weakest is wasting half the sprint defending unverified geometry.

## 5.3 Coordinate contract: planetary geodesy is not ordinary web mapping

Mars uses different reference-body assumptions from Earth; planetary datasets may use planetocentric or planetographic latitude, positive-east or positive-west longitude, `0–360°` or `−180–180°` longitude, and specialized projected coordinate systems. Never assume that `EPSG:4326`, ordinary Google Maps distance, or Earth Web Mercator gives physically correct meters on Mars.

**One internal system:** create a **projected local analysis plane in meters**, with documented Mars reference body and transform. Preserve source longitude/latitude as metadata; transform **once** into analysis coordinates. Let raster pixel indices derive from that transform, not from visual approximation. Every distance and grade calculation uses analysis-space meters and elevation meters.

Implement and test:

```text
NASA source pixel / rover pose
  → identify planetary reference + longitude/latitude convention
  → convert to compatible Mars-fixed coordinates
  → choose one local projected analysis CRS, linear units = metres
  → reproject ortho + DEM into same study-area grid
  → save width/height, affine matrix, pixel scale, origin and transform record
  → derive pixel-indexed routes, overlays, hit targets and display assets
```

**Locked viewer — Leaflet `CRS.Simple`.** MapLibre's Earth-oriented geographic assumptions and the suggested fake-degree metric scaling add avoidable mapping ambiguity. Use **one bounded planar image-grid viewer** whose map units are **analysis raster cells**, not Earth degrees or real Mars longitude/latitude. No Earth distance helper or `map.distance()` determines Mars time/length. Analysis-space meters and genuine Mars coordinates remain in the GIS manifest. [R30]

**Coordinate mapping (single source of truth):** if the north-up exported image/grid has `height=H`, `width=W`, and row `0` at the top, mount `L.imageOverlay('/data/imagery/study-area.webp', [[0,0],[H,W]])`. Define the center of analysis cell `(row,col)` to be **Leaflet** `[lat=H-(row+0.5), lng=col+0.5]`; the inverse for an in-bounds map click is `row=floor(H-lat), col=floor(lng)`. Leaflet's `LatLng` is only a viewer `[y,x]` container here—**not a real latitude/longitude**. No CSS rotation, flipped image or independently scaled overlay is permitted. All overlays, target pins, paths and selection use these two conversion functions. An actual Mars coordinate readout comes from **raster affine inverse/forward and validated Mars CRS transformation**, never from displayed `LatLng`.

**Export invariant:** normalize the imagery/DEM/mask into the **same north-up, nonrotated grid** (affine `b=d=0`, `a>0`, `e<0`) before browser export; a skewed/rotated GeoTIFF must be reprojected before using the cell-to-Leaflet rule. Unit tests cover four corner cell centers, cell `(0,0)`, last row/column, one route polyline and an off-grid click. If this viewer approach fails, **fix its binding or fall back to the same bounded raster in a simple canvas**; do not reintroduce a second mapping architecture during the hackathon.

### Mandatory spatial assertions

- Raster grid dimensions, affine origin/rotation, projected bounds, center and resolution are present and finite.
- One exported route point converted grid→world→grid returns within a subpixel tolerance.
- Base and verified target pixels fall inside the valid-data mask.
- The display's four corner positions map to the correct image corners.
- Three manually selected geographic landmarks or validated source features align to within an explicitly recorded tolerance appropriate to the source product; **do not make up a universal sub-meter threshold**.
- A pixel near the study-edge cannot wrap to the opposite edge because of longitude-domain handling.
- Vertical values interpreted as meters remain within source-documented plausible ranges; a constant elevation is an integrity warning, not a beautiful flat route.
- All overlays use the same analysis revision/checksum.

## 5.4 Raster processing rules

**Pipeline:** `fetch → metadata → inspect → crop/reproject → mask → derive → validate → publish`. **H10 spatial release requirement:** the three science candidates, base and verified data mask must have a *measured common coverage*. If they do not, the domain lead selects a smaller **coherent group of targets inside coverage** or the USGS broader Jezero Science Investigation mosaic; do not claim that a 2×2 km crop magically covers far-separated sites. The science narrative and budget are adjusted openly, never the source coordinates.

1. **Ingest:** preserve original source label and metadata (`.xml`, `.lbl`, GeoTIFF metadata, publication page). Never treat a screenshot or Web tile as a DEM.
2. **Inspect:** print `CRS`, bounds, resolution, vertical unit, shape, nodata marker, pixel value range and source checksum. Reject mismatches before transformation.
3. **Crop carefully:** choose a *small* common region covering proposed base + verified candidate sites. Estimate the bounding box from **verified spatial records**, not a screen-drawn rectangle; calculate straight-line separation between extreme candidate targets and compare it to crop dimensions before downloading high-resolution ortho. A raster may be resampled coarser for a live browser without creating fine detail not present in the source.
4. **Resample:** `bilinear` for continuous elevation when meaningful; `nearest` for masks/categorical classes. Preserve an independently generated validity mask. Do not interpolate across large NoData holes and call the result measured terrain.
5. **Align:** one exact grid origin, shape, pixel size and affine matrix for elevation, imagery, masks and derived graph. **Lock north-up, pixel-is-area conventions and elevation vertical units** before export; if imagery native resolution differs, render a resampled copy on the same mapped extent while retaining original sensor resolution as metadata. Validate with a georeferenced reference image.
6. **Derive:** elevation, per-cell validity, optionally hillshade/grade, and grid edge costs. If a roughness/hazard layer does not have validated derivation, **do not feed it into routing**.
7. **Publish:** versioned, small static assets with hashes and a manifest. The original downloads remain out of Git; source URLs and procedures make the compilation reproducible.
8. **Audit:** sample real cells, known landmarks and a path profile. Record screenshots, source metadata and numerical summaries in `docs/validation.md`.

**NoData has its own semantics.** `UNKNOWN` is **not** “blocked by a known hazard” and **not** “safe to cross.” Use at least three mask values:

```text
0  UNKNOWN_COVERAGE  — missing, misregistered or untrusted analysis data
1  VALID_TRAVERSABLE — supported by the declared simplified route model
2  HARD_CONSTRAINT  — only if a source/model-supported constraint has been defined
```

Distinguish a NoData barrier from a terrain region that fails a declared hard slope assumption. If no valid route can be demonstrated due to missing coverage, the answer is **UNKNOWN**, not a confidently *INFEASIBLE* terrain judgement.

## 5.5 Export contract

`public/data/manifest.json` is the canonical data record. Every stored numeric unit appears in the field name or schema. Use raw source IDs, not marketing layer names, for traceability.

```json
{
  "schemaVersion": "1.0.0",
  "studyAreaId": "jezero-west-delta-v1",
  "buildId": "H0-build-revision",
  "analysis": {
    "crsWktOrProjjson": "SET_FROM_VERIFIED_SOURCE",
    "width": 0,
    "height": 0,
    "affineTransform": [0, 0, 0, 0, 0, 0],
    "horizontalUnit": "m",
    "verticalUnit": "m",
    "resolutionMeters": null,
    "baseGridCell": { "row": null, "col": null }
  },
  "layers": [],
  "sources": [],
  "checksums": {},
  "validation": { "geospatialStatus": "PENDING", "targetCountVerified": 0 }
}
```

> The JSON above is a **schema sketch with deliberately nonfunctional placeholders**, not the shipped asset. The live app must not show a “VERIFIED” manifest while these fields are unset.

Expected output files:

```text
public/data/
  manifest.json               dataset IDs, transforms, bounds, units, hashes
  sources.json                machine-readable provenance
  targets.json                source-backed scientific site records
  mission-scenario.json       declared assumptions and demo configuration
  elevation.bin               finite float values; masked cells handled explicitly
  validity-mask.bin           Uint8 mask per cell
  outbound-costs.bin          Float64 LE nominal time in minutes from base to each cell
  return-costs.bin            Float64 LE nominal time in minutes from each cell to base
  outbound-parents.bin        Int32 LE predecessor indices in row-major grid
  return-next.bin             Int32 LE next indices toward base in row-major grid
  grid.meta.json              source/analysis CRS, pixel transform, bytes, hashes, units, dimension/encoding
  imagery/study-area.webp    locally processed, credited orthoimage
  overlays/                  validated contextual overlays only
```

A 250×250 **Float64** cost array is approximately **500 KB**; two arrays therefore take about **1 MB**, a worthwhile trade for preserving numeric precision close to feasibility boundaries. Two Int32 pointer arrays add about 500 KB; elevation and masks add more, plus compressed imagery. The Python output is **not** silently rounded to Float32 before the feasibility comparisons. **This is a sizing illustration, not a measured final bundle size.** The actual grid footprint and resolution must come from data and performance tests.

### Locked binary, route and data-integrity contract

For a north-up `H×W` raster, node ID is `i=row*W+col`; **node zero is a valid node**, never a falsey sentinel. All **six** grid buffers are **flat, row-major** (multi-byte fields are **little-endian**). `outbound-costs.bin` and `return-costs.bin` use **IEEE-754 Float64 (`<f8`)** nominal **minutes**; `outbound-parents.bin` and `return-next.bin` use signed **Int32 (`<i4`)** node indices and **`-1` as no-link/root sentinel**; `elevation.bin` is Float32 (`<f4`) in **meters** with mask-controlled missingness; `validity-mask.bin` is unsigned byte (`|u1`) with `0=UNKNOWN`, `1=VALID`, `2=HARD_CONSTRAINT`. Float64 travel fields add roughly 500 KB total versus Float32 at 250×250 and avoid unnecessary classification rounding near zero margin.

**SciPy detail:** `scipy.sparse.csgraph.dijkstra(..., return_predecessors=True)` returns **`-9999`** for unreachable/root predecessors; export normalizes every such entry to `-1` [R31]. Run forward search on directed graph `W` and reverse search on `W.transpose().tocsr()` **from the same base index**. In the latter output, each recorded predecessor is the **next** step toward the base in the original graph. An unreachable cost is `+Infinity` in binary; browsers must reject `NaN`, negative costs, invalid pointer indices and finite cost paired with an impossible chain. `base→base` cost is exactly zero; its pointer is `-1` by convention. Never accidentally treat a zero edge as an absent SciPy sparse entry—edges must have strictly positive finite travel times.

At load time, check **file names, hashes, file byte lengths, schema version, selected base index, data revision and mask counts** before publishing the app's `READY` state. Explicitly decode little-endian values (`DataView.getFloat64(offset,true)`, `getInt32(offset,true)`) or verify typed-array host endianness. The relevant browser performance is small enough for one-time load. `public/data/grid.meta.json` and the manifest contain exact byte sizes and SHA-256, not just filenames. A partially downloaded mixed revision must show a legible unavailable state; never combine cost fields from one build with raster tiles from another.

**Unknown-vs-hard-constraint topology rule:** the accepted graph contains only valid traversable nodes and edges. If no complete accepted round trip exists, perform a **separate topological connectivity test** on a *permissive* graph that treats NoData cells as *potentially traversable but unpriced*, while still respecting known hard blocks. If such a possible route exists, answer **UNKNOWN / MISSING_DATA**; if even that permissive graph has no base↔target connection and the hard-block masks are validated, answer **INFEASIBLE / HARD_CONSTRAINT**. The permissive graph **never** supplies costs, paths or a visible traversable frontier. A disconnected point due to missing, undecodable metadata also remains UNKNOWN. This separation prevents a silent conflation of “we lack measurements” and “we know there is no path.”

The copy-ready Python exporter and browser mapping tests are in **Appendix E**. Their synthetic sample proves the contract, **not real Mars registration or timing**.

### Data source ledger entry

Every meaningful input receives a record like:

```yaml
id: hirise_jezero_dem
agency: USGS / NASA
mission: Mars Reconnaissance Orbiter
instrument: HiRISE
product_title: <source product name>
product_id: <actual catalog identifier>
landing_url: <authoritative catalog URL>
download_url: <downloaded file URL>
accessed_utc: <timestamp>
sha256: <downloaded bytes hash>
license_or_reuse_terms: <verbatim link/attribution requirement>
challenge_resource_listing: <exact 2026 Resources item or null>
spatial_reference: <from file>
longitude_convention: <from metadata>
original_pixel_scale_m: <from metadata>
analysis_pixel_scale_m: <after crop>
nodata_rule: <rule and mask>
derivation: <commands/commit>
limitations: <what this cannot prove>
reviewers: [Amr, Malak]
status: PENDING | VERIFIED | REJECTED
```

---

# 6. Deterministic traverse model

The route engine is **auditable mathematics**, not a language-model recommendation engine. NASA/JSC has researched terrain-aware xEVA traversal and metabolic workload modeling [R20]. That supports the *importance* of grade and resource-aware planning; it does **not** validate a universal Mars spacesuit-walking function or a fabricated astronaut risk index.

## 6.1 Required inputs

| Variable | Meaning | Authority |
|---|---|---|
| `start` | scenario base/current location, in grid coordinates | Explicit planning scenario |
| `target` | validated point or user-selected point | Source-backed geometry or user input |
| `DEM`, `mask` | source-derived elevation and validity | Accepted NASA/USGS data |
| `vRefMetersPerSecond` | reference flat-ground speed | Visible **scenario assumption**, initially `0.75 m/s` unless better qualified |
| `gradeResponse` | directional speed penalty function | Explicit **scenario assumption** informed by literature, *not* NASA-calibrated |
| `speedFactor` | `0.8`, `1.0`, `1.2` | Sensitivity scenario definition |
| `scienceMinutes` | nominal on-site activity | Source-backed if genuinely documented, otherwise visible **scenario assumption** |
| `timeBudgetMinutes` | remaining planning clock before delay | Scenario input |
| `elapsedMinutes` | simulated delay before departure | User action / scenario |
| `reserveMinutes` | time held back from the plan | Scenario assumption, never an actual EVA safety requirement |

A zero or negative reference speed is invalid; a negative reserve, elapsed time, or science duration is invalid; nonfinite values never enter the graph. The interface must prevent these values or report an explicit input error. Display the model's simplifications and do not imply that 20 minutes of reserve is NASA procedure.

## 6.2 Local directed grid graph

For neighboring traversable cells `u` and `v`, obtain horizontal analysis distance `d(u,v)` in meters, sampled elevations `z_u`, `z_v` in meters, and signed grade:

\[
 g_{uv} = \frac{z_v-z_u}{d(u,v)},\qquad
 \theta_{uv}=\arctan(g_{uv}).
\]

**Grade is directional**: `g_uv = −g_vu` when sampling the same endpoints. **Use 8-connectivity with an explicit no-corner-cut rule:** for diagonal `(r,c)→(r±1,c±1)`, both adjacent orthogonal cells must be `VALID`; if this is not implemented and tested, lock 4-connectivity instead, label the route-grid limitation and do not switch topology mid-demo. Diagonal edges have their own metric length, not “one pixel”.

Adopt one bounded, documented *directional scenario* function:

\[
 f(g) = \frac{1}{1+a\max(g,0)+b\max(-g,0)},\qquad a>b\ge0.
\]

Then:

\[
 v_{uv,s}=v_{ref}\;s\; f(g_{uv}),\qquad
 t_{uv,s}=\frac{d(u,v)}{v_{uv,s}}.
\]

**Versioned initial model (`terrain-scenario-v0`):** set **`v_ref=0.75 m/s`, `a=4.0`, `b=1.8`, `max_slope_deg=25°` (`max |grade|=tan 25°≈0.4663`)**, and sensitivity `0.8× / 1.0× / 1.2×`. These are **clearly visible scenario assumptions, not published Mars EVA limits or calibrated astronaut physiology**. Each slope estimate is across analysis-grid cell centers, not an observation of footstep obstacles. The grade threshold is a **compiler-configurable scenario rule fixed in the shipped field bundle**, not a live slider or a certification of safe passage. A changed threshold requires recompilation and a distinct model/dataset revision. Start with `activity_minutes=20`, `return_reserve_minutes=20`, `delay_minutes=15` as demo assumptions unless a particular activity has a directly sourced duration. The headline **EVA time budget is selected from the actual accepted paths** after G1 so that the demonstrated delay has a genuine consequence; never fake the path metrics. Record the chosen budget and target IDs in `mission-scenario.json` and rehearse with that exact version.

`a` and `b` are **dimensionless planning-model coefficients**, not empirically determined Mars EVA physiology. They may be **revised only with a new named model version and regenerated path fields**, after inspecting grade histograms and tests. A frontend slider must **not** silently change `a`, `b`, grid resolution or base point when only cached paths for the old model exist. The function intentionally makes ascent and descent costs different while declining to invent precise energy expenditure. If the data or references cannot justify asymmetric traversal, use a **symmetric distance/time model** and say exactly what is disabled.

A hard grade rule may be added only as a **declared scenario constraint**, distinct from a measured hazard threshold. Never describe a coarse raster's slope as a footstep-scale obstacle measurement.

**Important:** Multiplying all speeds by the same positive scenario factor `s` scales every edge time by `1/s`; therefore the shortest *route geometry* remains the same under these three speed multipliers in this model, while the *time and feasibility* change. Do not render different paths for `0.8×` versus `1.2×` unless some *other, disclosed* model parameter makes routes differ. This is a useful invariant and performance optimization.

## 6.3 Route and return are distinct computations

- Find the minimal-cost directed path **base→target** by Dijkstra or A* with an admissible bound.
- Find **target→base** as a separate directed path (or compute all-to-base costs by running shortest paths on the **reversed directed graph**).
- The backward-cost field is **not** just a copy of outbound costs: directional grade can make `T_out ≠ T_return`.
- If any required endpoint is in NoData, mark route `UNKNOWN` before calculating a misleading number. A scientifically approximate target has the same outcome, irrespective of which graph cell a decorative marker appears nearest.
- If connectivity is absent in the accepted-cost graph, apply §5.5 **permissive topology test**: possible crossing via unknown cells ⇒ `MISSING_DATA`/UNKNOWN; impossible even if unknown cells were admitted ⇒ `HARD_CONSTRAINT`/INFEASIBLE only if the known block data are validated.
- Never interpolate or teleport across untrusted cells to force a pretty route.

**Route-result contract:** `NO_SUPPORTED_PATH` is not itself a scientific reason. Pair it with an explicit `MISSING_DATA` or `HARD_CONSTRAINT` evidence code from §5.5; a regional/unverified target is `MISSING_INPUT`/UNKNOWN before graph inspection. Only accepted, traversable point locations receive valid numeric route summaries.

The **distance** of a route is the sum of actual horizontal edge lengths in meters. The profile samples elevation against cumulative distance. Treat slope/resolution limits as a description of data quality, not a safety certification.

## 6.4 Mission time accounting

For a target `k` and speed multiplier `s`:

\[
 B = T_{budget} - T_{elapsed}
\]

\[
 T_{needed,k,s}= T_{out,k,s}+T_{science,k}+T_{return,k,s}+T_{reserve}
\]

\[
 M_{k,s}=B-T_{needed,k,s}.
\]

A target is **feasible in scenario `s` iff** `M_{k,s} ≥ 0` and all required data/constraints are valid. Zero margin **counts as feasible numerically**, but UI should warn that there is no modeled headroom. Time numbers shown in the card and Why changed always come from the same assessment object; do not recalculate in a React component.

### Four decision states

| State | Precise definition | User-facing semantics |
|---|---|---|
| **ROBUST** | Feasible at all three tested speed multipliers | “Feasible across all tested movement scenarios” |
| **MARGINAL** | Feasible at one or two tested multipliers | “Depends on the assumed movement speed” |
| **INFEASIBLE** | Feasible in none, or violates an explicitly declared hard constraint, with data sufficient to make that statement | “Exceeds modeled time/constraint” |
| **UNKNOWN** | Missing/misaligned/unverified data prevents an assessment | “Evidence is insufficient to decide” |

`UNKNOWN` takes precedence over numerical classification. “ROBUST” is **not** a probability, a hazard score, a certified safety claim, or a guarantee.

**Path cost classification uses unrounded Float64 time values**; display formatting must not flip a near-zero margin. Show an explicit `0 min headroom` / `<1 min` boundary label when rounding would conceal a positive or negative margin.

**Ranking** is constrained, never mystical. For an objective, show the best-matching documented target from a **human-defined qualitative science relevance tier** with feasibility and margin. Do not compute “astrobiology value 97%” unless there is an actual validated quantification. If two targets satisfy the declared objective, prefer a robust target to a marginal one, then use a disclosed tie-breaker (e.g., margin and objective match). Always allow the user to inspect why another target was rejected.

## 6.5 The opportunity frontier

For each valid map cell `x`, calculate nominal directed costs:

\[
 C(x) = T_{base\rightarrow x} + T_{x\rightarrow base}.
\]

For a chosen speed `s`, the *movement-only returnable region* is:

\[
 F(B,s)=\left\{x : C(x)/s + T_{reserve}\le B \right\}.
\]

This is a **mobility-only frontier**, not a guarantee that every place within it supports a science activity. A **science target** additionally consumes its on-site activity time and may have a weaker evidence status. The UI legend must explicitly say “Returnable region, excluding science activity” or equivalent. Never conflate frontier pixels with fully feasible science opportunities.

### Performance approach

At data-compilation time or first client load, compute **two single-source shortest-path fields** on the directed graph: one from base to all cells, one from all cells back to base using reversed edges. When the delay slider changes:

- No A* per pixel.
- Update a threshold against two arrays (or their combined cost field).
- Reevaluate three target assessments and state badges.
- Render the updated frontier mask/contour using a throttled requestAnimationFrame update or a worker if necessary.
- Bound the display resolution, without pretending the visible contour has more spatial precision than the raster.

Monotonicity becomes a contract: **with all else fixed, consuming more time cannot expand the frontier or improve any target's margin.**

## 6.6 Why changed is an audit, not commentary

Every target transition produces a structured change record:

```ts
interface WhyChanged {
  targetId: string;
  previousRemainingMinutes: number;
  currentRemainingMinutes: number;
  previousState: FeasibilityState;
  currentState: FeasibilityState;
  scenarios: Array<{
    speedMultiplier: 0.8 | 1 | 1.2;
    outboundMinutes: number | null;
    scienceMinutes: number;
    returnMinutes: number | null;
    reserveMinutes: number;
    requiredMinutes: number | null;
    marginMinutes: number | null;
  }>;
  reason: "DELAY" | "MODEL_PARAMETER" | "MISSING_DATA";
}
```

Suggested UI copy:

> **Wildcat Ridge becomes infeasible in the tested scenarios.**  
> A 15-minute delay reduced the available clock from **[before]** to **[after]**. Modeled outbound **[x]** + science **[y]** + return **[z]** + reserve **[r]** = **[required] min** at nominal speed. The new margin is **[m] min**. **[Alternative]** remains **[state]**.

Brackets are runtime values. The text must derive from the assessment objects—not hand-edited to make the judge narrative dramatic. If the selected real-data demo doesn't naturally exhibit a state transition under a 15-minute delay, adjust the **declared planning time budget**, not geospatial evidence or route-time outputs, and disclose the scenario settings.

## 6.7 Custom pin and rover context

**Custom pin:** click/tap a valid map location → transform through the viewer↔analysis mapping → check valid mask → route and return → assess with a **user-selected generic activity duration**, clearly labeled as a scenario parameter. The card headline must say **“Custom location — no site-specific science evidence.”** If the cell is outside coverage, return `UNKNOWN` and no fake line.

**Rover context:** show one dated, attributed Perseverance traverse/pose series only when the PLACES geometry is validated. A toggle is labelled **“Perseverance context · separate mobility mode”**. The visual may help users compare a real robotic exploration corridor with a hypothetical human science-planning traverse, but **do not claim a numeric human-versus-rover speed advantage** without matching tasks, terrain model and credible calibration. A rover line alone is context, not a second validated route model.

---

# 7. A hard-coded demo is forbidden; a reproducible example is essential

Before real data arrives, the engine is developed against hand-verifiable **synthetic fixtures**. Synthetic fixtures are testing aids; NASA science data remains the production map. Do not generate a synthetic heightfield and call it Jezero.

### Illustrative known-answer demonstration (NOT measured Mars travel times)

Assume a planning budget of **105 minutes**, reserve **20 minutes**, a **15-minute delay**, and three hypothetical targets. `0.8×` and `1.2×` scale **travel time only**, not site science duration or reserve.

| Fictional fixture | Out / science / return (nominal min) | Required at 1.0× incl. reserve | Initial at 105 min | After delay: 90 min |
|---|---:|---:|---|---|
| A | 12 / 20 / 12 | 64 | ROBUST | ROBUST |
| B | 20 / 25 / 18 | 83 | ROBUST | MARGINAL |
| C | 25 / 35 / 25 | 105 | MARGINAL | INFEASIBLE |

Check target C:

- Conservative `0.8×`: `(25+25)/0.8 + 35 + 20 = 117.5 min` → not feasible at 105.
- Nominal `1.0×`: `25+25+35+20 = 105 min` → exactly feasible initially.
- Faster `1.2×`: `(25+25)/1.2 + 35 + 20 ≈ 96.67 min` → initially feasible.
- After delay, remaining clock is `105−15 = 90 min`, below **96.67**: none of the scenarios fits → **INFEASIBLE**.

Check target B after delay: conservative `(20+18)/0.8 +25+20 =92.5>90`; nominal `83≤90`; faster also fits → **MARGINAL**. Target A remains **ROBUST** because its conservative total is `(12+12)/0.8+20+20=70≤90`.

This gives the team an **unambiguous test oracle** and a pattern for the desired interaction. **Production numbers must be recalculated from the real, validated site crop.** Never ship this fixture as a NASA-derived demonstration or pass it off as real targets.

---
# 8. Application architecture: make the difficult part reliable

## 8.1 Stack and runtime boundary

**Frontend:** Next.js App Router, React 19+, TypeScript in strict mode, Tailwind CSS v4, **Meta Astryx (`@astryxdesign/core`) as the mandatory shared UI component foundation**, a compiled SESHAT-branded Astryx theme, and bespoke scientific cartography/workbench components. **Do not scaffold or base the application on shadcn/ui**; no parallel component library is adopted by default. Astryx supplies reusable controls and accessibility patterns; the unique scientific layout, map layers, route/profile visualizations and decision storytelling are our own. **Rendering:** **Leaflet `CRS.Simple` is locked from H0** using the north-up grid-coordinate contract in §5.3; no MapLibre integration or invented pseudo-geographic scaling. **GIS build stage:** Python 3.12, Rasterio/GDAL, NumPy and a shortest-path implementation tested against hand fixtures. **Hosting:** Vercel static export, `https://seshat.kmls.dev`, Cloudflare-managed DNS; optional second static mirror. **Development:** GitHub, CI, Playwright and human-owned oracles.

**Why static export?** A deterministic, small study area needs no authentication, database, cloud compute, per-judge API charges, or run-time NASA network call. Next.js explicitly supports static output, with the important limitation that server-only features are unavailable [R21]. All scientific data is compiled into assets; all user changes are local and reproducible.

`next.config.ts` should explicitly set `output: "export"`. For the one-page competition app, use only `/` plus static assets; do not rely on arbitrary dynamic routes or CDN tile requests. `Leaflet` must be imported **client-only** (`dynamic(...,{ssr:false})` inside an appropriate Client Component or browser-only mount); its CSS and custom locally hosted SVG marker icons must load in both `next build` and offline static mode. **Do not rely on Leaflet default marker sprite resolution by accident.** Avoid server actions, runtime Next.js API routes, request-time server data dependencies, and remote font or tile requests required for basic operation. If `next/image` is used in export mode, configure compatible static handling or use regular image assets. **Test the actual `out/` export, not only `next dev`.**

## 8.1A Astryx is an implementation dependency, not visual inspiration

**Decision — locked:** every conventional UI control and interactive primitive starts from **Astryx**. The project uses its published React components, accessibility behavior, theming system, documentation CLI, and Tailwind v4 bridge. The bespoke parts are the Mars map, spatial overlays, route canvas, frontier contour, elevation visualization, and the way the scientific workbench composes controls; these do **not** need to pretend to be standard components. Astryx is in **beta**, so pin a tested dependency/lockfile revision at H0; do not adopt unreleased `@canary` chart/lab packages or change versions after the build has stabilized [R23, R25–R27].

**Installation at authorized H0, not before:**

```bash
# Assuming the team chooses pnpm consistently for the Next.js app:
pnpm add @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
pnpm add -D @astryxdesign/cli
pnpm exec astryx init
pnpm exec astryx component --list
pnpm exec astryx component Button
pnpm exec astryx docs tokens
pnpm exec astryx docs theme
pnpm exec astryx theme template
pnpm exec astryx docs author-a-theme
```

`astryx init` should add the Astryx component index to the repo's `AGENTS.md` / `CLAUDE.md` context, which the core team then **merges with**, not replaces, SESHAT's own project rules. The CLI is authoritative for the installed version's component names, props and examples: **coding agents must look up APIs rather than guess them**. If the local `pnpm exec` command is unavailable, the official scoped command `pnpm dlx @astryxdesign/cli ...` is documented; prefer the pinned local dependency after installation. The unscoped `npx astryx` can refer to an unrelated package when the Astryx CLI is not installed [R25].

Use the exact CSS cascade order documented for **Next.js + Tailwind v4**. For a new app, `src/app/globals.css` begins:

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
@import '@astryxdesign/core/tailwind-theme.css';
@import 'tailwindcss/utilities.css' layer(utilities);

/* SESHAT-owned presentation rules live below these imports, in explicit layers. */
```

**Do not replace this with an improvised `@import 'tailwindcss'` arrangement without checking the official migration instructions.** Layer order matters: placing the declaration below the imports can silently stop Tailwind `className` overrides from working [R25–R26].

`src/app/providers.tsx` starts with the documented, prebuilt theme wiring:

```tsx
'use client';

import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <Theme theme={neutralTheme} mode="dark">
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
```

`src/app/layout.tsx` imports `globals.css`, wraps the app in `<Providers>`, and keeps the `html`/`body` structure of the official Next.js example. Set the body font explicitly via the project's licensed local font. The neutral theme above is the **installation smoke-test baseline only**, not the final appearance. At the H3 design gate create `src/themes/seshat/seshatTheme.ts` and the required **same-stem descriptor** `seshatTheme.doc.mjs`; the theme uses `defineTheme({name:'seshat', extends: neutralTheme, tokens:{...}})` with documented token names. Copy the actual shape from the **installed** CLI's `theme template` and `docs author-a-theme` output; do not invent private/internal token keys. The descriptor is type `theme`, name `seshat`, display name `SESHAT`, and `maintained:false`. Build and register:

```bash
pnpm exec astryx theme build ./src/themes/seshat/seshatTheme.ts
pnpm exec astryx theme add seshat
pnpm exec astryx theme use seshat
```

**Then use the generated** `src/astryx-themes.ts` module (`themes`, `defaultThemeSlug`) in `src/app/providers.tsx`, retaining the existing `Theme` and `LinkProvider`; load the CSS via the generated module as documented. Do **not** manually edit generated theme files or keep both neutral and compiled SESHAT theme CSS as competing token sources. Built CSS/JS avoids runtime theme flicker in static/SSR output. The authoritative command syntax and precise exports follow the **installed version** [R27]. If this theme build is blocked at H3, keep implementing map/data and workbench against the approved *design tokens*, fix the build before release, and never ship unmodified default Neutral styling.

**H0/H3 acceptance:** a real Astryx `Button` renders in a local Next.js page; Tailwind utilities can override its `className` where intended; dark mode, focus, keyboard use and theme variables work; and the static production export still builds. At H3, the same proof must use the approved SESHAT theme and an actual map-workbench composition, not unmodified Neutral showcase cards. If Astryx exposes a component defect, first use documented props → theme tokens → component theme overrides → scoped CSS `className`. `swizzle` is a last resort because ejected components require a source-compilation path and become team-maintained. **Do not install shadcn/Radix as a casual workaround**: a genuinely missing accessible behavior requires a scoped, reviewed exception, with the component visually conforming to SESHAT [R26–R27].


### System path

```text
Authoritative NASA / USGS / PDS data
               │
               ▼
       Python GIS compiler
       ├─ metadata and licensing
       ├─ Mars CRS + raster alignment
       ├─ terrain/validity checks
       ├─ directed edge-time model
       ├─ outbound and reverse shortest paths
       └─ tests + source manifest
               │
               ▼
    versioned static analysis bundle
    imagery · grid · masks · times · parent pointers
    targets · scenarios · citations · validation
               │
               ▼
           Next.js client
    ├─ map viewer + registered overlays
    ├─ typed pure feasibility engine
    ├─ deterministic mission state
    ├─ source and explanation inspector
    └─ screenshot/video-friendly hero workflow
               │
      ┌────────┴─────────┐
      ▼                  ▼
 Vercel production    Local static server
 seshat.kmls.dev      Kamel + Ali's machines
```

## 8.2 One fixed scenario base, fast verified/custom targets: compiled computation

For a **fixed scenario base**, the Python compiler can compute a directed shortest-path tree **from the base** and a directed shortest-path tree **to the base** (using reversed graph edges). Export:

- `outbound-costs.bin`: time base→cell at nominal speed;
- `return-costs.bin`: time cell→base at nominal speed;
- `outbound-parents.bin`: predecessor index for each valid cell;
- `return-next.bin`: next cell toward base for each valid cell;
- `validity-mask.bin`: source-supported states;
- `elevation.bin`: sampled elevation for route profiles.

At runtime, choosing any covered custom pin only requires **lookup + pointer-chain reconstruction**. It is not a hardcoded target route: the chain represents a real computed shortest-path tree over the accepted data and model. The UI can construct outbound and return geometry from parent pointers and derive elevation profiles. Cache the result for selected targets. No browser A* or 40,000-per-click worker is needed.

**Design constraint:** if a future feature edits the base location or changes the terrain cost function, the precomputed trees are invalid and the tool must recompile or use an appropriately tested runtime route worker. The competition UI fixes the base for a given declared scenario, and only changes time/speed factors, so these optimized fields remain valid.

Data format is **locked in §5.5**: `<f8`/`<i4`/`<f4`/`|u1`, row-major, `-1` pointer sentinel, schema, hash, dimensions, base index, and revision. The SciPy `-9999` source sentinel is not exposed to clients. **Do not use a JavaScript truthy check on index `0`.** Cycles, out-of-grid pointers and invalid parent chains must yield `UNKNOWN`, not freeze the UI.

## 8.3 Runtime types

```ts
export type EvidenceStatus =
  | "VERIFIED_POINT"
  | "APPROXIMATE_REGION"
  | "USER_SELECTED";

export type FeasibilityState =
  | "ROBUST"
  | "MARGINAL"
  | "INFEASIBLE"
  | "UNKNOWN";

export type AnalysisStatus =
  | "READY"
  | "MISSING_INPUT"
  | "INVALID_GEOMETRY"
  | "NO_SUPPORTED_PATH";

export interface EvidenceReference {
  title: string;
  url: string;
  sourceId: string;
  claimSupported: string;
}

export interface ScienceTarget {
  id: string;
  name: string;
  location: {
    originalCoordinateText: string;
    coordinateFrame: string;
    gridRow: number | null;
    gridCol: number | null;
    confidence: EvidenceStatus;
    locationSource: string | null;
  };
  objectiveTags: string[];
  science: {
    summary: string;
    sourceIds: string[];
    evidence: EvidenceReference[];
    limitations: string[];
  };
  activity: {
    minutes: number;
    basis: "SOURCE_BACKED" | "SCENARIO_ASSUMPTION";
    sourceId?: string;
  };
}

export interface MissionScenario {
  id: string;
  label: string;
  timeBudgetMinutes: number;
  elapsedMinutes: number;
  reserveMinutes: number;
  referenceSpeedMetersPerSecond: number;
  speedMultipliers: readonly [0.8, 1, 1.2];
  gradeModelId: string;
  datasetRevision: string;
}

export interface RouteSummary {
  status: AnalysisStatus;
  distanceMeters: number | null;
  nominalTravelMinutes: number | null;
  geometryGrid: Array<[number, number]>;
  sampledElevationsMeters: number[];
  unknownReason?: string;
}

export interface TargetAssessment {
  targetId: string;
  state: FeasibilityState;
  outbound: RouteSummary;
  returnRoute: RouteSummary;
  scienceMinutes: number;
  reserveMinutes: number;
  remainingMinutes: number;
  nominalMarginMinutes: number | null;
  scenarios: Array<{
    factor: 0.8 | 1 | 1.2;
    requiredMinutes: number | null;
    marginMinutes: number | null;
    feasible: boolean | null;
  }>;
  reasonCode:
    | "FEASIBLE_ALL"
    | "SPEED_SENSITIVE"
    | "TIME_EXCEEDED"
    | "HARD_CONSTRAINT"
    | "MISSING_DATA";
}
```

**API rule:** every component receives a complete `TargetAssessment`; it never independently derives margins. Schema validation happens on dataset load (Zod or a small equivalent), with human-readable error messages. All visible numeric fields are formatted through one small module that controls units, precision and `null`/unknown presentation.

## 8.4 State and cache boundaries

Single canonical session state:

```text
objectiveId | selectedTargetId | elapsedMinutes | budgetMinutes
reserveMinutes | activeSpeedScenario | layerVisibility
customPinGridCell | detailsPanel | comparisonMode
```

Derived values:

```text
assessment(target, scenario, costs)
frontier(budget, reserve, nominal roundtrip field, speed factor)
routeGeometry(target cell, parent arrays)
whyChanged(previous, current)
```

**Never persist derivations as user-entered truth.** The URL can later serialize only harmless scenario settings; do not add account or session infrastructure.

Core updates should not rerender the entire map tree on each slider tick; memoize the source buffers, limit frontier drawing frequency and update small UI regions. The shape of the data and the visual layers are stable after load.

## 8.5 Build artifacts and repository anatomy

```text
seshat/
├── AGENTS.md                     shared engineering/AI instructions
├── DESIGN_SYSTEM.md              human-approved SESHAT-over-Astryx theme/UI contract
├── README.md                     project, setup, method, limitations
├── LICENSE                       Apache-2.0 after compatibility review
├── package.json
├── next.config.ts                 static export
├── tsconfig.json                  strict
├── public/
│   ├── data/                      generated source-linked outputs (§5.5)
│   ├── brand/                     original logo assets only
│   └── fonts/                     properly licensed local webfonts
├── src/
│   ├── app/                       app shell, providers.tsx (Astryx Theme/LinkProvider), CSS
│   ├── components/
│   │   ├── workbench/             app zones and state transitions
│   │   ├── cartography/           Leaflet `CRS.Simple` layers, tools, legend
│   │   ├── assessment/            target choice, budget, Why changed
│   │   ├── evidence/              source drawer, uncertainty
│   │   └── ui/                    SESHAT-specific compositions around Astryx; no cloned primitive library
│   ├── engine/
│   │   ├── types.ts
│   │   ├── feasibility.ts
│   │   ├── frontier.ts
│   │   ├── route-path.ts           parent-pointer reconstruction
│   │   ├── explain.ts
│   │   └── formatting.ts
│   ├── data/                      schemas, loader, integrity check
│   ├── state/                     central scenario store
│   └── design/                    SESHAT Astryx theme source/build, tokens, typography
├── pipeline/
│   ├── requirements.txt
│   ├── inspect.py
│   ├── transform.py
│   ├── compile.py
│   ├── route_fields.py
│   ├── validate.py
│   └── tests/
├── tests/
│   ├── oracles/                  HUMAN-owned expected results
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── event-brief.md
│   ├── sources.md
│   ├── assumptions.md
│   ├── target-verification.md
│   ├── validation.md
│   ├── decisions.md
│   ├── ai-use.md
│   ├── submission.md
│   └── event-evidence/
└── .github/
    ├── workflows/verify.yml
    └── pull_request_template.md
```

Repo architecture is intentionally **one deployable frontend and one offline data compiler**, not microservices or a complex monorepo. `data/raw/` is ignored and never committed. Generated small assets are committed or attached to a pinned release for offline replay; the exact revision must agree with the checked-in manifest.

---

# 9. The SESHAT interface: an instrument, not a dashboard

## 9.1 Design position

**Visual language:** planetary science cartography × restrained mission control × a subtle original visual reference to Seshat and measured geometry. It should feel confident, legible, credible and edited—not like AI-generated space-themed SaaS. The Mars data must occupy the visual center.

NASA's **Open MCT** provides relevant precedents for operational information grouping [R11]. **Meta Astryx is the installed, primary SESHAT UI system**—not merely an inspiration. Its typed React components, built CSS, semantic token/theme infrastructure, accessible interaction patterns, and agent-readable CLI are the foundation for the entire app [R22–R23, R25–R27]. We are deliberately **not using shadcn/ui as a competing base library**. Astryx contributes coherence; **SESHAT's original cartographic composition, typography, interaction model, brand, and visual judgment create distinctiveness**. A less common library alone does not guarantee a unique-looking product.

### Visual principles

1. **Map first.** At ordinary laptop width, give the map **at least 55% of horizontal working area**; don't bury it inside cards.
2. **One question per zone.** Objective and layers left; map center; options and rationale right; time budget as a single low-height strip.
3. **Numerical honesty.** Numbers have units and precision. Assumptions are marked, not footnoted out of sight.
4. **Revealed complexity.** A judge sees one clean decision first; sources, math, profile and alternatives open intentionally.
5. **Functional restraint.** Every symbol, line, color and motion represents a distinction the user needs.
6. **Not monochrome theater.** Terracotta refers to Mars/site selection; semantic feasibility uses separate accessible states.
7. **No fake NASA control room.** SESHAT is a student-built research instrument with its own original mark. Do not mimic official NASA insignia or imply mission certification.

## 9.2 Layout anatomy

At `1440×900`, work toward this composition (final dimensions follow visual inspection; values are starting design constraints). **At 1280 px**, narrow left/right rails to roughly **224/270 px** so the remaining map viewport exceeds the 55% width target; secondary rail content can scroll internally, but the main decision must fit without page scrolling:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SESHAT   •   JEZERO / WESTERN DELTA    MODEL v1        105m  20m reserve  ⋯ │  56px
├────────────────┬───────────────────────────────────┬─────────────────────────┤
│                │                                   │                         │
│  OBJECTIVE     │                                   │  SCIENCE OPPORTUNITIES  │
│  Delta geology │                                   │  01 Target / status     │
│                │                                   │  02 Target / status     │
│  TARGETS       │       REGISTERED MARS MAP         │  03 Target / status     │
│  3 source-     │                                   │                         │
│  backed sites  │    hillshade · source boundary    │  WHY CHANGED           │
│                │    frontier · routes · selected   │  shown after an event   │
│  LAYERS        │                                   │                         │
│  image         │                                   │  [Inspect evidence]     │
│  terrain       │                                   │                         │
│  rover context │                                   │                         │
│                │                                   │                         │
│  Source link   │                                   │                         │
├────────────────┴───────────────────────────────────┴─────────────────────────┤
│  OUT  25m  │  SCIENCE  35m  │  RETURN  25m  │  RESERVE  20m  │ MARGIN  0m    │  76px
└──────────────────────────────────────────────────────────────────────────────┘
```

At 1440 px, left rail ~250 px and right rail ~300–330 px; center flexes. At 1280 px, left rail ~224 px and right rail ~270 px; verify the *actual CSS grid* leaves at least 55% for the map. Both rails use **section separators and typography**, not an ocean of nested cards. Allow rail scrolling **only when needed**; the hero path must work at 1280×720 with no accidental page scrollbars. On narrow screens, move ancillary tools into accessible sheets and retain a usable map; do not spend the event building an unrelated mobile UX.

**Layout dry-run:** at a 1280×720 judging resolution, reserve ~56 px header and ~76 px decision strip, then check that the remaining ~588 px supports an unobstructed target selection → route → delay workflow. This cannot be asserted from a wireframe; take a real screenshot in production mode and revise the rail density if needed.

**Navigation:** default view is the tool. No long marketing landing page, separate feature portal, onboarding wizard, or tabbed dashboard. The first render should establish place, objective, uncertainty and the primary action.

## 9.3 Tokens and typography

Use **one SESHAT-branded Astryx theme** and one small app-level mapping of scientific states—**not two independently maintained sets of base design tokens**. Start from the production-built Astryx Neutral theme, extend it through `defineTheme` with SESHAT color, surface, type and radius tokens, and compile it using the documented CLI before release [R27]. Use the Astryx Tailwind bridge (`tailwind-theme.css`) so utilities such as `bg-surface`, `text-primary`, `border-border` and `rounded-lg` resolve through the *same theme variables* as Astryx components. Do not hard-code `bg-zinc-900`, `rounded-2xl` or button colors independently in every feature.

**Suggested SESHAT visual tokens** (human-approved intent; map them to the actual Astryx keys identified by `pnpm exec astryx docs tokens` before implementation). `--canvas`, `--mars`, etc. below are SESHAT *domain tokens*, not claims that Astryx has these exact API names. Standard component appearance is themed through Astryx semantic variables such as `--color-background-body`, `--color-background-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border` and `--color-accent`; do not substitute these domain tokens for its own semantic token system.

Candidate starting palette:

```css
:root {
  /* Surfaces */
  --canvas: #080b10;
  --surface: #0e131a;
  --surface-raised: #151c25;
  --stroke: #26303c;
  --stroke-strong: #3a4755;

  /* Typography */
  --ink: #eef1f4;
  --ink-muted: #adb8c5;
  --ink-subtle: #758395;

  /* Cartography + interaction */
  --mars: #c47753;
  --mars-deep: #8a5038;
  --selection: #e7a17c;

  /* Decision classes */
  --robust: #58ac9c;
  --marginal: #e0b05d;
  --infeasible: #e47769;
  --unknown: #8392a4;

  --radius-control: 5px;
  --radius-panel: 7px;
  --focus-ring: 2px solid #e7a17c;
}
```

**Astryx theme-to-domain ownership:** `--canvas` ↔ Astryx body background; `--surface` ↔ surface background; `--ink` ↔ primary text; `--ink-muted` ↔ secondary text; `--selection` ↔ accent. Keep scientific `--robust`, `--marginal`, `--infeasible`, `--unknown` as domain-semantic presentation tokens: only map them to Astryx success/warning/error/neutral roles where meaning matches exactly, not by color resemblance. The distinctive Mars palette is a SESHAT art direction, **not** a license to replace accessible focus and status behavior. The actual final theme must be checked in its light/dark CSS scope and tested at 1280×720.

**Color is never the sole state encoding.** Pair icon geometry, word labels, and (where useful) hatch/dash line styles. Actual contrast must be checked against real raster imagery, not only blank background.

**Fonts:** a high-quality, legible sans such as **Inter** or **Geist**, and a reserved monospace such as **JetBrains Mono** for coordinates, units and numbers. Locally bundle permitted webfont assets; do not depend on Google Fonts downloads during offline judging. Verify font licenses and acknowledge them.

**Type hierarchy:** 22–24px app-level decisive heading or selected target; 15–16px section/decision text; 13–14px working controls; 11–12px labels and source metadata. Compact does not mean tiny. Use tabular numerals on changing values and sensible line heights. Sentence case almost everywhere; uppercase is only for terse instrument labels. Avoid excessive letter spacing, theatrically spaced small caps, and wall-to-wall ALL CAPS.

**Spacing:** consistent 4/8px rhythm; panel padding approximately 16–20px; related controls stay visually grouped; important actions receive whitespace rather than large ornamental boxes. Border radius deliberately modest. Shadows only when a layer truly overlays another layer. Avoid gratuitous glass effects, neon glows, purple gradients, “AI orb” motifs, parallax, floating dashboards, oversized KPI blocks and icon soup.

## 9.4 Astryx component strategy and high-value contracts

**Component ownership rule:** import actual Astryx components directly (prefer documented component entry points) for standard controls—buttons, accessible selection, overlays, typography/layout primitives, menus, disclosure, status and form controls **where they exist in the pinned release**. Inspect the installed CLI, Storybook and source before naming a specific component or prop in code. Compose these into SESHAT domain components; do not copy/paste shadcn component sources or introduce a second base design system.

| SESHAT need | Foundation / implementation decision |
|---|---|
| Normal controls, focus, disabled and status | Astryx documented components; shared SESHAT theme and variants |
| Workbench panels and rhythm | Astryx layout/typography primitives wherever suitable; custom CSS Grid for the fixed map-first composition |
| Layer toggles, filters, speed and budget inputs | Astryx controls; semantics and keyboard behavior verified against the installed CLI |
| Target rows and inspector/drawer | SESHAT composition using Astryx building blocks; intentional density, not stock dashboard cards |
| Map view, raster layers, markers and frontier contours | Bespoke Leaflet `CRS.Simple`/cartographic code with separate data contracts; Astryx is **not** the map engine |
| Route elevation profile and scientific frontier | Bespoke evidence-driven SVG/canvas/data rendering; no unverified Astryx canary chart dependency |
| Source status, UNKNOWN and reasons | Astryx typography, feedback and disclosure patterns, with scientific semantic state rules |

### Customization and anti-slop rule

1. **Use real Astryx props first.** Look up `pnpm exec astryx component <Name>`; do not ask an AI agent to guess component exports or props.
2. **Theme before one-off CSS.** SESHAT's own brand is expressed by the compiled theme, semantic tokens, component-level overrides and reviewed compositions—not 40 unique per-screen exceptions.
3. **Tailwind is for layout and precise composition.** Grid, positioning, responsive modes and cartographic annotations can use utilities, but utility values should normally use the Astryx bridge and shared tokens.
4. **No default component showcase.** Replace generic cards, gratuitous badges, dashboard sections, icon soups and marketing copy with scientific workbench-specific interactions; use a limited set of purposeful components.
5. **Swizzle rarely.** `astryx swizzle` ejects source and creates a custom maintenance/build obligation; only use it for a critical approved capability unavailable via props/theme/className.
6. **No second design system.** Do not install shadcn, MUI or another UI kit merely because a coding agent suggests it. A narrow accessibility exception requires evidence, a named reviewer and a visual match.

## 9.5 High-value component contracts

| Component | Must communicate | Allowed interaction | Critical states |
|---|---|---|---|
| `MissionHeader` | Study area, mission scenario, elapsed/remaining time, reserve, model source indicator | Mission scenario details | Ready / invalid source / missing data |
| `ObjectiveSelector` | User's stated science objective | Choose qualitative objective | Selected / no compatible evidence |
| `ScienceTargetList` | Three source-backed opportunities, status and brief reason | Select, compare, inspect | Robust / marginal / infeasible / unknown |
| `MapWorkbench` | Valid-data extent, imagery, route(s), selected target, frontier | Pan, zoom, select, place custom pin | Loading / ready / data failure |
| `LayerControl` | Semantically real raster/context layers and opacity | Toggle, compare, inspect source | Available / no overlap / source error |
| `EVAClock` | Budget, elapsed, reserve, ability to simulate a delay | `+15 min` and bounded slider | Clamped / exhausted / reset |
| `TimeBudgetStrip` | One transparent sum | View detailed breakdown | Normal / zero margin / deficit / unknown |
| `WhyChanged` | Previous/current decision and exact cause | Expand math | Changed / unchanged / not enough data |
| `EvidenceDrawer` | Source, scale, quality, license, assumptions | Inspect linked authoritative reference | Verified / approximate / unverified |
| `RouteProfile` | Along-route elevation with distance/units | Show selected route leg | Real profile / no terrain / short route |
| `ScenarioControl` | Three tested movement assumptions | Choose factor or inspect all | Selected / explanatory caveat |

**No promotional copy disguised as telemetry.** Good examples: “18 min outbound”, “Return is grade-sensitive”, “Route crosses unverified coverage”. Bad examples: “AI-powered safety index: 98%”, “Optimal destiny unlocked”, “NASA-approved path”.

## 9.6 Motion, interaction, and map affordances

The **+15 min** action is the hero moment. Transition over about **250–350 ms**, subject to actual performance and reduced-motion settings:

- frontier boundary morphs/crossfades to the newly computed threshold;
- one or more target statuses change (in the deliberately chosen, honest scenario);
- time margin decreases with stable-width numbers;
- the relevant Why changed reason becomes visible;
- focus/selection does **not** jump or disappear.

**Do not animate the path to fake scientific computation.** No looping HUD scans, blinking warnings, animation for animation's sake, or artificial “AI thinking” latency. Respect `prefers-reduced-motion`: immediate state update or a gentle minimal transition.

Map interaction must have a clear selected-marker appearance, unobtrusive zoom controls, an obvious valid-data boundary, a readable legend, and a mode hint (“Click a valid area to inspect a hypothetical stop”). Hovers alone do not convey necessary information. Keyboard focus and buttons provide alternatives to pointer-only operations. Give user-selected locations a different visual grammar from source-backed sites.

## 9.7 The visual approval loop

The human visual reviewers are **Kamel + Hams**, not an autonomous layout generator.

At H3, approve **one actual screenshot from a Next.js page using Astryx controls and the compiled SESHAT Astryx theme** showing target workbench proportions and tokens before teammates build many components. At H12, inspect a real-data map and determine whether imagery, overlays and target hierarchy are legible. At H25 and H35, perform screenshot critique on **1280×720**, **1440×900**, Kamel's actual laptop, and projected/external-display conditions if available.

Reject a UI PR if:

- it introduces raw unrelated colors, off-theme overrides, unrelated UI-kit components, default Astryx Neutral showcase styling, random radii or inconsistent spacing;
- it makes the map smaller without a demonstrated task improvement;
- it adds more than one redundant panel or an unexplained metric;
- it hides scientific uncertainty under misleading confidence;
- it introduces accidental horizontal scrolling, clipped controls, unreadable projection text, or low-contrast data overlays;
- it omits loading/error/empty/accessibility states;
- it changes layout structure without the UI owners' sign-off.

**Design review protocol:** capture screenshot → annotate concrete issues (hierarchy, density, alignment, readability, source labels, motion) → fix → compare in same viewport. “Make it prettier” is not an actionable task. The shared design file records anatomy, behaviors, visual constraints and approved variation; the team should not ask each AI assistant to independently invent a design language.

---

# 10. Product behavior: complete state model

| Event / edge case | Required behavior | Never do |
|---|---|---|
| App starts with valid packaged assets | Map + study boundary + targets render with an obvious objective | Display a decorative empty landing page |
| Dataset download/decode fails | Error explains which asset failed, offers retry and local-bundle fallback | Show zeroed Mars numbers as truth |
| Target has exact validated point | Route reconstructs and card shows supported source | Infer that the surrounding area is hazard-safe |
| Target has only a regional approximation | Clearly label approximate point and qualify traverse precision | Use “verified sample coordinate” language |
| User clicks unknown raster | Mark `UNKNOWN`, no route geometry invented | Draw a straight line through NoData |
| Time exactly equals required | Numeric feasibility yes, margin `0 min`, clear no-headroom caveat | Mislabel as comfortably robust in an operational sense |
| Delay exhausts remaining budget | Clear status that no positive planning time remains; frontier empty | Draw negative-radius circles or NaNs |
| Reserve exceeds remaining budget | All numeric target assessments fail time; separate data UNKNOWN where appropriate | Suppress the reserve or silently clamp the value |
| Science activity duration changes | Recompute target feasibility; **mobility-only** frontier need not change | Present science time as part of the movement-only frontier |
| Speed changes to `0.8×` | Recompute costs/margins; in uniform scaling model route geometry unchanged | Fabricate a new route line |
| User selects custom point | Generic hypothetical target, sourced terrain only, no invented science | Attach a real site name or biosignature claim |
| User toggles rover path | Clear distinction between actual rover track and modeled hypothetical human route | Treat rover velocity or travel difficulty as human-calibrated |
| No DEM/invalid DEM | Consciously switch to labeled distance-only mode **only if it is mathematically validated** | Keep showing grade heatmap or precise slope stats |
| A source is old/time-specific | Show observation timestamp and that conditions may have changed | Call historical observation “live conditions” |
| User repeats delays or drags rapidly | Stable bounded result, monotonic margin, no memory leak | Accumulate floating-point drift and inconsistent totals |
| Browser goes offline | Static assets still work locally; no third-party maps/fonts required | Show blank base map because tiles are remote |

The theme is simple: **make every failure legible**. Uncertainty and incompleteness are part of a serious scientific instrument.

---
# 11. Engineering rules for a six-person, AI-assisted build

The team is capable of moving fast with AI assistance. That only becomes an advantage if **humans lock the interfaces, science rules, visual system and acceptance tests before asking assistants to implement them**.

## 11.1 One authoritative instruction file

At H0, Kamel creates `AGENTS.md`, a short tool-neutral contract. Every teammate and assistant must read:

1. `AGENTS.md` — engineering, data and collaboration rules;
2. `DESIGN_SYSTEM.md` — **SESHAT-over-Astryx** theme, layout, typography, component anatomy, states, and verified CLI APIs;
3. the exact relevant `types.ts`/schema contract;
4. any human-owned oracle for that task;
5. the current GitHub Issue with acceptance criteria.

**Do not maintain five contradictory “AI rules” documents for five assistants.** Tool-specific files, if created, merely point to this shared authority. Because Antigravity, Codex, and Claude may have different context handling, each individual coding request explicitly includes the relevant read-first files.

### Non-negotiable rules

**Correctness**
- `strict: true`, no unexplained `any`, no silent `NaN`, no bare unit-less numeric types in scientific APIs.
- Scientific computation is in `pipeline/` and `src/engine/`, not scattered across React panels.
- Frontend numbers are formatted views of typed model outputs.
- The source ledger owns provenance; **no made-up NASA studies, values, citations or target coordinates**.
- `UNKNOWN` is a first-class answer, not an exception to suppress.
- The parent-pointer and analysis-grid contracts cannot be altered without integration approval and tests.
- The model is a scenario simulation. No model output may be called NASA-certified safety guidance.

**UI and product**
- **Astryx (`@astryxdesign/core`) is mandatory for shared conventional UI components.** Next.js 19+ React/Tailwind v4 integration follows §8.1A. Never scaffold shadcn as the foundation or duplicate Astryx controls locally.
- **Before writing a component, run the installed Astryx CLI** (`pnpm exec astryx component --list`, `... component <Name>`, `... docs tokens`) and use the documented API. No hallucinated imports, wrong variants, invented props or versions.
- No feature may create its own style system. All common colors, type and spacing derive from the **compiled SESHAT Astryx theme** and explicit scientific domain tokens.
- Do not change installed Astryx or its theme dependencies without Kamel/Ali review and a static-export/browser smoke test; Astryx is beta and the lockfile is deliberate.
- No decorative chart or statistic without a decision it supports.
- Important states have real loading, empty, failure, selected and keyboard-focus treatments.
- Screenshots at required viewports are part of visual review.
- Use original simple iconography, not a gallery of inconsistent outline icons.

**AI-generated work**
- AI can draft code, test cases, documentation, transformations and layout variants. Humans approve assumptions, official claims, numeric oracles, geospatial registration and merges.
- An AI assistant **may not modify oracle expected values** to make a test pass. Change oracles only when the human reviewer proves the previous result was wrong and records why.
- No AI assistant invents a source link or “validated” result; it can propose a candidate, not certify it.
- No unrequested library or framework adoption, folder restructuring, feature expansion or external API dependency.
- No secrets, private account tokens or paid API keys in prompts/repo.
- Keep a short, accurate `docs/ai-use.md` of material coding and content assistance; no pretending the project was entirely handwritten.

**Merging**
- Implement only the assigned files/interfaces; ask a core reviewer to approve cross-cutting changes.
- Every PR has a reviewer and passes the relevant fast tests. Integration PRs require Kamel or Ali.
- No one force-pushes to shared branches or changes exported binary contracts unilaterally.
- Once freeze begins, only scoped bugfixes merge; untested work is removed from the demo UI.

## 11.2 A lightweight but real task format

Use GitHub Issues as a shared task queue. One task contains:

```md
### Goal
One user-visible or scientific result, in one or two sentences.

### Existing contract
Links to the relevant type, source data, DESIGN_SYSTEM section, oracle.

### Files likely touched
...

### Acceptance
- [ ] concrete happy path
- [ ] concrete failure path
- [ ] unit or spatial validation
- [ ] screenshot, source entry, or other proof

### Reviewer
Kamel / Ali / Shams / Hams / Amr / Malak (appropriate domain)

### Handoff
What changed, what did not change, known limitations.
```

Issue labels: `science`, `data`, `engine`, `frontend`, `design`, `quality`, `pitch`, `blocker`, `freeze-fix`. **No second kanban bureaucracy.** WhatsApp handles urgent coordination; GitHub is the durable execution state. A single optional Notion command-center page can hold venue details, working links, blocked items and the presentation outline—**not a duplicate issue tracker**.

## 11.3 Parallel AI use without collisions

Kamel has access to Codex, Google Pro/Antigravity and a free Claude tier. Others' exact entitlements are unknown. Treat each as an interchangeable *implementation assistant*, not as the scientific arbiter.

**Design-agent source of truth:** the repo's pinned `AGENTS.md`, `DESIGN_SYSTEM.md`, installed Astryx CLI docs and reviewed component screenshot. Every UI task request includes the approved section and current component API, so separate agents do not invent inconsistent primitive systems. AI may generate custom maps or layouts; it must not silently substitute a generic shadcn dashboard.

**Suggested allocation by task, not vendor prestige:**

- Core integrator: review diffs, schemas, and integration failures; avoid one enormous prompt to generate the whole app.
- UI implementer: translate **approved** desktop composition and design tokens into components; screenshot and critique by humans.
- GIS implementer: write or explain reprojection and array processing **only against real file metadata**; verify outputs in independent tools/tests.
- Test implementer: expand cases around manually defined oracle values, invalid inputs, and invariants; human owns expected answers.
- Documentation assistant: format source notes and README; do not manufacture provenance or user-study results.

**Parallelism only across owned files.** A coding assistant modifying `types.ts`, `DESIGN_SYSTEM.md`, or dataset schemas must have a named human reviewer and coordinate with consumers before merging. Never run two sessions with competing full-app rewrites.

### Mandatory AI task preamble

```text
You are implementing one SESHAT GitHub Issue.
Read AGENTS.md, DESIGN_SYSTEM.md, the relevant TypeScript types,
and the human-owned oracle tests BEFORE editing.
For UI: use the installed @astryxdesign/core library, inspect its CLI docs
for every selected component, and comply with the SESHAT Astryx theme.

Allowed files: [list exact paths].
Deliverable: [single narrowly defined behavior].
Scientific sources: [authoritative links or declared scenario assumptions].
Acceptance: [observable cases and commands].

Do NOT:
- invent scientific or geospatial values;
- change exported types or source conventions without approval;
- modify expected oracle values;
- touch unrelated files;
- add UI panels, default gradients, shadcn/Radix/MUI replacements, invented Astryx APIs,
  new libraries, telemetry or fake metrics;
- introduce a runtime API or remote dependency;
- label a feature verified without proof.

Return a brief change summary, tests actually executed, and unresolved risks.
```

Never accept “All tests passed” as an agent claim without actually running the commands and checking the CI result. A screenshot generated by an agent is evidence of layout, not proof of scientific correctness.

## 11.4 Git and integration

Use `main` as the **demonstrable, deployable version** and `dev` for frequent integration; feature branches are short-lived. Kamel creates the repo, invites the team, and configures Vercel once H0 is authorized. Avoid locking yourselves into complicated CODEOWNERS policy that prevents a small hackathon team from merging under pressure.

Normal loop:

```text
Issue → feat/short-name branch → implementation → local verify
→ PR into dev → one appropriate human review → CI → merge
→ preview/test on integration site → release to main at accepted gates
```

Release tags: `g0-shell`, `g1-map`, `g2-engine`, `g3-counterfactual`, `demo-freeze`, `submitted`. Names should match actual passing states. **Do not mark a gate passed because code was written; pass it because evidence exists.**

At least one machine other than Kamel's must be able to check out and run the known-good demo branch independently.

## 11.5 Verification commands

Use a **fast iteration loop** and a **release loop**, not a heavyweight security pipeline in every commit.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "verify": "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build",
    "e2e": "playwright test",
    "audit:deps": "pnpm audit --prod --audit-level high"
  }
}
```

**This is a specification for the scripts to create at H0**, not evidence that these scripts already exist or run successfully. Pipeline tests are separate, for example `python -m pytest pipeline/tests`. Playwright E2E can be a separate release gate to avoid slow browser installation on every quick PR. Fix confirmed high-risk dependency and exposure issues before release. There is no need for mutation-testing infrastructure, DAST orchestration, a security dashboard, or an elaborate automatic “AI-slop score” in a two-day sprint.

**Environment:** project uses no public runtime secret. Pin dependency versions via lockfile. Never store auth credentials in `.env` committed to Git. Vercel deployment access is handled through repository integration and personal authorization—not shared passwords.

---

# 12. Team operating system

Six people, one common queue, domain accountability and fast rotation. Not six frozen job descriptions.

| Member | Persistent responsibility | Where they are most valuable | Natural backup/partner |
|---|---|---|---|
| **Kamel** | Technical integration and product-quality authority | Next.js shell, overall UI composition, deployment, contracts, merge/release | Ali for technical; Hams for design |
| **Ali** | Scientific calculation/engine integration, strong technical presenter | Directed path fields, feasibility, performance, Q&A, live demo | Kamel |
| **Amr** | Data and GIS build responsibility | Source ingestion, raster transforms, data exports, testing evidence | Ali for engine, Malak for provenance |
| **Hams** | Human visual quality and quantitative validation | UI critique with Kamel, design states, hand oracles, cold user observations | Kamel and Malak |
| **Shams** | Team/organizer interface and narrative authority | Rules, deadlines, meeting mentors, pitch, submission ownership, scope decisions | Ali for speaking, Malak for sources |
| **Malak** *(remote)* | Independent science evidence and cold quality checks | Target sources/locations, citation ledger, remote testing, submission link verification | Hams or Shams |

**Flexible tasks:** when a teammate has capacity, they select the highest-priority unblocked Issue matching their ability, post a one-line “taking this” in WhatsApp/GitHub, complete it, and nominate the suitable reviewer. The domain lead stays responsible for correctness, even if another teammate implements the task. Reviewers do not assign every tiny task in advance.

**Core decision group:** Kamel, Ali, Shams. For scope or feasibility disagreement, hear a concise case from the responsible teammate; two of three decide. At feature freeze **Kamel may veto a risky integration**; **Shams may veto a rule-incompatible submission/claim**. Science claims require Malak/Amr evidence review, regardless of enthusiasm. Do not turn this into a voting ceremony for trivial CSS or file naming.

### Shift coverage

Kamel, Ali and Amr are available for more continuous implementation, but **reliability requires actual sleep** and intellectual rotation. Technical strength does not make 48 hours without sleep sensible. Hams, Shams and Malak own substantial quality/compliance/presentation work throughout; no one is relegated to passive observation.

- Keep **one integrator on duty** during active merges/deployments, with another available for escalations.
- Arrange **staggered, real sleep blocks**; do not schedule both primary integrators asleep during a high-risk merge or judging.
- Maintain remote handoffs in `docs/decisions.md`, source ledger and Issues so Malak can operate without being physically in the room.
- Take food/water breaks without creating taskless dead time. A tired reviewer can miss coordinate inversions and misleading units.
- Treat the **five daily prayers** as explicit flexible operational anchors: consult local Cairo prayer times, make time and space for them, and rotate build/test/pitch coverage around them. No hour-by-hour minute schedule should imply that these obligations are optional.

### Communication shape

**WhatsApp:** status, immediate blockers, organizer alerts, shift coordination.  
**GitHub:** code, Issues, PR review, passing gates, machine-readable proof.  
**Notion (optional):** one command-center page linking to the repo, venue/clock, active gate, sources, submission page, deck.  
**Video/audio for Malak:** short remote check-in at major gates; she should be able to inspect the live preview and download the same project bundle.

A blocker message is concise:

> **BLOCKED: DEM alignment.** Current ortho and DEM differ in projection/extent. Checked source metadata and three test points; one fails. Need Amr+Ali for a 15-minute diagnosis. Until fixed, the route layer remains disabled.

A release message is evidence:

> **G2 ENGINE PASSED.** Source manifest revision `abc123`; 12/12 oracles; target verification screenshot; live URL checked; reviewer: Ali. Limitation: rover overlay still pending.

Never claim checks passed before running them.

---

# 13. Project work inventory

The following is the task pool—not an obligation to assign each item permanently. Pull the highest-impact unblocked task and respect the dependency graph.

| Workstream | Concrete task | Depends on | Proof |
|---|---|---|---|
| Rules | Establish H0 and official submission requirements | Organizer response | Evidence file + `event-brief.md` |
| Sources | Locate a **challenge-Resources-listed** NASA dataset | 2026 Resources page | Source ledger + visible use |
| Data | Inspect candidate Jezero raster/source metadata | Access to file | Metadata printout, checksum |
| Data | Fix Mars CRS/conventions and crop common grid | Source inspection | Raster corners and overlay check |
| Data | Compile valid mask and directional edge field | Aligned DEM | Unit + mask tests |
| Data | Compute from-base / to-base fields and pointers | Valid model graph | Oracle + profile comparison |
| Science | Verify target evidence + coordinates | PDS/NASA sources, grid | Two-person target review |
| Frontend | Next.js + pinned Astryx + Tailwind v4 + built SESHAT theme, static shell | Theme/component contract | Astryx CLI/init smoke, static export, screenshot at 1280×720/1440×900 |
| Map | Render accepted imagery/mask and target markers in Leaflet `CRS.Simple` | Fixed §5.3 grid transform, assets | Four-corner/route parity checks |
| Engine | Cost lookup, path reconstruction, scenario assessment | Grid/pointer contract | Hand oracle + finite output |
| UX | Target list, time strip, source drawer | Typed assessment/source schemas | Click-flow + accessibility check |
| UX | Frontier, +15 delay, Why changed | Cost fields + assessment | Invariant tests + exact reconciliation |
| Premium | Custom pin | Stable valid-mask and pointer arrays | On-grid and NoData E2E |
| Premium | Profile | Route geometry + DEM | Units and data-limit labels |
| Premium | Rover context | Validated PLACES track | Map overlay alignment and honest label |
| Quality | Realistic task study | Hero flow deployed | Raw observation log |
| Presentation | Five-slide demo + 30-second alternate | Real build screenshots | Links, not placeholders |
| Release | Static export, prod and offline checks | CI/build + data bundle | Fresh-browser and airplane-mode proof |
| Submission | Complete official project form | Current 2026 guide | **Submitted** confirmation |

**Critical path:** official authorization → qualifying challenge-listed source and real CTX/PDS access → an accepted **common coverage crop and base** → validated spatial grid and **point-verified** targets → positive-edge directional graph, two pointer trees and separate UNKNOWN topology → compiled manifest and viewer registration → hero UI/frontier/counterfactual → independent checks → submitted public deliverables. **Do not wait until H10 to discover the three named geology sites are too far apart for the chosen raster crop.**

**High-parallelism tasks:** brand/type spec, source gathering, science-target records, conceptual oracles, event compliance, skeleton UI and README after H0; these can proceed while raster processing is underway. **Do not** let a slow rover overlay block the core map/engine.

---

# 14. H0–H48 execution with proof gates

This is an **event-relative capacity plan**, not a claim that Cairo organizers authorized a specific number of hours. The clock and gates become operative only after **C0**. Real prayers, meals, rest and the organizer's pitch slots are inserted into the phase windows; do not micro-schedule minutes.

## H0–H4 · Foundation and scientific truth

**Concurrent work:**

- Kamel and Ali: create repo/branches, shared coding rules, Next.js static shell, types, first CI smoke, Vercel deployment and `seshat.kmls.dev` DNS, empty working layout.
- Hams and Kamel: approve the SESHAT-over-Astryx theme and one actual screenshot of the library inside the planned workbench. Hams writes first human numerical oracle fixtures.
- Amr: download/inspect the **published ~9.3 MB CTX 20 m DTM first**; print native CRS, cell size, bounds, NoData and sample values; retrieve metadata for a matched ortho independently; start an accepted bounded crop. Do not assume the file proves the overlap.
- Malak: retrieve **PDS PLACES `best_interp.csv` plus its PDS4 XML label**, inspect field/coordinate conventions, identify observation/pose relationships, and build target evidence without mislabeling rover poses as exact sampled-rock coordinates.
- Shams: record organizer H0/local pitch, current NASA guide, Resources-list qualification, license/submission requirements and expected judge presentation format.

**Astryx UI foundation checkpoint at H3:** installed and pinned Astryx components render in the live Next.js app, the Tailwind v4 layer bridge resolves styles, the original SESHAT theme is built and applied, focus/keyboard checks pass, and Kamel + Hams approve a real workbench screenshot. Any missing advanced Astryx control becomes a documented small custom composition—not grounds for a wholesale library switch.

**G0 / H4: allowed to proceed only if**

- [ ] Authorized build start is documented.
- [ ] A Next.js URL loads with original design tokens and a meaningful no-data shell.
- [ ] Static build and local build paths are demonstrated.
- [ ] The real CTX 20 m DTM is downloaded/read **or** a documented authoritative alternative is selected; native CRS/vertical units/NoData are understood; target-crop feasibility is checked.
- [ ] At least one official challenge-Resources NASA input is identified for material inclusion.
- [ ] Target locations remain honestly marked pending, not invented.
- [ ] `AGENTS.md`, types and source ledger have one owner and are accessible to all.

**If data gate is failing:** choose a smaller verified crop / accessible official alternate *now*. Do not spend H4–H16 designing around a synthetic dataset.

## H4–H10 · One mapped, source-backed route

Amr owns grid alignment and compiler; Ali develops directed costs and pointer trees; Kamel connects real imagery to map and map transforms; Hams checks route arithmetic; Malak locks candidate target evidence. Shams prepares submission content and checks local judging instructions.

**G1 / H10:**

- [ ] Imagery, DEM/valid mask and displayed overlay share a proved map transform.
- [ ] ≥2 **geolocation-verified points or explicitly identified rover-pose proxy locations** are inside the accepted common coverage; regional-only candidates are kept as non-routeable science context and never receive invented precise times.
- [ ] The map actually displays two or more useful NASA mission/sensor contexts with sources.
- [ ] One actual point-verified target has computed **base→target** and **target→base** paths with two correctly interpreted pointer trees; they are visually distinct **if real model costs actually select different geometry**, not forced apart for aesthetics.
- [ ] At least one route's distance, model time and terrain profile reconcile with independent checks.
- [ ] NoData is neither falsely traversable nor silently categorized as known danger; the **permissive-connectivity** test distinguishes data absence from confirmed scenario blocks.
- [ ] A screenshot looks like a coherent product, not default library scaffolding.

**Escalation:** if DEM cannot be verified at H10, use a **truthfully labeled distance-based time model** on a verified ortho/context map. Disable slope-related claims and visuals. Retain real science targets, provenance, frontier, time budget and counterfactual; a reliable, honest system is preferable to fake “terrain awareness”.

## H10–H16 · The complete decision engine

Build target comparisons, fixed-base shortest-path fields, route/profile lookups, budget/reserve assessment, speed scenarios, four states, frontier renderer and source/assumption inspection. Integrate frequently to `dev`; do not let engine and UI drift into incompatible data formats.

**G2 / H16:**

- [ ] Three documented opportunities displayed with status and provenance.
- [ ] Target cards show the exact outbound/science/return/reserve accounting.
- [ ] Frontier is computed from base-to-cell **plus cell-to-base**, not a radial mask.
- [ ] `0.8×`, `1.0×`, `1.2×` valid-route results are finite and classified correctly from **unrounded Float64** fields; infinity/NoData produces UNKNOWN or validated hard-block status.
- [ ] `UNKNOWN` overrides unsupported numeric results.
- [ ] Delay monotonicity and route-pair oracles pass.
- [ ] Map and target list remain responsive when sliding time.

## H16–H22 · The signature moment

Build the +15-minute action, state transition, Why changed audit, before/after explanation, and keyboard/mouse flow. Use a **declared scenario budget** for the real validated routes so that the delay changes a meaningful target state; retain real computed travel numbers. Connect source links inside the resulting target card.

**G3 / H22:**

- [ ] One judge can complete **objective → target → route → +15 delay → changed state → Why changed → evidence** without coaching.
- [ ] Changing time never expands frontier or improves margin.
- [ ] Why changed numbers match the engine to defined rounding tolerance.
- [ ] Before/after visual change is perceptible, restrained and free of layout shift.
- [ ] User can tell what is real observation versus scenario assumption.
- [ ] A fresh browser can reach the experience on the deployed preview.

**The product is already a serious competition entry if G3 passes.** The remaining hours are for depth, polish, corroboration, user evaluation and delivery—not for replacing it with an unrelated project.

## H22–H28 · Premium interaction

Build and validate the custom-pin inspector, profile strip, better layer/source inspection, semantic state polish and optional rover geometry. Invite at least one technically capable non-builder to attempt the hero workflow cold. Optimize source bundle size and map redraw if necessary.

**G4 / H28:**

- [ ] Custom pin works on covered cells and explicitly fails on unknown ones.
- [ ] Grade/elevation profile is real and aligned, or absent in distance-only mode.
- [ ] Rover overlay is authentic and aligned **or hidden** with no fake substitute.
- [ ] Every interactive control has correct focus, loading, error and empty states.
- [ ] Three workbench viewports have undergone screenshot review.
- [ ] One independent user task run has produced actual observed findings (or is documented as not yet completed).

## H28–H34 · Prove it and prepare the actual pitch

Conduct adversarial source/coordinate review and cross-check the route fields, budget outputs, source references and rights. Run representative planning tasks with 3–5 people if they are available; never invent participants. Shams and Ali rehearse the storyline with the actual, not speculative, states. Kamel and Hams audit typography, source drawer and map legibility. Prepare the official demo candidate and a short recording.

**G5 / H34 — protected feature freeze:**

- [ ] Real data pipeline and provenance manifest are coherent.
- [ ] All critical numeric oracles pass; E2E hero flow passes.
- [ ] Known source limitations appear in the app and README.
- [ ] Production and local static builds demonstrate the same dataset revision.
- [ ] At least one complete rehearsal has shown the actual state transition.
- [ ] The remaining unfinished features are **removed from the release UI**.
- [ ] Release authority announces **FEATURE FREEZE** on WhatsApp/GitHub.

**After H34: no new user-facing features.** Exceptions only for defects preventing correctness, eligibility, accessibility or demo reliability. A “great extra idea” is not a freeze exception.

## H34–H40 · Presentation-grade refinement

- Kamel + Hams: typography, restrained animations, map contrast, marker/label overlap, errors, 1280×720/1440×900/external display behavior.
- Ali: final performance, route pointer safety, numerical consistency, demo operation.
- Amr + Malak: final source audit, target geometry, licenses, place-name claims and validation ledger.
- Shams: submission copy, deck, venue schedule and Q&A. Practice a version without live internet.

**G6 / H40:** live and local builds are visually presentable, sources are traceable, no critical console errors, demo deck/video accurately shows shipped features, and submission fields are drafted.

## H40–H44 · Delivery, not feature building

- Publish a stable, read-only tagged release in `main`.
- Public repo with license, README, citations and reproducibility instructions.
- Production at `seshat.kmls.dev` and working offline static server on **Kamel and Ali's machines**.
- Final five-slide official demo candidate and ≤30-second alternate, plus separate ~90-second local backup recording.
- Test links in incognito; verify file-sharing permissions, correct link targets and no-login operation.
- **Submit to NASA well before its published deadline and before any earlier local requirement.** Capture the status. Do not wait for H48 if the event closes sooner.

**G7 / H44:** all final links, media, and submission inputs are verified and the platform reports **Submitted** (or the official earliest required submission time has already forced completion sooner).

## H44–H48 · Stress-free judging margin

No feature work. Three rehearsals: standard pitch; interruption/Q&A; simulated internet failure. Verify from a second machine. Make only conservative emergency fixes. Keep backup media local and the production tag intact. Confirm the final venue/projection arrangement, team members' speaking transitions, and the source/assumptions disclosure answer.

## 14.9 If the real work window is shorter

Write the true available implementation window as `T_available = min(actual organizer authorization-to-freeze window, global/local cutoff)`, excluding required submission buffer. **Do not try to fit H48 into a 35-hour event by compressing sleep to zero.** Preserve the sequence of proof gates and compress the *calendar* as follows:

| Priority | Relative to available build capacity | What must be completed |
|---|---|---|
| First 10% | Start and source qualification | C0, C1, repo, real-data metadata |
| ~25% | Accepted map and first real route | G1 |
| ~45% | Core feasibility/frontier | G2 |
| ~60% | Hero counterfactual | G3 |
| ~75% | Premium items only if unblocked; validation starts | G4 / start G5 |
| ~80–85% | Hard feature freeze | G5 |
| Final 15–20% | Polish, pitch, offline/links, submission buffer | G6–G7 |

Cut in this order **only if necessary**: extra objective → optional rover analysis (keep verified overlay if easy) → elaborate route comparison → fancy transitions → custom pin if unreliable → elevation profile if data invalid. **Never cut** official data eligibility, geospatial truthfulness, reserve/return accounting, counterfactual explanation, source/assumptions visibility, numerical tests, public submission, or the offline fallback.

---
# 15. Validation: prove the system without pretending it is flight-qualified

Testing has three different objects of proof. **Unit/oracle tests** prove the arithmetic or graph algorithm for chosen inputs. **Geospatial checks** show the real data is being interpreted as intended. **Task tests** show that people can understand a choice and its caveat. None of these, individually or together, prove astronaut-route safety.

## 15.1 Human-owned numerical and graph oracles

Write expected results **by hand first**; then run the implementation against them. A failing test means investigate either code or the original hand calculation; it does not authorize an AI assistant to quietly rewrite expectations.

| ID | Check | Fixture | Required conclusion |
|---|---|---|---|
| O01 | Additive budget | Out20 + science10 + return20 + reserve15, B80 | Required65, margin+15, nominal feasible |
| O02 | Exact boundary | Same, B65 | Margin0, still numerically feasible |
| O03 | Shortfall | Same, B64 | Deficit1, infeasible at nominal |
| O04 | Delay | B80, required75, then delay15 | Margin+5 to −10 |
| O05 | Scenario robust | Out20/return20, science10, reserve15, B80 | Conservative75; nominal65; fast58.33 → ROBUST |
| O06 | Scenario marginal | Out26/return26, science10, reserve15, B80 | Conservative90; nominal77; fast68.33 → MARGINAL |
| O07 | Scenario infeasible | Out40/return40, science10, reserve15, B80 | Conservative125; nominal105; fast91.67 → INFEASIBLE |
| O08 | Unknown precedence | Feasible-looking numbers, but target mask=UNKNOWN | UNKNOWN without numeric recommendation |
| O09 | Flat graph | 3×3 constant elevations, equal edge cost | Symmetric base→target and return, valid shortest path |
| O10 | Detour | Known blocked center on a small grid | A legal route avoids the blocked cell; correct sum |
| O11 | Missing-data barrier | Grid bisected by unknown cells | No fabricated bridge; route UNKNOWN |
| O12 | Directional grade | Single edge rising from u→v | `t_uv` differs from `t_vu` if asymmetric grade penalty active |
| O13 | Speed scaling | Same path, speed factor changes only | Nominal travel / factor; geometry unchanged |
| O14 | Pointer safety | Out-of-bounds, cycles, SciPy `-9999`→`-1`, root and valid index `0` | Clean invalid/unknown response; no infinite loops |
| O15 | Frontier time monotonicity | Fixed costs, reduce B | New frontier is a subset of old frontier |
| O16 | Reserve monotonicity | Fixed costs, increase reserve | No feasibility improvement |
| O17 | Science-time monotonicity | Increase activity duration | Target never becomes more feasible |
| O18 | Round-trip consistency | Known path and reverse | Out + science + return + reserve equals result object |
| O19 | UI reconciliation | Delay changes target state | Target card and Why changed show identical inputs/result |
| O20 | Data-manifest integrity | Wrong checksum / grid revision / byte length / mixed export | Dataset rejected, not silently rendered |
| O21 | Map transform | Cell `(0,0)`, `(H-1,W-1)`, corners, click inverse and route using Leaflet `[H-row-.5,col+.5]` | Exact integer cell recovery; no vertical mirroring |
| O22 | Real data sanity | Accepted DEM crop, route and target overlays | Documented native CRS, realistic values, common measured coverage, no unreviewed NoData filling |
| O23 | Data-vs-constraint distinction | Unknown barrier with a theoretical permissive path vs fully hard-blocked corridor | UNKNOWN in first case, INFEASIBLE in second (if hard-block data validated) |
| O24 | Binary fidelity | Four-node asymmetric graph, `<f8`/`<i4`, `+inf`, file lengths, valid node 0 | Correct forward cost, return cost, pointer chain and sentinel normalization |
| O25 | Target precision | `APPROXIMATE_REGION` marker vs verified PDS position | Approximate never yields spurious route feasibility; verified point eligible only after alignment review |

In particular, **O07 is deliberately infeasible at even the fast scenario** (`80/1.2 + 10 + 15 ≈ 91.67 > 80`). **O05's conservative total** is `40/0.8 + 10 + 15 = 75`. Keep these checks literal. Where an actual path contains ambiguous terrain data, the system must return `UNKNOWN` rather than relying on a synthetic numeric fixture.

## 15.2 Property/invariant tests

Use a small targeted generative suite. Monotonic statements apply only **holding all other inputs and the data revision fixed**:

- `elapsed ↑` → `remaining ↓`, margin does not improve, and movement frontier never expands;
- `reserve ↑` → target feasibility cannot improve;
- `scienceActivity ↑` → target feasibility cannot improve;
- `speedFactor ↑` with all edge costs scaled uniformly → travel time cannot increase;
- all three speed scenarios feasible → state ROBUST;
- exactly one/two feasible → MARGINAL;
- none feasible with sufficient data → INFEASIBLE;
- any required unknown input → UNKNOWN;
- straight flat graph without directional penalties → out/return symmetry;
- route reconstruction never enters a `0` validity cell or loops through a parent cycle;
- the sum in UI explanatory copy matches the underlying typed assessment within the rounding policy.

Do not bolt on heavyweight mutation testing or a hundred arbitrary properties. Concentrate on invariants whose failure would visibly invalidate the mission decision.

## 15.3 GIS tests and independent inspection

Amr runs Python-side tests, Ali reviews at least one exact route/time, Malak reviews evidence provenance, Hams checks demonstrated units and UI copy. Required checks:

1. Source CRS/convention/units are not missing or defaulted to Earth.
2. All assets in a revision share width, height, grid transform and expected hashes.
3. Real data has variation where expected; NoData counts and coverage are explicit.
4. A source rover/location point falls where the imagery claims it should, or the difference is recorded and resolved.
5. A geographic target cell corresponds to the documented site/region, not a visually convenient coordinate.
6. Elevation and derived grade profiles agree with sampled raster cells along the chosen route.
7. Base-to-all and reverse-to-base fields agree on selected sampled target costs with independent shortest-path runs.
8. Coarsening the grid changes path-time estimates in a documented way; do not claim precision finer than the analysis grid.

**Traceability evidence:** include `docs/validation.md` with dataset revision, tested command, real test count, PASS/FAIL, screen capture and named human reviewer. **Never write “8/8 passed” or “60 FPS achieved” unless the current implemented code produced that measured outcome.**

## 15.4 End-to-end interaction smoke tests

| E2E | Task | Failure that matters |
|---|---|---|
| E01 | Open production fresh, no cookies | Blank site, runtime 404, remote tile/font dependency |
| E02 | Change objective and select target | Marker/list mismatch, no source link |
| E03 | Read route and budget breakdown | Wrong units, invalid return value, `NaN` |
| E04 | Press +15 and open Why changed | State copied from fixture, sum inconsistent, no frontier update |
| E05 | Change speed scenario | Route/label/calculation contradict each other |
| E06 | Select custom covered pin | Route not computed, no generic-science caveat |
| E07 | Click outside valid coverage | Fake route or missing UNKNOWN state |
| E08 | Open provenance drawer | Broken source links, invented source fields |
| E09 | Browser resize and keyboard controls | Clipped panels, inaccessible primary action |
| E10 | Run local `out/` build without internet | Missing imagery/font, JS chunks not found |
| E11 | Corrupt or remove a data file in a test build | Silent wrong metrics rather than clear error |
| E12 | Open submitted project, demo and repo links in incognito | Requires login, wrong branch, stale demo |

Use Playwright for the crucial deterministic flow; use human screenshot reviews for visual hierarchy. A single passing unit test does not prove the map is actually registered correctly.

## 15.5 Realistic task-based usability evaluation

**No fictional astronauts, no fake expert interviews.** Find 3–5 accessible reviewers if circumstances allow: a technically informed visitor, a hackathon mentor, someone with GIS/science background if available, and/or non-building teammates for cold tests. Label each reviewer's type accurately. Do not overgeneralize from tiny convenience samples.

Give them four tasks *without teaching them the interface*:

**Task A — choose.** “You have a stated science objective, a 105-minute planning budget and a required return reserve. Which target would you attempt conservatively, and what evidence supports it?”

**Task B — react.** “A 15-minute delay occurs. Which target changes state? Which alternative is still available and why?”

**Task C — qualify.** “Find the source and scale of the terrain used for this route. Can the app tell you about individual small rocks or astronaut life-support consumption?”

**Task D — explore.** “Place your own study point. Is it supported as a real named science location, or is it hypothetical?”

Record the actual `dataset revision`, task completion (yes/no), wrong first selection, time to correct result, whether the person noticed uncertainty, a verbatim comment, and what UI change resulted. A defensible reporting statement looks like: **“In a five-person convenience test, four selected the remaining robust target without prompting.”** Only write that if the log proves it. Do not claim that these users represent trained mission planners.

### Release quality thresholds (team targets, not scientific measurements)

- Initial visible app on venue hardware feels responsive and progressively reveals data state; aim for **<3 seconds** on a warm local/static build, but log actual hardware/network.
- Delay-state and target-card changes feel immediate; aim for **under 300 ms** under normal interaction, subject to testing and raster size.
- No material console errors or broken source links on the submitted production build.
- No unknown numeric values displayed as zeros.
- At 1280×720 and 1440×900, the hero flow remains usable without unnecessary page scroll.
- The important source/assumption distinctions can be discovered without opening the README.
- At least one person who did not build the relevant feature can complete the core flow cold.

These are **acceptance targets**, not claimed benchmark results. Log the measured outcome if achieved.

---

# 16. Deployment, fallback, and reliability

**Public:** `https://seshat.kmls.dev` on Vercel. DNS is managed from Kamel's Cloudflare account. The source repository is public before final submission. Build outputs are immutable enough that a source revision and recorded screenshots can be reproduced.

**Local backup:** place a tested static export and its data on **Kamel's M4 Pro MacBook** and **Ali's ThinkPad**. Both have Docker, but the UI should not require Docker just to serve static files.

```bash
# On either laptop, after a successful Next.js static build:
npm run build
python3 -m http.server 4173 --directory out
# Open http://localhost:4173
```

On Linux or macOS with Python installed, this serves local files with no package install at judging time. **Test the actual route and asset paths on this server in advance**; do not assume that a dev-only Next feature works in export mode.

**Backup hierarchy:**

1. Live production app at `seshat.kmls.dev` on venue Wi-Fi.
2. Same live app over Kamel's or another teammate's hotspot.
3. Known-good local export on Kamel's machine.
4. Known-good local export on Ali's machine.
5. **Local** ~90-second recorded hero demo with sources and exact scenario, independent of the browser.
6. Local slide deck/PDF-like display copy as last-resort narration support.

The backup must have **the same manifest and known-good values** as the submitted presentation. Never show a nicer but scientifically unverified older demo if the production app could not support its claims.

### Release sequence

At G5, merge/tag the accepted revision. Deploy a preview to production, load in a private browser, click every critical control, verify resources and source URLs, verify domain/TLS, download offline bundle, and rehearse. Preserve the previous known-good tag. Any late hotfix takes a separate reviewed commit and a fresh smoke test. If a new deployment fails, revert to the stable release rather than gambling with live judging.

### Security and rights basics

No login and no server reduces the attack surface but does not eliminate copyright, supply-chain, dependency and browser-rendering issues. Run a dependency audit, avoid unsafe HTML rendering for source excerpts, sanitize any user-controlled permalink text, keep third-party media local only when reuse rights are clear, and ensure source links are normal external links. No user analytics or hidden tracking is necessary for this project.

---

# 17. Presentation and official submission

## 17.1 Live pitch ownership

**Shams** delivers the problem and conclusion. **Ali** drives the live app and explains the model. **Kamel** is the technical backup, monitors production/local readiness and can answer architecture. Hams, Amr and Malak contribute evidence, screenshots and preparation; do not overcomplicate the speaking rotation.

The pitch must match **the actual judging time allocated**, which Shams records from the venue. The sequence below is modular: shorten or lengthen the live interaction, not the truthfulness of the method.

### Suggested 2½–3-minute narrative

**Opening (Shams, ~20s)**

> On Mars, losing fifteen minutes can change more than the schedule. It can change which scientific stops are still reachable **and returnable**. SESHAT makes that consequence visible on the map.

**What is real (Shams, ~20s)**

> We combined orbital terrain and imagery with Mars 2020 evidence for documented sites in Jezero's delta. We know where the data comes from, its scale, and what it cannot tell us.

**How the decision works (Ali, ~30s)**

> For each target we add the modeled outbound traverse, science activity, return traverse, and a planning reserve. We repeat the calculation at three explicit movement-speed assumptions. The status is sensitivity to these assumptions—not a safety probability.

**Hero action (Ali, ~45s)**

1. Show the three target opportunities and select one.
2. Point to the route and time strip.
3. Press **+15 min delay**.
4. Let the frontier contract, show the changed state.
5. Open **Why changed** and reconcile the actual numbers.
6. Show the strongest remaining feasible alternative.

**Trust (Ali or Shams, ~25s)**

> Here is the source of the elevation, here is the observation linked to this science target, and here is a variable clearly marked as a scenario assumption. Where our map lacks coverage, the tool says UNKNOWN instead of making a route up.

**Close (Shams, ~20s)**

> SESHAT does not certify an astronaut path as safe. It gives planners a transparent way to compare scientific opportunity, time, terrain, returnability and uncertainty—and understand why a mission plan should change.

All bracketed data or margins should be taken from the shipped build. Avoid scripted numerical claims that no longer match the release.

## 17.2 Five-slide official demo candidate

**Slide 1 — The constraint.** A single real map crop and the line: **“Every minute changes the science you can still bring home.”** Small SESHAT wordmark and challenge subtitle. No cluttered institutional-banner opening.

**Slide 2 — The evidence.** One site map, named missions/instruments and three documented science targets. Distinguish actual NASA observations from scenario-defined base and time assumptions.

**Slide 3 — The model.** One mathematical line: `outbound + science activity + return + reserve ≤ remaining time`, plus `0.8× / 1.0× / 1.2×`. One small visual indicating outbound and return differ when direction matters.

**Slide 4 — The decision change.** Real before/after screenshots from the same dataset and scenario. Target-status and frontier difference should be obvious without reading paragraphs.

**Slide 5 — The evidence of validity.** Source names/links, passing test classes and a short “what this does not claim” section. End with the public tool URL and a serious next-step trajectory.

Do not repeat the whole live interface as slides. One point per slide, large enough for presentation projection. Use original data visualizations and properly attributed NASA imagery. English is the safest global-submission language; include subtitles if any demo recording uses Arabic.

## 17.3 Two different recordings

- **≤30 seconds** — the official demo **alternative** if 2026 confirms the prior slide-or-video limit. Use only the core decision: problem → map/target → +15 → changed state → source/limitation. Must not require the judge to scrub through a longer video.
- **~90 seconds** — fuller local/offline fallback and team sharing, **not** the official restricted-format demo if the limit remains 30 seconds.

Record at actual app resolution. No invented UI cutscenes, fake interaction composites, prerecorded results falsely called live, copyrighted music, or AI-generated NASA-looking visuals without the correct disclosure.

## 17.4 Project page copy direction

**Public headline:** “SESHAT — Time-aware science opportunity mapping for Mars traverses.”

**Short summary draft:**

> SESHAT is a research prototype that combines traceable NASA/USGS Mars terrain and science observations into a map-based decision tool for hypothetical crew surface traverses. A planner chooses a documented scientific target, inspects modeled outbound and return travel, adds science activity and a return reserve, and sees how the viable region and target recommendations change with time. A fifteen-minute delay can remove an opportunity; SESHAT explains precisely why. Three declared movement scenarios and explicit UNKNOWN states make uncertainty visible rather than disguising it as safety certainty. The product is not flight-qualified navigation.

**Methods field:** link source ledger, GIS preprocessing, directional grid model, pointer-tree reconstruction, feasibility rule, tests and assumptions.  
**Use of NASA data:** list exact **2026 challenge-Resources item** and additional NASA missions/datasets actually used.  
**Use of AI:** disclose the actual coding, editing, research and design assistance; the scientific route engine remains deterministic.  
**References:** source URLs, license/credit for images/fonts/frameworks, relevant research, original content license.

## 17.5 Final submission matrix

| Item | Owner for last check | Must prove |
|---|---|---|
| Official Space Apps team | Shams | Correct challenge, exactly six eligible/registered participants |
| Team project page | Shams | English summary/details filled, links valid, all required fields complete |
| Final code and runtime | Kamel / Ali | Public repo and no-login app; correct release tag; tested data revision |
| Official demo link | Shams / Hams | Correct ≤7-slide deck or ≤30s alternative **if 2026 confirms those limits** |
| Source and license references | Malak / Amr | Every significant input cited, including NASA-listed resource, code and media |
| Scientific wording | Malak / Ali | Assumptions, UNKNOWN and no-safety-certification caveat accurate |
| AI disclosure | Kamel / Shams | Actual tool use and generated assets described as required |
| Visual/media rights | Hams / Shams | No unlicensed media, no NASA endorsement implication |
| Offline package | Kamel / Ali | Two independently bootable copies of same release |
| Official confirmation | Shams | Site states **Submitted**, proof/screenshot captured before earlier deadline |

**Hard rule:** a finished GitHub repo is **not** a submitted NASA project. “Saved draft” is **not** “Submitted.” Verify the portal status and external links. NASA's global ceiling is **15 November at 23:59 local time**, but Cairo may impose an earlier pitch/submission checkpoint [R01, R03].

## 17.6 Judge Q&A: prepared, candid answers

**Q: Does this tell astronauts which path is safe?**  
A: No. It is a research planning prototype, not an operational safety tool. We calculate a bounded returnability and activity-time decision under explicit movement and reserve assumptions. It does not model unseen hazards, life-support consumption or flight qualification.

**Q: Which data came from NASA, and did it affect the answer?**  
A: Show the exact qualifying challenge-Resources NASA source, the orbital DEM/ortho input, mission/instrument metadata, raster revision and one site observation; explain the effect of the real terrain and route geometry on estimated travel time.

**Q: Are the target coordinates precise?**  
A: Only if the recorded PDS/map-feature source and independent spatial alignment check justify that precision. Otherwise the UI labels a site as an approximate regional target or excludes it from exact routing.

**Q: Where does the walking speed come from?**  
A: The reference value and grade response are *planning assumptions*, not NASA-calibrated Mars suited-walking laws. That is why SESHAT displays three sensitivity cases and the underlying equations.

**Q: Did you build a new Mars Trek?**  
A: Mars Trek and NASA planetary map portals provide important mapping context. Our central contribution is the **live, science-aware, time-constrained decision**: outbound + activity + return + reserve, a shrinking movement frontier, and an audit of changed opportunities.

**Q: Why does your frontier differ from the target list?**  
A: The frontier is the set of points that are returnable given the movement/reserve model; a scientific target also needs on-site activity time and verified evidence. The UI labels that distinction.

**Q: What if the astronaut walks slowly or the terrain data is missing?**  
A: We compute 0.8×/1.0×/1.2× scenarios. Unverified coverage yields UNKNOWN; we do not interpolate a fictional safe path.

**Q: Why is the rover route different?**  
A: It is a contextual record from a robotic mission with different mobility and mission requirements. We do not directly compare raw rover times to a suited human without a calibrated shared model.

**Q: What did AI do?**  
A: It assisted code generation, review and documentation under human-defined contracts and independent checks. AI did not provide a physics oracle or scientific data source; all scientific assertions and measurements are traceable.

**Q: Did users validate it?**  
A: State exactly who tested what, the number of tasks completed, raw confusion points and improvements. If no external task test was completed, say so. Do not claim astronaut validation.

**Q: What would be next with more time?**  
A: Validate mobility coefficients with human-factors/EVA studies, better terrain and risk layers at appropriate resolution, more science targets, mission operations feedback, environmental data with timestamps, and domain-expert validation—not a premature “production astronaut safety app.”

---
# 18. Risk control and controlled substitutions

A credible global entry should demonstrate graceful reduction of **unsupported claims**, not a collapse into a toy app when a source is missing.

| Risk | Early trigger | Immediate action | What stays true |
|---|---|---|---|
| **Earlier local start not expressly authorized** | No written H0 approval | Ask organizer; follow latest binding Global Organizing Team instruction, no premature project code | Eligibility before output volume |
| **Official challenge source omitted** | Selected DEM/portal not actually in Resources | Incorporate a listed NASA resource materially; log usage in source ledger | Global eligibility proof |
| **DEM download, missing imagery, or no target overlap** | Source URI down, huge ortho, crop excludes sites | Try catalog-listed 9.3 MB CTX DTM first; inspect ortho separately; switch common-coverage crop/sites or published Jezero mosaic; last resort clearly labeled distance-only mode | No fabricated geometry or false DEM resolution |
| **Projection/longitude mismatch** | Overlay landmarks visibly displaced | Stop routing; inspect native reference systems; validate transform against points | Spatial honesty |
| **Target cannot be geolocated** | H10 no point/observation-to-sol link | Use approximate-region status as **nonrouteable** science context or substitute better-recorded site | Evidence confidence displayed |
| **Source layers do not overlap** | Common coverage excludes targets | Reduce study area or choose sites within actual overlap | No invented alignment |
| **Rover track lacks verifiable alignment** | H18/handover still uncertain | Hide overlay, retain orbital and scientific sources | Hero flow independent of rover |
| **Directional walking model too speculative** | Literature/data cannot justify claimed coefficient | Label coefficients as scenario assumptions; validate math; use symmetric distance fallback where necessary | No false Mars physiology |
| **Route-pointer corruption or precision mixup** | Cost/pointer mismatch, binary byte count wrong, index zero mistaken for false | Reject bundle; use `<f8` costs, `<i4` pointers, `-1` sentinel and independent path-sum tests | No fake trajectories |
| **Frontier renderer too slow** | Interaction stutters on venue laptop | Reduce render sampling/mesh resolution; cache base fields; move drawing to lightweight canvas | Time geometry remains derived |
| **Leaflet grid orientation / image parity** | Route markers are vertically flipped or offset | Test §5.3 `H-row-.5, col+.5` mapping and north-up export; do not patch with arbitrary offsets | Analysis metric CRS intact |
| **Too many UI panels** | Cold task runner misses decision or reserve | Collapse secondary content into evidence drawer and trim decorative metrics | Map and critical arithmetic remain central |
| **Demo +15 changes no target** | Validated scenario has large margins | Select a *declared* different budget consistent with real computed times | Never forge route times |
| **User-created location shows science certainty** | Custom pin inherits a source-backed target label | Different source status and component treatment; block release | No invented science |
| **AI changes scientific data** | Diff includes unexplained values/source IDs | Block merge; require source/hand calculation | Humans own scientific truth |
| **Remote teammate blocked** | Malak cannot access repo or live preview | Publish stable preview and short recorded handoff; prioritize asynchronous source reviews | Independent evidence check continues |
| **Venue internet fails** | Live app or DNS unreachable | Hotspot, then local export from two laptops, then local video | Judge sees same data revision |
| **Exhaustion/integration churn** | Repeated failed reviews, late conflicts | Stagger actual sleep, narrow merges, enforce H34 freeze | Quality over frantic feature count |
| **Submission portal or local cutoff differs** | Organizer announcement / 2026 guide | Use earlier deadline, finish early, capture confirmation | Eligibility not sacrificed for polish |

### Non-negotiable floor under adverse conditions

The **strongest truthful fallback** is still a polished **NASA-source-backed map** with documented science targets, a reproducible time budget/round-trip model, a correct shrinking *modeled* frontier, clear sensitivity labels, explanation and source ledger. If terrain isn't verified, the frontier must be explicitly **distance/time-model based**, and slope-related UI disappears. It is not acceptable to keep the visual claim “terrain-aware” after the terrain gate fails.

### Go/no-go questions at each release

- Can a reviewer reproduce the numbers, or are these attractive placeholders?
- Is the exact real source identifiable and relevant to the decision, or is it decoration?
- Does the app have an honest answer for a missing target, source, or route?
- Can it be explained in one sentence without vague AI claims?
- Does the new feature make the first 30 seconds clearer, or does it increase the cognitive load?
- Can the known-good version still be run offline and submitted right now?

If the answer to the last question becomes “no”, stop adding features and restore the release path.

---

# 19. Definition of done: the competition-grade release

SESHAT is considered **ready for judges** when all of these statements can be demonstrated from the submitted release, not merely asserted in a plan.

**Scientific and data truth**

- [ ] Official 2026 challenge-Resources NASA data source is included and materially used.
- [ ] The displayed study region is derived from actual accepted Martian data with a source/coordinate record.
- [ ] Multiple mission observations inform the map and target evidence.
- [ ] Three science candidates are source-linked; point precision is honestly qualified, and only aligned verified points/proxies are routeable. Regional sites are science context, not fabricated precise targets.
- [ ] Source raster, route geometry, map overlays and elevations share a validated spatial contract.
- [ ] Missing data produces UNKNOWN, never a fabricated safe path.
- [ ] All model parameters that are not actually supported are labeled **Scenario assumption**.
- [ ] No “NASA-certified walking model”, astronaut-safety or biosignature-detection claim appears.

**Product and interactions**

- [ ] One excellent objective→target→route→delay→state→reason→evidence workflow can be completed cold.
- [ ] Outbound, on-site science, return, reserve and remaining margin reconcile.
- [ ] `0.8×`, `1.0×`, `1.2×` sensitivity classifications are derived and explained correctly.
- [ ] The frontier is computed from time/return cost and its **movement-only scope** is visible.
- [ ] The 15-minute counterfactual changes a state in a transparently chosen real-data scenario.
- [ ] Custom pin, profile and rover context are shipped only when valid and polished; incomplete modes are hidden.
- [ ] Source drawer shows citations, resolution, observations, transformations, and limits.

**Design craft**

- [ ] The map is the visual center, not a background for cards.
- [ ] Layout, type, spacing and color feel authored and consistent at actual judge resolutions.
- [ ] No accidental scrolling, broken labels, unexplained metrics, stock Astryx Neutral styling, or mixed library aesthetics; real Astryx controls use the approved SESHAT theme.
- [ ] States are not represented by color alone; keyboard and reduced-motion expectations are respected.
- [ ] Delay transitions communicate the consequence without distracting decoration.

**Engineering and evidence**

- [ ] The pipeline and app use a versioned, reproducible dataset contract: Leaflet north-up grid, Float64 costs, Int32 pointers, UInt8 mask, PDS/source IDs, cross-file hashes and strictly correct `UNKNOWN`.
- [ ] Human-owned numerical, geospatial, and E2E hero tests pass and results are documented.
- [ ] At least one non-builder cold evaluation has been attempted; any reported user-study figures are actual observations.
- [ ] CI is green, live browser works, and local static build works offline on two laptops.
- [ ] No source or performance assertion is described as “passed” without real validation output.

**Submission and story**

- [ ] Team, local event, challenge and organizer-approved build start confirmed.
- [ ] Public code, app and demo links load in incognito.
- [ ] Licenses, data references, images/fonts and AI use are acknowledged.
- [ ] Current 2026 format and local/global deadlines followed.
- [ ] The official NASA project page explicitly reports **Submitted**.
- [ ] Speakers have rehearsed normal, interrupted and internet-failure versions.

**The standard is not a large number of features.** It is one confident, unusually coherent instrument in which the scientific evidence, route model, opportunity map, design, interaction, limitations, tests and presentation tell the same story.

---

# 20. Research sources and verification status

This is a **research-backed build specification**, not an assertion that NASA data has already been downloaded, that targets have already been registered, that tests have already passed, or that the software already exists. Source catalogs, scientific papers and legal rules can be verified **before** the event; actual processed rasters, coordinate transforms, route fields, on-site usability findings, benchmark performance, and submission status must be verified **during** the authorized build.

The source hierarchy for disputed facts is: **current official NASA rule / live submission form and organizer-approved instruction → NASA/PDS/USGS original product/paper → independently published scholarly reference → reputable contextual resource → team planning assumption**. External mirrors and older judging guides never override current official rules.

## Event, challenge, judging

| Ref | Source | What it supports | Status / limitation |
|---|---|---|---|
| **R01** | [NASA Space Apps 2026 official event](https://www.spaceappschallenge.org/2026/) | Global dates, team limit, official portal submission window | **Verified official published information**; local judging cutoff separate |
| **R02** | [2026 participant terms](https://www.spaceappschallenge.org/legal/) | Local-date authorization framework, source rights, open access/licensing, references | **Verified official terms**; exact Cairo authorization unresolved |
| **R03** | [NASA Space Apps Cairo website](https://spaceappscairo.com/) and [registration](https://spaceappscairo.com/hackathon-registration) | Cairo's advertised 13–14 November / 48-hour description | **Verified public claim**; exact H0/end and written NASA approval must be checked |
| **R04** | [NASA GO Team answer: event start / permissible preparation](https://github.com/nasa/spaceapps/discussions/1813) | GO staff's November 2026 warning against starting project implementation early | **Verified official-staff response**; earlier local written approval takes precedence when documented |
| **R05** | [NASA GO Team answer: required challenge resource](https://github.com/nasa/spaceapps/discussions/1827) | At least one NASA data source included in the chosen challenge Resources for Global Awards | **Verified official-staff response**; specific listed Martian Map source to check at H0 |
| **R06** | [NASA Space Apps 2025 award descriptions](https://www.spaceappschallenge.org/2025/awards/) | Definitions of Best Mission Concept, Best Use of Data, Best Use of Science | **Verified historical official reference**, not replacement for 2026 guide |
| **R07** | [NASA press release: 2025 global winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/) | Actual 2025 winners including PureFlow and Resonant Exoplanets | **Verified NASA report**; qualitative inspiration, not a predictive win formula |
| **R08** | [Official 2026 Martian Map challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) and [challenge index](https://www.spaceappschallenge.org/2026/challenges/) | Challenge statement, actual Resources list and detailed requirements | **Official page is authoritative**; confirm 2026 Resources and its latest edits at H0. Independently mirrored overview: [NASA Space Apps UAE](https://nasaspaceapps.ae/challenges) |
| **R09** | [NASA Space Apps 2025 judging guidance (PDF)](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf) | Five criteria, 7-slide/30-second eligibility precedent, 2025 AI disclosure/watermarks | **Historical 2025 guidance only**; 2026 participant guide/form is decisive. [NASA staff says guide was to be posted Nov 13](https://github.com/nasa/spaceapps/discussions/1839) |
| **R24** | [NASA Space Apps resources hub](https://www.spaceappschallenge.org/resources/) | Current participant guides and event guidance | **Must be rechecked at H0**, particularly AI, assets and demo fields |

## Science, planetary data, and mission-planning precedents

| Ref | Source | What it supports | Status / limitation |
|---|---|---|---|
| **R10** | [NASA Software Catalog: APRES](https://software.nasa.gov/software/ARC-18869-1) | Activity planning with resources and constraints | **Verified published tool description**; not SESHAT user validation |
| **R11** | [NASA Open MCT](https://ammos.nasa.gov/openmct/) | Grouped mission visualization and correlated operational information | **Verified reference design**; not a requirement to clone |
| **R12** | [NASA NTRS 20250011659: human-centered telemetry displays](https://ntrs.nasa.gov/citations/20250011659) | Task-centered hierarchy and meaningful display organization | **Published research**; analogical use for a hypothetical Mars planning UI |
| **R13** | [USGS Jezero Mars 2020 site products](https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products) and [CTX science DEM mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic) | Real HiRISE/CTX terrain and ortho product availability | **Catalog existence verified**; correct target coverage and native product metadata to validate |
| **R14** | [USGS Mars Sample Return HiRISE mosaics](https://www.usgs.gov/data/mars-sample-return-hirise-mosaics-terrain-relative-navigation) | More recent Jezero DEM/ortho mosaic source and published accuracy limitations | **Catalog verified**; exact download and overlap still conditional |
| **R15** | [PDS Mars 2020 archive gateway](https://pds-geosciences.wustl.edu/missions/mars2020/index.htm) and [Rover PLACES](https://pds-geosciences.wustl.edu/missions/mars2020/places.htm) | Instrument/archive context, rover localizations/positions and sol references | **Official PDS availability verified**; point extraction and coordinate transform not yet executed |
| **R16** | [NASA NTRS 20230000582: Shenandoah formation sedimentology](https://ntrs.nasa.gov/citations/20230000582) | Cape Nukshak and Hawksbill Gap as investigated geological sections | **Published site science**; does not alone certify exact point coordinates |
| **R17** | [NASA Science: Perseverance's mid-climb view](https://science.nasa.gov/resource/perseverances-mid-climb-view-of-jezero-crater/) | Cape Nukshak/Hawksbill Gap route-context distinction | **Documented mission context**; not a human route calibration |
| **R18** | [NASA Science: Wildcat Ridge sample collection](https://science.nasa.gov/resource/sample-collection-and-rock-analysis-at-wildcat-ridge/) | Rock abrasion and sample-core evidence at Wildcat Ridge | **Documented named target**; derive exact pose from PDS, do not assume coordinates |
| **R19** | [NASA Science: Two Perseverance delta sample locations](https://science.nasa.gov/resource/two-perseverance-sampling-locations-in-jezeros-delta/) | Wildcat Ridge and Skinner Ridge as sampling locations | **Documented fallback candidate sites**, geolocation to check |
| **R20** | [NASA/JSC: simulated exploration traverse and metabolic workload model](https://ntrs.nasa.gov/citations/20250006519) | Serious research exists on terrain-aware traverse planning | **Published research**; does **not** certify SESHAT's simple Mars mobility parameters |

## Implementation and design references

| Ref | Source | What it supports | Status / limitation |
|---|---|---|---|
| **R21** | [Next.js deployment docs](https://nextjs.org/docs/app/getting-started/deploying) | Static export is a documented deployment option | **Verified docs**; specific package/version compatibility must be checked at H0 |
| **R22** | [Meta Astryx design specifications](https://github.com/meta/astryx/blob/main/docs/design/README.md) | Explicit human-owned design records, hierarchy, states, rhythm, motion | **Verified upstream design contract**; SESHAT also installs Astryx packages |
| **R23** | [Meta Astryx repository](https://github.com/meta/astryx) and [design conventions](https://github.com/meta/astryx/wiki/Design-Conventions) | Astryx is an actual React UI library, with accessible components, theming, MIT license, agent CLI and documented conventions | **Verified intended production dependency**; use original SESHAT visual branding |
| **R25** | [Astryx core: Next.js + Tailwind setup](https://github.com/meta/astryx/blob/main/packages/core/README.md) | React 19 peer dependency, published package names, official CSS layer order, Theme/LinkProvider setup, CLI guidance | **Verified upstream code/docs**; exact installed release must pass H0 smoke tests |
| **R26** | [Astryx styling overview](https://astryx.atmeta.com/docs/styling-overview) | Tailwind v4 compatibility, token bridge, cascade precedence and className/style customization | **Verified official integration documentation** |
| **R27** | [Astryx theming](https://astryx.atmeta.com/docs/theme) | Base-theme extension, `defineTheme`, theme build, SSR-safe built theme and component overrides | **Verified official customization path**; actual SESHAT compiled theme must be implemented and tested |
| **R28** | [USGS Jezero TRN CTX 20 m DTM catalog and file](https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0) | Actual named first-access CTX DTM, ~9.3 MB listed external size, source title and constraints | **Official catalog listing verified**; native file content/coverage must be inspected at H0 |
| **R29** | [PDS Mars 2020 PLACES localization collection](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/) | `best_interp.csv` and paired PDS4 `best_interp.csv.xml` publicly listed | **Directory verified**; CSV schema, field meanings and exact site association to inspect, not assumed |
| **R30** | [Leaflet non-geographical maps / `CRS.Simple`](https://leafletjs.com/examples/crs-simple/) | `[y,x]` display convention, image overlays, map units are arbitrary grid units | **Official API docs verified**; project-specific north-up orientation and offline CSS require implementation test |
| **R31** | [SciPy `csgraph.dijkstra` documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csgraph.dijkstra.html) | Directed/reverse shortest paths, `-9999` unreachable predecessor sentinel | **Official API documented**; exact field exporter must pass an independent graph oracle |
| **R32** | [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) | `output:"export"`, `out/`, unsupported runtime features and static hosting | **Official technical docs**; installed-version build and offline smoke required |

**Attribution rule:** the actual README/submission ledger must credit **every material used**, including any downloaded NASA/USGS/PDS imagery, metadata, raster products, scientific papers, JS/Python packages, icon sets, licensed fonts and media. This list is the **planning research bibliography**, not a substitute for the final source ledger generated from the actual build.

---

# Appendix A. Exact interpretation of sensitivity

For valid nominal times `o` and `r`, activity `sci`, reserve `res` and remaining clock `B`:

```text
for factor in [0.8, 1.0, 1.2]:
    need[factor] = (o + r)/factor + sci + res
    margin[factor] = B - need[factor]
    feasible[factor] = margin[factor] >= 0

if source_or_geometry_is_unverified:
    state = UNKNOWN
elif every(feasible.values()):
    state = ROBUST
elif any(feasible.values()):
    state = MARGINAL
else:
    state = INFEASIBLE
```

The above is **pseudocode of an intended pure function**, not a claim that production source is already implemented. Its uniform speed multiplier preserves the shortest-path geometry for a fixed grade model. If the team adds heterogeneous speed/terrain modes later, rerun shortest-path tests and reconsider this optimization.

**Precision rule:** do not classify after rounding display values. Compute with full internal precision; round only for the UI. A target whose internal margin is `−0.004 min` is mathematically infeasible even if a one-decimal display prints `0.0`. Prefer showing **“<1 min short”** or an appropriate exact-boundary label in that case, to avoid contradiction.

---

# Appendix B. H0 readiness board

This is the immediate queue to create in GitHub *after H0*, not a claim that implementation has started:

| First Issue | Initial responsible reviewer | Result expected |
|---|---|---|
| `C0 Confirm start + local deadlines` | Shams | Approved H0 documented |
| `C1 Lock qualifying NASA Resource` | Shams + Malak | Resources item, source use and citation |
| `Project shell + static preview` | Kamel | Correct tokens, layout, live/static build |
| `Common source/analysis contract` | Kamel + Ali + Amr | Schemas, manifest v0, data review |
| `Real DEM metadata + crop` | Amr | Verified projection, NoData, resolution |
| `Human numeric oracles` | Hams | Written expected calculations before engine |
| `Three science evidence entries` | Malak | Named site, claim, reference and location status |
| `First directed path and reverse path` | Ali + Amr | Reproducible geometry and time |
| `Map visual-reg check` | Kamel + Hams | Screenshot and transform proof |
| `Submission form skeleton` | Shams | Accurate final fields, current guide checked |

At every gate, close Issues with a screenshot/log or tested commit. Keep active work-in-progress low enough that integration doesn't become another project.

---

# Appendix C. Reproducibility and release evidence packet

Ship `docs/validation.md` with a concise **real release packet**:

```text
SESHAT RELEASE: <tag or hash>
COMPILED DATA REVISION: <hash>
BUILD AUTHORIZATION: <event evidence>
OFFICIAL CHALLENGE RESOURCE USED: <exact item + URL>
REAL ORBITAL INPUT(S): <mission, instrument, product IDs>
REAL SURFACE EVIDENCE INPUT(S): <mission, site/sol, product IDs>
STUDY BOUNDS / CRS / RESOLUTION: <verified native and analysis values>
TARGET GEOMETRY STATUS: <each site, reviewer, date>
MODEL: <version and scenario coefficients>
NUMERIC TESTS: <actual executed commands and counts>
GEOSPATIAL CHECKS: <screenshots/checksums/results>
BROWSER E2E: <actual executed commands/results>
USABILITY TEST: <participants/task types/raw results or not done>
PERFORMANCE: <measured device/browser/timings or not measured>
WEB BUILD: <production URL + verified time>
LOCAL BUILD: <machine names + offline test result>
DEMO MEDIA: <public and local paths>
SUBMISSION: <official status + proof timestamp>
LIMITATIONS: <explicit unsupported claims>
```

**An evidence field may truthfully say `NOT MEASURED`, `NOT VERIFIED` or `NOT DONE`.** It must never be filled with an attractive invented number.

---

# Appendix D. Research-to-implementation handoff

There are two classes of truth in this book:

**Already established in published sources:** the challenge's broad layered multi-mission objective, global submission window, Cairo's public local-date claim, the organizer authorization/early-start warning, the existence of USGS Jezero terrain catalogs and PDS mission-position resources, the scientific significance of candidate locations, the value of transparent resource-aware planning, and the documented capabilities of the proposed frontend tooling.

**Not yet established and therefore requiring direct proof during the event:** specific qualifying challenge-Resources dataset, Cairo's earlier-start approval and precise H0, common coverage of the chosen DEM plus all targets, exact target coordinates/elevations, final Mars projection transform, directional travel estimates, model coefficients, real frontend frame rates, “passed” test counts, real user-study findings, and final project submission status.

The execution plan is designed to close those gaps with **bounded, testable gates**, not to conceal them. **Do not use planning research as a substitute for implementation evidence.**

The master principle, at every design and engineering decision, is:

> **Make an ambitious scientific decision experience that a judge can use, understand, test and trust—within the authority of the data and the clock the team actually has.**


---

# Appendix E. H0 copy-ready implementation contracts

These are **implementation starting points and synthetic acceptance fixtures**, not code claimed already running in the SESHAT repository. Copy only **after authorized H0**. The full engine and pipeline must still validate genuine NASA/PDS data and the current pinned dependencies.

## E1. Locked UI mapping and Next.js loading

Use a **client-only Leaflet component**. Make the map's coordinates equal the **exported raster cell grid**, not Mars longitude and latitude. This is the sole transform from `(row,col)` to Leaflet.

```ts
// src/components/cartography/grid-coordinates.ts
export function cellToLeaflet(row: number, col: number, height: number): [number, number] {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= height) {
    throw new Error('Invalid grid cell');
  }
  return [height - (row + 0.5), col + 0.5]; // [display y, display x]
}
export function leafletToCell(lat: number, lng: number, height: number, width: number) {
  const row = Math.floor(height - lat);
  const col = Math.floor(lng);
  if (row < 0 || row >= height || col < 0 || col >= width) return null;
  return {row, col};
}
```

```tsx
// src/app/page.tsx (a Server Component may render a Client Component)
import MapEntry from '@/components/cartography/MapEntry';
export default function Page() { return <MapEntry />; }

// src/components/cartography/MapEntry.tsx
'use client';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('./MapView'), {ssr:false});
export default function MapEntry() { return <MapView />; }

// In MapView.tsx, after loading a validated manifest:
// const bounds: L.LatLngBoundsExpression = [[0,0],[manifest.analysis.height,manifest.analysis.width]];
// L.map(element,{crs:L.CRS.Simple,minZoom:-5,maxBounds:bounds});
// L.imageOverlay('/data/imagery/study-area.webp',bounds).addTo(map);
// Markers/routes use cellToLeaflet, click uses leafletToCell.
```

Import `leaflet/dist/leaflet.css` in the Next.js global stylesheet or root layout, supply **local original SVG markers** rather than relying on Leaflet's default icon URLs, and test static build. A route's exported pixel path is not a list of Mars geographic coordinates; keep genuine source coordinates in the manifest separately. **For image export, north-up is mandatory**; otherwise rewrite the mapping after an actual affine-transform proof, not an aesthetic guess. [R30]

## E2. First commands for data evidence

```bash
# RUN only after documented H0. Set up tool versions / lockfiles, then:
mkdir -p data/raw docs/data-evidence
curl -L --fail --retry 2 --output data/raw/jezero_ctx_20m.tif \
  https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
gdalinfo -json data/raw/jezero_ctx_20m.tif > docs/data-evidence/ctx_gdalinfo.json
python3 - <<'PYTHON'
import hashlib, json, pathlib
p=pathlib.Path('data/raw/jezero_ctx_20m.tif')
print('source_sha256', hashlib.sha256(p.read_bytes()).hexdigest())
meta=json.loads(pathlib.Path('docs/data-evidence/ctx_gdalinfo.json').read_text())
print('size', meta.get('size'))
print('geoTransform', meta.get('geoTransform'))
print('coordinateSystem', str(meta.get('coordinateSystem'))[:700])
print('band1', str(meta.get('bands', [{}])[0])[:700])
PYTHON
```

For the rover location archive, use the paired CSV+XML in [R29]. **Do not hardcode `sol`, `lat`, `lon` header names** until verified against the actual CSV/PDS4 label. Suggested workflow: download both, inspect `head -n 3` and the label's field definitions; identify the required Sols from NASA science articles; trace each exact mission observation to a rover pose with coordinate-frame, localization quality, timestamp and uncertainty. Evidence review is a separate G4 acceptance action. Do not call a pose at Sol 470 the Wildcat Ridge rock coordinate without a source proving that relationship.

## E3. Directed shortest path exporter — a minimal tested contract

The exact `W` sparse matrix is **produced elsewhere from accepted elevation, mask, source CRS and the declared grade model**. This exporter **does not fabricate that grid**. It only compiles previously validated positive directed edge costs in **minutes**.

```python
# pipeline/route_fields.py
from pathlib import Path
import json
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

def export_routes(W: csr_matrix, base_idx: int, width: int, height: int, dest: Path) -> None:
    n = width * height
    assert W.shape == (n, n) and W.nnz > 0
    assert 0 <= base_idx < n
    assert np.isfinite(W.data).all() and (W.data > 0).all(), 'Edges must be positive finite minutes'
    W = W.tocsr()
    W.sort_indices()
    out_cost, out_parent = dijkstra(W, directed=True, indices=base_idx, return_predecessors=True)
    ret_cost, ret_next = dijkstra(W.T.tocsr(), directed=True, indices=base_idx, return_predecessors=True)

    def pointers(p):
        p = np.asarray(p, dtype=np.int32)
        return np.where(p == -9999, -1, p).astype('<i4')
    dest.mkdir(parents=True, exist_ok=True)
    np.asarray(out_cost, dtype='<f8').tofile(dest / 'outbound-costs.bin')
    np.asarray(ret_cost, dtype='<f8').tofile(dest / 'return-costs.bin')
    pointers(out_parent).tofile(dest / 'outbound-parents.bin')
    pointers(ret_next).tofile(dest / 'return-next.bin')
    (dest / 'grid.meta.json').write_text(json.dumps({
        'width':width,'height':height,'baseIndex':base_idx,'indexRule':'row*width+col',
        'cost':{'dtype':'<f8','unit':'minute','unreachable':'positive_infinity'},
        'pointer':{'dtype':'<i4','rootOrUnreachable':-1,'order':'row-major'},
        'modelId':'terrain-scenario-v0',
        'warning':'Attach source revision, CRS, checksums, byte counts and topology QA in final manifest.'
    }, indent=2))

if __name__ == '__main__':
    from scipy.sparse import csr_matrix
    # SYNTHETIC 4-node oracle: outbound from 0 is [0,1,3,inf]; return is [0,3,8,inf].
    graph=csr_matrix((np.array([1.,2.,8.,3.]),
                      (np.array([0,1,2,1]),np.array([1,2,0,0]))),shape=(4,4))
    export_routes(graph, base_idx=0, width=2, height=2, dest=Path('tmp/seshat-route-oracle'))
    out=np.fromfile('tmp/seshat-route-oracle/outbound-costs.bin',dtype='<f8')
    ret=np.fromfile('tmp/seshat-route-oracle/return-costs.bin',dtype='<f8')
    p=np.fromfile('tmp/seshat-route-oracle/outbound-parents.bin',dtype='<i4')
    q=np.fromfile('tmp/seshat-route-oracle/return-next.bin',dtype='<i4')
    assert np.allclose(out[:3],[0,1,3]) and np.isinf(out[3])
    assert np.allclose(ret[:3],[0,3,8]) and np.isinf(ret[3])
    assert p.tolist()==[-1,0,1,-1]
    assert q.tolist()==[-1,0,0,-1]
    print('PASS synthetic directed route export and sentinels')
```

**Graph construction contract:** analysis-cell centers use true horizontal meter distances (`20m` horizontal/vertical; `20√2m` diagonal only when square 20m grid). The nominal edge cost is **`t_minutes = d_meters / (0.75 * grade_factor) / 60`**. Speed scenario multipliers scale this precomputed time by `1/s` in the client. Vertical delta is in source-documented meters, so `g=(z_v-z_u)/horizontal_distance`. A known nontraversable/NoData edge is absent, never a zero-weight edge. The grade hard limit is the declared scenario constraint `abs(atan(g)) > 25°`; build both `(u,v)` and `(v,u)` with their own signed grade penalties where accepted. Diagonal corner-cut test is mandatory if using eight neighbors. The separately implemented permissive reachability grid is *unpriced* and cannot generate routes/time.

**Leaflet lifecycle:** in `MapView`, create the `L.map(...)` instance in a mount-time effect/ref, and destroy it with `map.remove()` on unmount; do not instantiate it on every scenario rerender or React development re-mount, which can trigger “Map container is already initialized.” Keep the map instance stable while frontier/route overlay layers change.

**Browser loader and path checks:** reject byte lengths other than `n*8` for each cost, `n*4` for each pointer and elevation, and `n` for mask; check final manifest SHA-256 of every file. Pointer traversal halts after at most `n` steps; reject cycles, invalid/negative indices except `-1`, nonvalid mask cells, a non-base `-1` before the base, nonpositive edges, and any disagreement between reconstructed path time and exported field beyond an explicitly logged numerical tolerance. **Do not reverse `return-next` before following it toward base.** A target `0` is a valid node. For an unreachable `+inf` cost, never show a numeric minute or a drawn line.

## E4. Astryx theme build and runtime registration

```bash
pnpm add @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
pnpm add -D @astryxdesign/cli
pnpm exec astryx init
pnpm exec astryx theme template
pnpm exec astryx docs author-a-theme
# create the checked SESHAT defineTheme source + same-stem .doc.mjs descriptor
pnpm exec astryx theme build ./src/themes/seshat/seshatTheme.ts
pnpm exec astryx theme add seshat
pnpm exec astryx theme use seshat
```

Require a working browser screenshot of the **built SESHAT theme**, not just the Neutral starter. Use official Astryx CSS/Tailwind cascade (§8.1A), verified actual component props, and the generated `themes/defaultThemeSlug` module. If a CLI error occurs, inspect `pnpm exec astryx --help`, `... theme list` and `... docs author-a-theme`; **do not eject Neutral or install shadcn** as a workaround. [R27]

## E5. End-to-end bundle integrity checklist

Create `docs/validation.md` with these exact acceptance artifacts, each tied to the same analysis revision: DEM native metadata and SHA-256; site/target coverage matrix; source-footprint screenshot; transformed map-corner parity screenshot; validated mission observation-to-pose links; chosen base and scenario parameters; six binary-file metadata/byte-count checks; a **manually calculated** route/time against the graph; 0.8/1.0/1.2 classifications; delay-frontier before/after; tested static export; live and offline demo; and official submission screenshot. **A step not actually run is marked `NOT RUN`, not PASS.**

---

# Appendix F. Simulated 48-hour execution and adversarial failure rehearsal

**Method and honesty:** This is a **procedural dry run** of the dependencies and handoffs, not a claim that the actual SESHAT application is implemented. A small synthetic asymmetric graph and cell-display mapping were independently executed during document review; **NASA raster download, data-source compatibility, live coordinates, final UI build and official submission remain untested** until the team runs them.

| Rehearsal point | What the operator actually tries | Failure that could stall build | Pre-committed resolution | Gate outcome |
|---|---|---|---|---|
| Pre-H0 / event entry | Shams obtains written authorized start and current Resources | Friday local start conflicts with global default; NASA dataset not listed | Do not start code prematurely; capture written organizer instruction; qualify a listed NASA resource | **Blocked** without C0/C1 |
| H0–H1 / repo | Kamel installs Next/Astryx; Ali checks pinned graph and scripts; Malak opens remote PR | Theme or CSS order breaks; remote teammate lacks access | First render Neutral smoke → compiled SESHAT theme; invite/test remote git access; maintain `main` known-good | Shell ready only after build+static proof |
| H0–H3 / geospatial | Amr downloads the published ~9.3 MB CTX DTM; Malak gets PDS CSV+XML | Huge ortho assumed same size, schema/CRS guessed, source host down | Inspect file/metadata first; independently inspect ortho; fallback to authoritative broader Jezero catalog; record exact failure | Only real source accepted |
| H2–H4 / study area | Amr overlays base + 3 candidates onto DTM footprint | The named sites may be kilometers apart or outside the narrow crop | Compute real bbox and coverage table before choosing crop; substitute sourced targets or larger accepted mosaic; no silent fabricated pins | G2/G4 cannot pass without overlap |
| H3 / UI foundation | Kamel mounts raster and marker at row 0; Hams checks north-up | Image and pins appear vertically flipped by `CRS.Simple` | Use exactly `[H-row-.5,col+.5]`; audit four corners plus click inverse; no arbitrary offsets | Viewer regression must pass |
| H4–H10 / engine | Ali builds positive directed edge costs; independent Dijkstra checks | `-9999` pointers, node 0, transpose confusion, Float32 rounding, unknown vs blocked confusion | `<f8`/`<i4`, normalized `-1`, graph oracle, permissive topology test, path sum validation | Invalid field blocks G1 |
| H10–H16 / state | Hams checks margin and frontier vs target activity | Returnable contour misrepresented as science-ready frontier | Movement-only contour labeled; target activity included only in target assessment | G2 blocked if copy misleads |
| H16–H22 / hero | Shams adds +15 and chooses real-target scenario | No state transition from a plausible 105-minute preset | Use measured model routes, disclose adjustable time budget, store exact scenario; **never edit real path metrics** | G3 requires shown transition |
| H22–H28 / premium | User tries custom pin/rover overlay | Approximate region is treated as exact target; rover points don't align | Generic custom location status; hide unregistered rover overlay; preserve validated mission data elsewhere | P1 withheld until verified |
| H28–H34 / adversarial | Remote Malak checks source and raw target evidence; Ali probes corrupt buffer | Manifest hash mismatch or a NaN renders success | Load-time checksum + byte checks; simulated missing-file test; route-pointer bounds checks | G5 requires truthful errors |
| H34–H44 / demo | Shams/ Ali rehearse live, local and recorded; Kamel switches Wi-Fi off | Remote fonts/tiles, wrong export path, missing binary asset | `out/` local static server, bundled fonts and map image; two devices and an already recorded fallback | Release only after offline proof |
| H40 / submission | Shams tests incognito project/slide/video/repo links | Public repo late, official form rejects format, no 'Submitted' status | Make private/public decision early; inspect current 2026 upload form, finish ahead of earliest local/global cutoff | C5 only on submission proof |

### Failure injection, not just a happy-path demo

At least once before freeze, run the following **on a copy of the static output or a nonproduction test revision**. Never deliberately corrupt production files: (1) hide one binary → legible dataset failure, not `0 min`; (2) point one target outside mask → UNKNOWN and no fake route; (3) make a parent pointer cycle → bounded refusal; (4) lower time below travel+reserve → shrinking frontier; (5) force offline mode → all essential map, font and source summaries still usable; (6) change the manifest hash without changing the file → explicit revision mismatch; (7) use an approximate-only target → evidence panel available but no precise route/ROBUST label.

### Claims that remain conditional after this rehearsal

A well specified implementation still cannot pre-verify: organizer authorization, NASA Resources inclusion, actual raster CRS/vertical units, target coverage, outcrop-to-rover-pose associations, final cost model calibration, the current Astryx package behavior, usable frame rates on venue hardware or submission success. These are **named, owned gates**, not blanks to fill with guesswork. The plan's success standard is: **all essential gates passed on actual artifacts, not “100% ready” based solely on prose.**
