# Science and compliance source ledger

The [resource audit](MISSION_LIFECYCLE.md#resource-audit-and-downloads) records the live challenge listing, inspected download URLs, product hashes, crop and target coordinates. The default workbench uses the Mars Trek CTX terrain and optical mosaic and NASA Perseverance evidence. The entries below are the original H4 investigation notes.

| ID | Candidate | URL | Evidence status | Intended role | Next validation |
|---|---|---|---|---|---|
| C1-H4 | NASA-listed resource from selected challenge | https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/ | **NOT YET CONFIRMED FROM LIVE RESOURCES TAB** | A material layer/calculation used by SESHAT | Shams/Malak capture exact listed NASA source and prove incorporation |
| R-CTX | USGS Jezero CTX 20 m DTM | https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0 | Official catalog exists; local bytes and coverage **NOT TESTED** | Provisional terrain model | Download, checksum, gdalinfo/rasterio, vertical units, nodata, projection and overlap |
| R-PLACES | PDS Rover PLACES best interpolated poses + PDS4 label | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/ | Official directory exists; table fields **NOT TESTED** | Rover-position evidence and route context | Fetch both CSV and XML, inspect schema, confirm frame/sol and observation matching |
| R-SCIENCE | NASA mission/site evidence | https://science.nasa.gov/mission/mars-2020-perseverance/ | Source hub; target-specific citations pending | Named target descriptions | Locate exact relevant pages/papers and map each claim to source |
| R-VIEW | Mars imagery georegistered to accepted crop | **PENDING** | Not selected | Map basemap | Confirm actual imagery and DTM common extent/grid/rights |

For each integrated source add `instrument`, `mission`, `provider`, `product_id`, `download_url`, `original_crs`, `vertical_units`, `native_resolution`, `checksum`, `license/reuse`, `retrieved_at`, `analysis_grid_transform`, `what_UI_uses_it`, `reviewer`, and `limitations`.

**Critical:** "Found on NASA website" ≠ "listed in selected challenge's Resources tab." Do not declare Global Awards eligibility before C1 is actually met.
