# SESHAT release verification

Run: 2026-11-14T00:25:48.898180+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 0.80s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ matches manifest geographicBounds and boundary polygon closely (0.67925ms)
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (0.239042ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.128584ms)
✔ Mars geographic AEQD coordinate transforms (2.931667ms)
ℹ tests 42
ℹ suites 1
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 113.827
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
✓ Generating static pages using 4 workers (3/3) in 209ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
Running 8 tests using 1 worker

  ✓  1 tests/e2e/mars-map.spec.ts:4:3 › Seamless Mars tiled map & offline resilience › renders Mars scale bar, switches geology/thermal layers, zooms out to Mars, marks outside clicks browse-only, and returns to Jezero (3.0s)
  ✓  2 tests/e2e/mars-map.spec.ts:56:3 › Seamless Mars tiled map & offline resilience › remains functional offline with trek.nasa.gov blocked and optional layer 404 (492ms)
  ✓  3 tests/e2e/mars-map.spec.ts:80:3 › Seamless Mars tiled map & offline resilience › shows no horizontal overflow on desktop or mobile viewports (185ms)
  ✓  4 tests/e2e/mission-lifecycle.spec.ts:3:1 › Jezero baseline survives an event, approval, a reload and return (1.4s)
  ✓  5 tests/e2e/mission-lifecycle.spec.ts:39:1 › real planning view fits the mobile viewport (420ms)
  ✓  6 tests/e2e/production.spec.ts:3:1 › production static export loads the evidence-gated workbench (135ms)
  ✓  7 tests/e2e/production.spec.ts:14:1 › the synthetic fixture is visibly disclosed, and clock reset is deterministic (240ms)
  ✓  8 tests/e2e/production.spec.ts:25:1 › mobile has no document-wide horizontal overflow (176ms)

  8 passed (6.5s)
```
