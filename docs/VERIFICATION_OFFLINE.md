# SESHAT release verification

Run: 2026-11-14T06:49:55.511938+00:00
Mode: OFFLINE
Overall result: FAIL; offline PASS does not imply release PASS.

## FAIL: Python pipeline + security

```text
/usr/bin/python3: No module named pytest

```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (1.734997ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.773282ms)
  ✔ includes the 2-layer chunk neighborhood (5x5 = 25 chunks, 22x22 km) with verified binary files (2.819412ms)
✔ Mars geographic AEQD coordinate transforms (17.978375ms)
ℹ tests 46
ℹ suites 2
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1808.358034
```

## NOT EXECUTED (offline mode)

Next dependency installation, Next.js production build, Playwright production E2E, Vercel response headers, NASA source approval and deployment.
