# SESHAT release verification

Run: 2026-11-14T10:47:01.734254+00:00
Mode: RELEASE
Overall result: PASS; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 1.37s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.191125ms)
  ✔ includes the 2-layer chunk neighborhood (5x5 = 25 chunks, 22x22 km) with verified binary files (1.385625ms)
  ✔ allows navigation stops and calculates terrain-aware routes into neighborhood chunks (269.150833ms)
✔ Mars geographic AEQD coordinate transforms (274.946417ms)
ℹ tests 50
ℹ suites 2
ℹ pass 50
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 866.01125
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
  Generating static pages using 5 workers (3/4) 
✓ Generating static pages using 5 workers (4/4) in 378ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
└ ○ /dev


○  (Static)  prerendered as static content

```

## PASS: Playwright real Next.js export

```text
  ✓   8 tests/e2e/mission-lifecycle.spec.ts:59:1 › real planning view fits the mobile viewport (866ms)
  ✓   9 tests/e2e/mission-lifecycle.spec.ts:69:1 › QoL preset, Frontier overlay, single-mode trim, and Comms Delay triage sync packet work end-to-end (2.7s)
  ✓  10 tests/e2e/navigation.spec.ts:3:1 › the route map opens over both outer rings and preserves an outer stop in 3D (996ms)
  ✓  11 tests/e2e/navigation.spec.ts:28:1 › right-click can add or remove a draft stop without adding a sidebar panel (1.2s)
  ✓  12 tests/e2e/navigation.spec.ts:50:1 › a map point prefills the hazard form during travel (1.0s)
  ✓  13 tests/e2e/navigation.spec.ts:66:1 › a blocked stop stays visible until the user accepts a new itinerary (2.4s)
  ✓  14 tests/e2e/navigation.spec.ts:87:1 › a reported hazard changes the path immediately and the previous route can be reopened (3.1s)
  ✓  15 tests/e2e/production.spec.ts:3:1 › production static export loads the unified field workbench with sticky map and theme popup (1.3s)
  ✓  16 tests/e2e/production.spec.ts:37:1 › the synthetic fixture is visibly disclosed inside the unified workbench (397ms)
  ✓  17 tests/e2e/production.spec.ts:44:1 › mobile has no document-wide horizontal overflow (390ms)

  17 passed (36.5s)
```
