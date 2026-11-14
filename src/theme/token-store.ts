/**
 * Runtime access and persistence for SESHAT's computed CSS seed system in globals.css.
 * Overrides write ONLY to --seed-*, --param-*, --token-radius-*, or root data attributes.
 */
import { DEFAULT_PRESET_ID, OPTIONS, PARAMS, PRESETS, SEEDS } from './presets';
import type { PresetId } from './presets';

const STORAGE_KEY = 'seshat-token-bench-v1';

const OVERRIDABLE = [
  ...SEEDS.map(s => s.name),
  ...PARAMS.map(p => p.name),
  '--token-radius-xs',
  '--token-radius-sm',
  '--token-radius-md',
  '--token-radius-lg',
] as const;

type PersistedAppearance = {
  preset?: PresetId;
  seeds?: Record<string, string>;
  params?: Record<string, number>;
  radiusPx?: number;
  options?: Record<string, string>;
};

const root = () => document.documentElement;

export function readToken(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(root()).getPropertyValue(name).trim();
}

export function subscribeTokens(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(root(), {
    attributes: true,
    attributeFilter: ['style', 'data-theme', 'data-preset', ...OPTIONS.map(o => o.attr)],
  });
  return () => observer.disconnect();
}

/** Converts any valid CSS color expression into `#rrggbb` using an offscreen 1x1 canvas. */
export function toHex(css: string): string {
  if (typeof document === 'undefined' || !css) return '';
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = 'transparent';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return '';
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function saveCurrentState() {
  if (typeof window === 'undefined') return;
  try {
    const el = root();
    const state: PersistedAppearance = {};
    const preset = el.dataset.preset as PresetId | undefined;
    if (preset && preset !== DEFAULT_PRESET_ID) state.preset = preset;
    const seeds: Record<string, string> = {};
    for (const s of SEEDS) {
      const val = el.style.getPropertyValue(s.name).trim();
      if (val) seeds[s.name] = val;
    }
    if (Object.keys(seeds).length) state.seeds = seeds;
    const params: Record<string, number> = {};
    for (const p of PARAMS) {
      const val = el.style.getPropertyValue(p.name).trim();
      if (val) {
        const parsed = Number(val);
        if (Number.isFinite(parsed)) params[p.name] = parsed;
      }
    }
    if (Object.keys(params).length) state.params = params;
    const radius = el.style.getPropertyValue('--token-radius-md').trim();
    if (radius) {
      const px = parseFloat(radius);
      if (Number.isFinite(px)) state.radiusPx = px;
    }
    const options: Record<string, string> = {};
    for (const o of OPTIONS) {
      const val = el.getAttribute(o.attr);
      if (val) options[o.attr] = val;
    }
    if (Object.keys(options).length) state.options = options;

    if (Object.keys(state).length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function hydrateStoredAppearance() {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedAppearance;
    if (parsed.preset && PRESETS.some(p => p.id === parsed.preset) && parsed.preset !== DEFAULT_PRESET_ID) {
      root().dataset.preset = parsed.preset;
    }
    if (parsed.seeds) {
      for (const s of SEEDS) {
        const hex = parsed.seeds[s.name];
        if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
          root().style.setProperty(s.name, hex);
        }
      }
    }
    if (parsed.params) {
      for (const p of PARAMS) {
        const val = parsed.params[p.name];
        if (typeof val === 'number' && Number.isFinite(val)) {
          root().style.setProperty(p.name, String(Math.min(p.max, Math.max(p.min, val))));
        }
      }
    }
    if (typeof parsed.radiusPx === 'number' && Number.isFinite(parsed.radiusPx)) {
      applyRadiusStyles(Math.min(18, Math.max(0, parsed.radiusPx)));
    }
    if (parsed.options) {
      for (const o of OPTIONS) {
        const val = parsed.options[o.attr];
        if (typeof val === 'string' && o.values.some(v => v.id === val) && val) {
          root().setAttribute(o.attr, val);
        }
      }
    }
  } catch {
    /* ignore corrupt localStorage entries */
  }
}

function applyRadiusStyles(mediumPx: number) {
  const style = root().style;
  style.setProperty('--token-radius-md', `${mediumPx}px`);
  style.setProperty('--token-radius-xs', `${Math.max(1, mediumPx * 0.4).toFixed(2)}px`);
  style.setProperty('--token-radius-sm', `${Math.max(2, mediumPx * 0.6).toFixed(2)}px`);
  style.setProperty('--token-radius-lg', `${Math.max(3, mediumPx * 1.4).toFixed(2)}px`);
}

export function setSeed(name: string, hex: string) {
  root().style.setProperty(name, hex);
  saveCurrentState();
}

export function setPreset(id: PresetId | null) {
  SEEDS.forEach(s => root().style.removeProperty(s.name));
  if (id && id !== DEFAULT_PRESET_ID) root().dataset.preset = id;
  else delete root().dataset.preset;
  saveCurrentState();
}

export function setRadius(mediumPx: number) {
  applyRadiusStyles(mediumPx);
  saveCurrentState();
}

export function setParam(name: string, value: number) {
  root().style.setProperty(name, String(value));
  saveCurrentState();
}

export function setOption(attr: string, id: string) {
  if (id) root().setAttribute(attr, id);
  else root().removeAttribute(attr);
  saveCurrentState();
}

export function resetTokens() {
  OVERRIDABLE.forEach(name => root().style.removeProperty(name));
  delete root().dataset.preset;
  OPTIONS.forEach(o => root().removeAttribute(o.attr));
  saveCurrentState();
}

export const getSeedSnapshot = (name: string) => toHex(readToken(name));
export const getRadiusSnapshot = () => {
  const value = parseFloat(readToken('--token-radius-md'));
  return Number.isFinite(value) ? value : 10;
};
export const getParamSnapshot = (name: string) => {
  const value = parseFloat(readToken(name));
  return Number.isFinite(value) ? value : 1;
};
export const getOptionSnapshot = (attr: string) => (typeof document === 'undefined' ? '' : root().getAttribute(attr) ?? '');
export const getPresetSnapshot = (): PresetId => {
  if (typeof document === 'undefined') return DEFAULT_PRESET_ID;
  const active = root().dataset.preset;
  return PRESETS.some(p => p.id === active) ? (active as PresetId) : DEFAULT_PRESET_ID;
};
export const hasOverridesSnapshot = () => {
  if (typeof document === 'undefined') return false;
  return (
    (root().dataset.preset !== undefined && root().dataset.preset !== DEFAULT_PRESET_ID) ||
    OPTIONS.some(o => root().hasAttribute(o.attr)) ||
    OVERRIDABLE.some(n => root().style.getPropertyValue(n) !== '')
  );
};
