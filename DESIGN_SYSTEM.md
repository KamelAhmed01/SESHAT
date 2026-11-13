# SESHAT Visual Language & Design System

**Position:** A dark warm-obsidian planetary surface-science Command Center workbench prioritizing clear spatial terrain context, route legibility, and quantitative reserve telemetry.

- **UI Foundation**: Next.js App Router + React 19 + Tailwind CSS v4 + Meta Astryx (`@astryxdesign/core`) with CSS cascade layers (`@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;`).
- **Bespoke Scientific Components**: Leaflet `CRS.Simple` cartographic grid, Marching Squares DEM elevation contours, Perseverance surface camera viewer, SVG elevation profiles, dual SVG donut charts, and custom `<progress>` reserve bars.
- **Command Center Palette**:
  - Backdrop & shell surfaces: `#110f0d`, `#181512`, `#221f1c`, elevated `#2b2723`
  - Primary text & secondary muted text: `#f5f0eb`, `#a89f96`
  - Structural borders: `#332e2a`, `#4e463f`
  - Active traverse & primary actions: `#e58e26`, `#f3a833`
  - Return corridor & healthy reserves: `#10b981`, `#34d399`
- **Clarity & Honesty**: Reserve status indicators (`ROBUST`, `MARGINAL`, `INFEASIBLE`, `UNKNOWN`), synthetic scene disclosures (`DEMO_SYNTHETIC`), and unverified data gates (`SOURCE_REVIEW_REQUIRED`) are explicitly labeled without fabricated telemetry or placeholder percentages.
- **Astryx Theme Extension**: Defined in [`src/themes/seshat/seshatTheme.ts`](src/themes/seshat/seshatTheme.ts) and mounted in [`src/app/providers.tsx`](src/app/providers.tsx).

## Visual Acceptance Checks

Verify desktop (`1440×900` and `1280×720`) and mobile (`390×844`) views across planning, execution/replan review, opportunity frontier, synthetic test mode, keyboard navigation, and zero horizontal document overflow. Record visual notes in [`docs/validation.md`](docs/validation.md).
