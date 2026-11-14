/**
 * SESHAT Astryx theme, extending Meta's Neutral design system and compiled via
 * `pnpm exec astryx theme build src/themes/seshat/seshatTheme.ts --out src/themes/seshat/seshat.css`.
 * Runtime seed/preset/scale overrides in `src/app/globals.css` layer on top via the
 * computed Single Source of Truth bridge.
 */
import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

export const seshatTheme = defineTheme({
  name: 'seshat',
  extends: neutralTheme,
  tokens: {
    '--color-background-body': ['#f7f5ee', '#141210'],
    '--color-background-surface': ['#efefe7', '#1c1916'],
    '--color-background-card': ['#fcfbf7', '#231f1b'],
    '--color-background-popover': ['#fcfbf7', '#292420'],
    '--color-background-muted': ['#e6e4da', '#2e2924'],
    '--color-text-primary': ['#292d29', '#ede8df'],
    '--color-text-secondary': ['#5c655e', '#b5ada1'],
    '--color-accent': ['#10584e', '#4ab3a3'],
    '--color-accent-muted': ['#e0ece6', '#183631'],
    '--color-text-accent': ['#10584e', '#65cbbd'],
    '--color-on-accent': ['#ffffff', '#0b1815'],
    '--color-border': ['#d9ddd3', '#3b3530'],
    '--color-border-emphasized': ['#aab3a9', '#61584f'],
    '--color-text-success': ['#10584e', '#4ab3a3'],
    '--color-text-warning': ['#9c530b', '#f3a833'],
    '--color-text-error': ['#9d452e', '#f87171'],
    '--color-icon-accent': ['#10584e', '#4ab3a3'],
    '--radius-inner': '4px',
    '--radius-element': '6px',
    '--radius-container': '10px',
  },
  components: {
    button: {
      base: { fontWeight: '600', letterSpacing: '0.01em' },
    },
  },
});
