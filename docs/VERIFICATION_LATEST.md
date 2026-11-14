# SESHAT release verification

Run: 2026-11-14T05:51:43.049422+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 1.26s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ matches manifest geographicBounds and boundary polygon closely (0.93175ms)
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (0.405ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.223583ms)
✔ Mars geographic AEQD coordinate transforms (4.284ms)
ℹ tests 48
ℹ suites 2
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 797.839208
```

## PASS: Dependency lockfile presence

```text

```

## PASS: Frontend lint

```text


> seshat@0.1.0 lint /Users/kamelahmed/Projects/SESHAT
> eslint .

```

## PASS: Next.js TypeScript build checks

```text


> seshat@0.1.0 typecheck /Users/kamelahmed/Projects/SESHAT
> tsc --noEmit

```

## PASS: Next.js production static export

```text
  Collecting page data using 4 workers ...
  Generating static pages using 4 workers (0/3) ...
✓ Generating static pages using 4 workers (3/3) in 332ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
  ✓   3 tests/e2e/mars-map.spec.ts:4:3 › Seamless Mars tiled map & offline resilience › inspects a science pin with the keyboard before editing the itinerary (803ms)
  ✓   4 tests/e2e/mars-map.spec.ts:14:3 › Seamless Mars tiled map & offline resilience › renders Mars scale bar, switches geology/thermal layers, zooms out to Mars, marks outside clicks browse-only, and returns to Jezero (3.4s)
  ✓   5 tests/e2e/mars-map.spec.ts:69:3 › Seamless Mars tiled map & offline resilience › remains functional offline with trek.nasa.gov blocked and optional layer 404 (1.2s)
  ✓   6 tests/e2e/mars-map.spec.ts:94:3 › Seamless Mars tiled map & offline resilience › shows no horizontal overflow on desktop or mobile viewports (936ms)
  ✓   7 tests/e2e/mission-lifecycle.spec.ts:4:1 › Jezero baseline survives an event, approval, a reload and return (6.7s)
  ✓   8 tests/e2e/mission-lifecycle.spec.ts:59:1 › real planning view fits the mobile viewport (811ms)
  ✓   9 tests/e2e/mission-lifecycle.spec.ts:69:1 › QoL preset, Frontier overlay, single-mode trim, and Comms Delay triage sync packet work end-to-end (2.7s)
  ✓  10 tests/e2e/production.spec.ts:3:1 › production static export loads the unified field workbench with sticky map and theme popup (1.2s)
  ✓  11 tests/e2e/production.spec.ts:37:1 › the synthetic fixture is visibly disclosed inside the unified workbench (383ms)
  ✓  12 tests/e2e/production.spec.ts:44:1 › mobile has no document-wide horizontal overflow (380ms)

  12 passed (27.1s)
```
