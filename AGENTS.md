# SESHAT coding-agent constitution

**Activation:** apply this file to implementation work only after documented official H0. This document is a pre-event specification, not an assertion implementation has begun.

## Outcome
Build SESHAT, an evidence-traceable Martian surface-science planning research prototype. User sees real Mars layers + documented targets, outbound and return model routes, changing opportunity frontier under time delay, and a legible explanation for every change.

## Non-negotiables
1. **No invented science.** Every real-world fact/coordinate/dataset has a provenance entry. Unknown is a legitimate state. Scenario assumptions must be labeled as such. Synthetic inputs are allowed in clearly labeled tests only, never disguised as NASA measurements.
2. **One analysis reference frame.** GIS computations operate on a confirmed common Mars-local metric grid. Never feed Leaflet display units or Web Mercator degrees into scientific distances.
3. **Viewer contract.** Leaflet `CRS.Simple`, north-up raster; grid cell row/col maps to display center `[height - row - 0.5, col + 0.5]`. Prove all four corners, click inverse, and route parity.
4. **Graph contract.** Directed outbound/return traversal on nonzero positive-edge times, no silent NoData interpolation. Binary exports are row-major little-endian, `float64` time costs, `int32` pointers, `uint8` masks. Pointer unreachable sentinel `-1`; costs `Infinity` represented as IEEE float64 infinity. Validate manifest dimension/hash/schema.
5. **Correct science logic.** A target's roundtrip budget is outbound + activity + return + reserve. Delay should not increase feasibility. Classify ROBUST/MARGINAL/INFEASIBLE/UNKNOWN honestly.
6. **UI foundation is mandatory:** Next.js App Router + React 19 + Tailwind v4 + Meta Astryx. Astryx components for ordinary controls. Custom cartographic scientific components are allowed. No shadcn or additional component library as default. Use documented Astryx CLI and CSS layer cascade; never guess prop names.
7. **Visual quality.** A distinctive precision-scientific workbench, not glassmorphism, filler cards, dashboard clichés, random accent colors, unreadable typography, or excessive numbers. Every detail must support a user decision.
8. **One versioned contract.** Shared types, schema, status taxonomy, source ledger, model constants and output manifest are authoritative. Do not rewrite contract without owner approval.
9. **No hidden external runtime dependency.** Static-export/web + offline backup. The scientific route decision works without cloud AI. No API secrets in browsers or commits.
10. **No silent false claims.** Don't say "verified", "tested", "NASA-approved", "safety certified", "production ready", or "100%" without recorded evidence. NASA is a data source, not an endorser.

## Every-checkpoint evidence and commit rule
- Run `python -m tools.checkpoint --run-tests --write docs/CHECKPOINT_REPORT.md` and commit the resulting report with each meaningful code checkpoint.
- Report engine tests, Python tests, browser acceptance, Next.js production build, downloaded Mars files, deployment, and official Resources status **separately**.
- Do not replace a missing production screenshot with the synthetic acceptance-harness screenshot.

## PR acceptance
- Brief issue with outcome, existing contract, touched files, proof and reviewer.
- Typecheck/lint/tests for touched code; output actual commands and results, not assumed green.
- For GIS/data work: sample metadata, CRS, NoData counts, source identifiers, independent verification.
- For UI: 1440x900 and 1280x720 screenshots plus keyboard/loading/error/UNKNOWN states.
- Before merge: reviewer is Kamel/Ali for integration, Shams for evidence/claims where relevant, Hams for design, Amr for geometry, Malak for science.
- Commit small independently useful increments. Never let agents simultaneously rewrite the same file or break a shared schema without coordination.

## Branches and concurrency
- `main`: demonstrable, reviewed builds; `dev`: actively integrating; feature branches are short-lived.
- Code task ownership is flexible; domain responsibility and review accountability are not.
- WhatsApp for blockers; GitHub Issues/PRs for durable evidence; short decisions in `docs/decisions.md`.
- Assign AI parallel tasks by file boundary. A UI agent may not change raster contracts. An engine agent may not invent UI tokens.

## Authoritative references
1. `SESHAT_FINAL_MASTER_EXECUTION_BOOK_v1.2.md` — full scientific, product and schedule contract.
2. `docs/event-brief.md` — authorization and authoritative deadlines.
3. `docs/sources.md` — qualified challenge-resource and actual build provenance.
4. `docs/decisions.md` — current frozen decisions; any conflict requires human decision.
5. The **installed** Astryx CLI docs, particularly component APIs, theme and Tailwind styling.

Stop if a request creates an unsupported scientific claim, violates event timing, or crosses a source/coordinate boundary without evidence.
