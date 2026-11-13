/**
 * SESHAT Astryx theme, inherited from Meta's Neutral design system.
 * This uses the documented runtime `defineTheme` path until the team runs
 * `pnpm exec astryx theme build` against the installed version on a connected
 * machine. It is intentionally NOT claimed as a precompiled artifact.
 *
 * The map, data visualization and scientific states remain SESHAT-owned.
 */
import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

export const seshatTheme = defineTheme({
  name: 'seshat',
  extends: neutralTheme,
  tokens: {
    '--color-background-body': ['#f2eee8', '#110f0d'],
    '--color-background-surface': ['#fbf7f0', '#181512'],
    '--color-background-card': ['#f9f3eb', '#221f1c'],
    '--color-background-popover': ['#fbf7f0', '#221f1c'],
    '--color-background-muted': ['#ebe5dd', '#2c2824'],
    '--color-text-primary': ['#202e30', '#f5f0eb'],
    '--color-text-secondary': ['#526467', '#a89f96'],
    '--color-accent': ['#c26d18', '#e58e26'],
    '--color-accent-muted': ['#c26d181c', '#e58e2629'],
    '--color-text-accent': ['#9c530b', '#f3a833'],
    '--color-on-accent': ['#fffaf2', '#14110f'],
    '--color-border': ['#c8c9c2', '#332e2a'],
    '--color-border-emphasized': ['#9eaaa6', '#574e47'],
    '--color-text-success': ['#107c41', '#10b981'],
    '--color-text-warning': ['#b45309', '#f59e0b'],
    '--color-text-error': ['#b91c1c', '#ef4444'],
    '--color-icon-accent': ['#c26d18', '#f3a833'],
    '--radius-inner': '6px',
    '--radius-element': '10px',
    '--radius-container': '16px',
  },
  components: {
    button: {
      base: { fontWeight: '600', letterSpacing: '0.015em' },
    },
  },
});
