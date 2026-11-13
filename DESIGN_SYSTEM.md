# SESHAT visual language — H0 design contract

**Position:** a serious, meticulously typeset planetary-science instrument, not a space-themed startup dashboard.

- Astryx (`@astryxdesign/core`) supplies buttons, accessible controls, interaction states, and theme. No shadcn UI.
- Custom scientific components: cartographic grid, Mars DEM overlays, frontier, route profile, decision story.
- Current H0 palette (pending Hams/Kamel approval): backdrop `#0a0e11`, surface `#0f1417`, text `#eae4db`, secondary `#9ca5a2`, borders `#2a3438`, restrained copper `#ce8967`.
- No glass blur, purple gradients, generic AI hero or fake scientific telemetry. Details are editorial and functional.
- Map is dominant; left panel contains *science choices*, right panel *clock and evidence-based feasibility*.
- Use consistent 4/8 px spacing and always label `UNKNOWN`, not just a warning color.
- The **custom Astryx SESHAT theme source is already wired** into `src/app/providers.tsx` using the documented `defineTheme` extension. Verify its real package build/SSR and compile via the installed CLI on the networked machine; do not claim compiled theme acceptance until it actually builds. Keep the exact Tailwind layer order.
- No external font calls. The H0 fallback uses platform sans; choose/local-bundle licensed Inter/Geist + mono when team confirms rights.

## Visual acceptance (not yet passed)

Screenshots at 1440×900 and 1280×720; evidence drawer; keyboard focus; time-state transitions; verified/unknown/error cases; mobile map and bottom panels; tested by Hams and Kamel. Capture evidence in `docs/validation.md`.
