/**
 * SESHAT theme presets, seed tokens, and geometry/spacing parameters.
 * Seed values live in src/app/globals.css (`:root` and `:root[data-preset="<id>"]`);
 * TypeScript stores only ids, labels, and control bounds.
 */
export const PRESETS = [
  { id: 'jezero-paper', label: 'Jezero Field Paper', isDefault: true, summary: 'USGS topo paper · Mineral teal' },
  { id: 'mars-oxide', label: 'Mars Oxide', isDefault: false, summary: 'Duststone cream · Iron oxide' },
  { id: 'orbital-slate', label: 'Orbital Telemetry', isDefault: false, summary: 'Crisp chart white · Deep blue' },
  { id: 'high-contrast', label: 'Field High Contrast', isDefault: false, summary: 'Maximum legibility' },
] as const;

export type PresetId = (typeof PRESETS)[number]['id'];
export const DEFAULT_PRESET_ID: PresetId = 'jezero-paper';

export const SEEDS = [
  { name: '--seed-brand', label: 'Primary accent' },
  { name: '--seed-secondary', label: 'Secondary ink' },
  { name: '--seed-error', label: 'Hazard / warning' },
  { name: '--seed-light', label: 'Light canvas' },
  { name: '--seed-dark', label: 'Dark canvas' },
] as const;

export const PARAMS = [
  { name: '--param-scale', label: 'Interface scale', min: 0.9, max: 1.15, step: 0.05 },
  { name: '--param-density', label: 'Control density', min: 0.85, max: 1.2, step: 0.05 },
  { name: '--param-elevation', label: 'Elevation depth', min: 0, max: 2, step: 0.25 },
  { name: '--param-motion', label: 'Motion tempo', min: 0, max: 1.5, step: 0.25 },
] as const;

export const OPTIONS = [
  {
    attr: 'data-font',
    label: 'Typography',
    values: [
      { id: '', label: 'System Sans' },
      { id: 'serif', label: 'Field Serif' },
      { id: 'mono', label: 'Telemetry Mono' },
    ],
  },
] as const;
