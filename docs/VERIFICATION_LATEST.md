# SESHAT release verification

Run: 2026-11-14T05:54:17.945541+00:00
Mode: OFFLINE
Overall result: FAIL; offline PASS does not imply release PASS.

## FAIL: Python pipeline + security

```text
/usr/bin/python3: No module named pytest

```

## FAIL: TypeScript scientific compile

```text
Executable unavailable: tsc
```

## PASS: Node scientific oracles

```text
  ✔ matches manifest geographicBounds and boundary polygon closely (4.522878ms)
  ✔ returns null outside the 20 m AEQD grid (browse-only area) (2.044281ms)
  ✔ handles antimeridian wrapping and computes realistic spherical Mars distances (0.84637ms)
✔ Mars geographic AEQD coordinate transforms (14.328109ms)
ℹ tests 45
ℹ suites 2
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2155.228441
```

## NOT EXECUTED (offline mode)

Next dependency installation, Next.js production build, Playwright production E2E, Vercel response headers, NASA source approval and deployment.
