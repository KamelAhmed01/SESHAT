# SESHAT release verification

Run: 2026-11-13T23:34:00.261934+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

...........................                                              [100%]
27 passed in 0.84s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
✔ partial movement, delay and approval preserve the original baseline and completed stop (0.902666ms)
✔ a new hazard causes a detour and a closed landing cell prevents an abort route (0.876625ms)
✔ replanning retains the astronaut’s highest-priority stop under oxygen loss (0.976083ms)
✔ discovery insertion, accessibility, and repeated pace changes alter only pending legs (1.434958ms)
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 110.397833
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
✓ Generating static pages using 4 workers (3/3) in 213ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
> playwright test


Running 5 tests using 1 worker

  ✓  1 tests/e2e/mission-lifecycle.spec.ts:3:1 › Jezero baseline survives an event, approval, a reload and return (1.7s)
  ✓  2 tests/e2e/mission-lifecycle.spec.ts:39:1 › real planning view fits the mobile viewport (384ms)
  ✓  3 tests/e2e/production.spec.ts:3:1 › production static export loads the evidence-gated workbench (147ms)
  ✓  4 tests/e2e/production.spec.ts:14:1 › the synthetic fixture is visibly disclosed, and clock reset is deterministic (261ms)
  ✓  5 tests/e2e/production.spec.ts:25:1 › mobile has no document-wide horizontal overflow (186ms)

  5 passed (3.2s)
```
