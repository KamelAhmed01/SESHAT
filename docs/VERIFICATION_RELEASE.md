# SESHAT release verification

Run: 2026-11-14T00:38:33.296148+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 0.84s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ matches manifest geographicBounds and boundary polygon closely (0.737ms)
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (0.27225ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.154834ms)
✔ Mars geographic AEQD coordinate transforms (2.898916ms)
ℹ tests 44
ℹ suites 2
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 414.889666
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
✓ Generating static pages using 4 workers (3/3) in 192ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
  ✓   1 tests/e2e/interrupted-science.spec.ts:3:1 › interrupted science preserves observations, survives reload, compares finish vs leave stop, and records keyboard hazard coordinates (1.7s)
  ✓   2 tests/e2e/interrupted-science.spec.ts:69:1 › workbench has no horizontal overflow at 1440x900, 1280x720, 390x844, and 320x640 (1.3s)
  ✓   3 tests/e2e/mars-map.spec.ts:4:3 › Seamless Mars tiled map & offline resilience › renders Mars scale bar, switches geology/thermal layers, zooms out to Mars, marks outside clicks browse-only, and returns to Jezero (2.8s)
  ✓   4 tests/e2e/mars-map.spec.ts:56:3 › Seamless Mars tiled map & offline resilience › remains functional offline with trek.nasa.gov blocked and optional layer 404 (529ms)
  ✓   5 tests/e2e/mars-map.spec.ts:80:3 › Seamless Mars tiled map & offline resilience › shows no horizontal overflow on desktop or mobile viewports (191ms)
  ✓   6 tests/e2e/mission-lifecycle.spec.ts:3:1 › Jezero baseline survives an event, approval, a reload and return (1.4s)
  ✓   7 tests/e2e/mission-lifecycle.spec.ts:39:1 › real planning view fits the mobile viewport (434ms)
  ✓   8 tests/e2e/production.spec.ts:3:1 › production static export loads the evidence-gated workbench (135ms)
  ✓   9 tests/e2e/production.spec.ts:14:1 › the synthetic fixture is visibly disclosed, and clock reset is deterministic (241ms)
  ✓  10 tests/e2e/production.spec.ts:25:1 › mobile has no document-wide horizontal overflow (186ms)

  10 passed (9.3s)
```
