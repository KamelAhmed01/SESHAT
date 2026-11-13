# Implementation status — authorized H0 scaffold

## Executed and proved in the authoring environment

- [x] Source tree, Next.js App Router static export configuration, Meta Astryx component/provider CSS layer foundation, Tailwind v4 and Leaflet local-grid viewer created.
- [x] Deterministic mission clock, manifest verifier, inspectable no-data/UNKNOWN state, and scenario feasibility engine implemented.
- [x] SciPy directed 4/8-neighbor graph compiler with no-corner-cut, slope constraints, source/no-data masks, outward/reverse Dijkstra and little-endian binary exporter.
- [x] 12 TypeScript-engine synthetic oracles passed using global TypeScript and Node test runner.
- [x] 6 Python synthetic oracle tests passed in pytest.
- [ ] Real Mars GIS source inspected, georeferenced and covered by a NASA official challenge Resource: **not yet**.
- [ ] Target observations and positions proven: **not yet**.
- [ ] `pnpm install`, browser/Next production build, custom Astryx theme generation and screenshots: **not run**; authoring container cannot reach npm registry.
- [ ] Vercel deployment and custom domain: **not configured**; no accessible team repository.
- [ ] Browser E2E checks, feature acceptance and Global Awards official submission: **not yet**.

## Handoff rules

The checked-in H0 model parameters and timer are research **scenario assumptions**. Actual Mars output requires reviewed source inputs. Do not change the bundled manifest to VERIFIED for screenshot aesthetics. Run `pnpm install` on an internet-connected team machine, commit the generated `pnpm-lock.yaml`, switch CI to `--frozen-lockfile`, and run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before claiming the frontend works. The H3 Astryx custom-theme work remains a separate quality gate.
