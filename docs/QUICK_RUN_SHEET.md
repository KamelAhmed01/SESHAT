# SESHAT solo release checklist

Use the [mission plan](MISSION_LIFECYCLE.md) for the exact browser rehearsal, source downloads, and Cairo timing. The local submission cutoff is **Saturday, November 14 at 1:00 p.m. Cairo time**. Aim to submit by 12:15 p.m.

1. Activate the project Python environment, install the pinned frontend dependencies, and run the release verifier.

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -r pipeline/requirements.txt
   pnpm install --frozen-lockfile
   pnpm exec playwright install chromium
   pnpm verify
   ```

2. Run `pnpm start:export` and open `http://127.0.0.1:4173/`. Rehearse the approved baseline, Shuyak completion, inaccessible Hazeltop, approved revision, return, and JSON export. Keep a copy of `out/` for offline rehearsal.
3. Check the terrain sources and target overlap against the [data audit](MISSION_LIFECYCLE.md#3-resource-audit-and-downloads). Record the supporting review and keep the current source-review label. Archive the organizer's authorization and the Resources listing.
4. Authenticate and link the intended Vercel project. Publish the tested build and verify the public URL, map, mission scenario, and [response headers](SECURITY_AND_DEPLOYMENT.md). Repeat the check in a signed-out browser.
5. Prepare the English demo and project fields. Test both public URLs from a signed-out browser. Submit through the Cairo form and global team Project tab and retain both receipts.

If Vercel or the custom domain fails, use the offline export to rehearse while restoring the required public link. If the science review remains open, disclose the source-review status in the demo and submission.
