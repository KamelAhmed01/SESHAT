# SESHAT release verification

Run: 2026-11-14T10:01:04.929207+00:00
Mode: RELEASE
Overall result: FAIL; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text

..............................                                           [100%]
30 passed in 1.03s
```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.133666ms)
  ✔ includes the 2-layer chunk neighborhood (5x5 = 25 chunks, 22x22 km) with verified binary files (1.300625ms)
  ✔ allows navigation stops and calculates terrain-aware routes into neighborhood chunks (189.595125ms)
✔ Mars geographic AEQD coordinate transforms (193.581333ms)
ℹ tests 50
ℹ suites 2
ℹ pass 50
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 552.200292
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

## FAIL: Next.js production static export

```text
  location: undefined
}


> seshat@0.1.0 build /Users/kamelahmed/Projects/SESHAT
> next build

▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 31ms

  Creating an optimized production build ...
 ELIFECYCLE  Command failed with exit code 1.
```

## FAIL: Playwright real Next.js export

```text
         |                        ^
      12 |   expect(reliefBox!.x + reliefBox!.width).toBeLessThan(mapBox!.x + mapBox!.width);
      13 |   await page.mouse.click(reliefBox!.x + reliefBox!.width * 0.85, reliefBox!.y + reliefBox!.height * 0.49);
      14 |   const inspection = page.getByRole('region', {name: 'Selected map point'});
        at /Users/kamelahmed/Projects/SESHAT/tests/e2e/navigation.spec.ts:11:24

    Error Context: test-results/navigation-the-route-map-o-6e235-eserves-an-outer-stop-in-3D/error-context.md

  1 failed
    tests/e2e/navigation.spec.ts:3:1 › the route map opens over both outer rings and preserves an outer stop in 3D
  14 passed (26.1s)
 ELIFECYCLE  Command failed with exit code 1.
```

## Follow-up on the final route implementation

- Default Turbopack build failed while processing Leaflet CSS. The Next panic log reports `binding to a port: Operation not permitted`. Playwright ran against the previous export within that strict check.
- `pnpm exec next build --webpack` compiled and statically exported `/` and `/dev/`.
- `pnpm test:e2e` on the fresh export passed 15/15. It covered entering Ring 2 from the map, routing back to the landing site, switching to the 25-chunk 3D view, applying a hazard detour, and asking the operator before skipping a blocked stop.
- Desktop and mobile screenshots were taken on the fresh export. The release check above retains its FAIL status.

The previous live Vercel and TLS probe is recorded in [the earlier checkpoint](https://github.com/KamelAhmed01/SESHAT/blob/165aba9/docs/VERIFICATION_LATEST.md). This implementation was checked on localhost.
