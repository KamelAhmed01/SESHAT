# SESHAT release verification

Run: 2026-11-14T03:45:54.694936+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 0.70s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ matches manifest geographicBounds and boundary polygon closely (0.673875ms)
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (0.234417ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.142ms)
✔ Mars geographic AEQD coordinate transforms (2.890625ms)
ℹ tests 45
ℹ suites 2
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 501.351875
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
✓ Generating static pages using 4 workers (3/3) in 237ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
  ✓   2 tests/e2e/interrupted-science.spec.ts:89:1 › workbench has no horizontal overflow at 1440x900, 1280x720, 390x844, and 320x640 (714ms)
  ✓   3 tests/e2e/mars-map.spec.ts:4:3 › Seamless Mars tiled map & offline resilience › inspects a science pin with the keyboard before editing the itinerary (474ms)
  ✓   4 tests/e2e/mars-map.spec.ts:14:3 › Seamless Mars tiled map & offline resilience › renders Mars scale bar, switches geology/thermal layers, zooms out to Mars, marks outside clicks browse-only, and returns to Jezero (3.1s)
  ✓   5 tests/e2e/mars-map.spec.ts:69:3 › Seamless Mars tiled map & offline resilience › remains functional offline with trek.nasa.gov blocked and optional layer 404 (669ms)
  ✓   6 tests/e2e/mars-map.spec.ts:94:3 › Seamless Mars tiled map & offline resilience › shows no horizontal overflow on desktop or mobile viewports (487ms)
  ✓   7 tests/e2e/mission-lifecycle.spec.ts:3:1 › Jezero baseline survives an event, approval, a reload and return (4.2s)
  ✓   8 tests/e2e/mission-lifecycle.spec.ts:58:1 › real planning view fits the mobile viewport (514ms)
  ✓   9 tests/e2e/production.spec.ts:3:1 › production static export loads the unified field workbench with sticky map and theme popup (905ms)
  ✓  10 tests/e2e/production.spec.ts:37:1 › the synthetic fixture is visibly disclosed inside the unified workbench (210ms)
  ✓  11 tests/e2e/production.spec.ts:44:1 › mobile has no document-wide horizontal overflow (206ms)

  11 passed (15.5s)
```
