"""Strict execution of available local tests and optional production release checks.

--offline: Python + TypeScript + Node + security; requires globally installed tsc.
--release: offline checks PLUS installed pnpm/Next checks, build and Playwright.
No missing runtime or failed test is silently skipped. Writes a report every run.
"""
from __future__ import annotations
import argparse
from datetime import datetime,timezone
from pathlib import Path
import subprocess
import sys
import shutil

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--offline',action='store_true')
    group.add_argument('--release',action='store_true')
    args=parser.parse_args()
    commands=[
        ('Python pipeline + security', [sys.executable,'-m','pytest','-q','pipeline/tests','tests/security']),
        ('TypeScript scientific compile', ['tsc','-p','tsconfig.engine.json']),
        ('Node scientific oracles', ['node','--test',*sorted(str(path.relative_to(ROOT)) for path in (ROOT/'tests/unit').glob('*.test.cjs'))]),
    ]
    if args.release:
        commands.extend([
            ('Dependency lockfile presence', [sys.executable,'-c',
              'from pathlib import Path; assert Path("pnpm-lock.yaml").is_file(), "Run pnpm install on a connected machine, then commit pnpm-lock.yaml"']),
            ('Frontend lint', ['pnpm','lint']),
            ('Next.js TypeScript build checks', ['pnpm','typecheck']),
            ('Next.js production static export', ['pnpm','build']),
            ('Playwright real Next.js export', ['pnpm','test:e2e']),
        ])
    lines=['# SESHAT release verification', '',
        f'Run: {datetime.now(timezone.utc).isoformat()}',
        f'Mode: {"RELEASE" if args.release else "OFFLINE"}', '']
    all_good=True
    for label,cmd in commands:
        if shutil.which(cmd[0]) is None:
            success=False;detail=f'Executable unavailable: {cmd[0]}'
        else:
            try:
                done=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=150)
                success=done.returncode==0
                detail='\n'.join((done.stderr+'\n'+done.stdout).splitlines()[-12:])
            except (OSError,subprocess.TimeoutExpired) as exc:
                success=False; detail=str(exc)
        all_good = all_good and success
        lines.extend([f'## {"PASS" if success else "FAIL"}: {label}', '', '```text',detail,'```',''])
        print(f'{"PASS" if success else "FAIL"} {label}',flush=True)
    if args.offline:
        lines.extend(['## NOT EXECUTED (offline mode)', '',
          'Next dependency installation, Next.js production build, Playwright production E2E, Vercel response headers, NASA source approval and deployment.', ''])
    lines.insert(4, f'Overall result: {"PASS" if all_good else "FAIL"}; offline PASS does not imply release PASS.');
    report=ROOT/('docs/VERIFICATION_RELEASE.md' if args.release else 'docs/VERIFICATION_OFFLINE.md')
    content='\n'.join(lines)
    report.write_text(content)
    (ROOT/'docs/VERIFICATION_LATEST.md').write_text(content)
    print(f'Report: {report}',flush=True)
    return 0 if all_good else 1

if __name__=='__main__':
    raise SystemExit(main())
