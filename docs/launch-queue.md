# H0 kickoff queue — issue specs

**Do not start implementation before C0.** The following tickets are prepared to create/pull at authorization. Tasks may be reassigned among active teammates; reviewers retain responsibility.

## T00 — Authorize start / Shams / CRITICAL
- **Input:** organizer written announcement plus NASA global rule.
- **Done when:** exact H0 and local judging/submission deadline recorded with screenshot or source. Before then, no project implementation.

## T01 — Qualifying challenge NASA input / Shams + Malak / CRITICAL
- **Input:** live 2026 Martian Map Resources tab, current submission guide.
- **Done when:** exact listed NASA dataset URL + source ID + specific material SESHAT use recorded. Claim of eligibility otherwise forbidden.

## T02 — Repo, AGENTS.md, static shell / Kamel + Ali
- **Depends:** T00.
- **Done when:** new repo has pinned lockfile, Next.js+Astryx+Tailwind, original theme visible, build checks, local static-export check, first deployed preview. Never push tokens.

## T03 — Scientific dataset metadata and common coverage / Amr / CRITICAL
- **Depends:** T00.
- **Done when:** real DTM and matched image inspected, CRS/NoData/units/bounds/reprojection report, ROI chosen for real target overlap. No fake terrain.

## T04 — Science target evidence and locations / Malak + Amr
- **Depends:** T00, T03.
- **Done when:** 2+ routeable verified points or honest rover pose proxies inside coverage, source/coordinate status, two-person sign-off. Region-only points shown as UNKNOWN and never assigned precise roundtrip metrics.

## T05 — Hand-computed graph/model oracles / Hams + Ali
- **Depends:** T00.
- **Done when:** independent outbound-return example, +15-minute delay and UNKNOWN cases, expected numbers signed before code.

## T06 — Deterministic directed routing compiler / Ali + Amr
- **Depends:** T03, T05.
- **Done when:** real-grid graph + outbound/return trees + little-endian bin files + manifest hash; O01–O22 as applicable pass with actual logs; no-data topology separated from known slope restriction.

## T07 — Map parity + viewer / Kamel + Hams
- **Depends:** T02, T03.
- **Done when:** Leaflet north-up image, four corners, click inverse, source/target markers verified on real geometry, no guessed offsets; premium but restrained layout.

## T08 — Interactive hero workflow / Kamel + Ali + Hams
- **Depends:** T04, T06, T07.
- **Done when:** target -> route -> remaining time -> delay+15 -> frontier changes -> why-changed -> source drawer; correct states and unit tests.

## T09 — Real demo, backup and submission / Shams + all
- **Depends:** T08.
- **Done when:** actual app browser pass, keyboard/accessibility, build/downloaded assets offline, demo slides/video within CURRENT rule, public repo, cited sources, documented AI use, official portal status SUBMITTED.

**Gate order:** C0 → C1+T03+T02 → T04/T05 → T06/T07 → T08 → evidence and submission. Early P2 stretch only after critical path stable.
