# SESHAT release verification

Run: 2026-11-13T11:32:27.044841+00:00
Mode: RELEASE
Overall result: FAIL; offline PASS does not imply release PASS.

## PASS: Python pipeline + security

```text
...........................                                              [100%]
27 passed in 1.15s

```

## PASS: TypeScript scientific compile

```text

```

## PASS: Node scientific oracles

```text
  type: 'test'
  ...
1..31
# tests 31
# suites 0
# pass 31
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 91.979959

```

## FAIL: Dependency lockfile presence

```text

Traceback (most recent call last):
  File "<string>", line 1, in <module>
    from pathlib import Path; assert Path("pnpm-lock.yaml").is_file(), "Run pnpm install on a connected machine, then commit pnpm-lock.yaml"
                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
AssertionError: Run pnpm install on a connected machine, then commit pnpm-lock.yaml
```

## FAIL: Frontend lint

```text
Executable unavailable: pnpm
```

## FAIL: Next.js TypeScript build checks

```text
Executable unavailable: pnpm
```

## FAIL: Next.js production static export

```text
Executable unavailable: pnpm
```

## FAIL: Playwright real Next.js export

```text
Executable unavailable: pnpm
```
