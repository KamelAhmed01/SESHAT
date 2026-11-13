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
    '--color-background-body': ['#f2eee8', '#0a0e11'],
    '--color-background-surface': ['#fbf7f0', '#0f1417'],
    '--color-background-card': ['#f9f3eb', '#151e21'],
    '--color-background-popover': ['#fbf7f0', '#151e21'],
    '--color-background-muted': ['#ebe5dd', '#1c272a'],
    '--color-text-primary': ['#202e30', '#eae4db'],
    '--color-text-secondary': ['#526467', '#a8b5b1'],
    '--color-accent': ['#a5502f', '#e5a582'],
    '--color-accent-muted': ['#a5502f1c', '#e5a58229'],
    '--color-text-accent': ['#8b3d23', '#edb896'],
    '--color-on-accent': ['#fffaf2', '#11191c'],
    '--color-border': ['#c8c9c2', '#2a3438'],
    '--color-border-emphasized': ['#9eaaa6', '#647777'],
    '--color-text-success': ['#306342', '#cbd9b4'],
    '--color-text-warning': ['#8c4e26', '#e9bb91'],
    '--color-text-error': ['#a13d31', '#f0a08b'],
    '--color-icon-accent': ['#a5502f', '#e5a582'],
    '--radius-inner': '3px',
    '--radius-element': '5px',
    '--radius-container': '6px',
  },
  components: {
    button: {
      base: { fontWeight: '600', letterSpacing: '0.015em' },
    },
  },
});
