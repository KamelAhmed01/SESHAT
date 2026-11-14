/**
 * Color mode store for SESHAT ('light' | 'dark' | 'system').
 * Defaults to 'light' (Jezero Field Paper) when unset so `/` boots consistently
 * in light mode with zero dark flash, while supporting explicit Dark and OS System modes.
 */
export type ModePreference = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'seshat-theme-mode';

const listeners = new Set<() => void>();

export function readModePreference(): ModePreference {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* private browsing or blocked storage falls back to default light */
  }
  return 'light';
}

export function resolveMode(pref: ModePreference): ResolvedMode {
  if (pref === 'light' || pref === 'dark') return pref;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getResolvedModeSnapshot(): ResolvedMode {
  return resolveMode(readModePreference());
}

export function getModePreferenceSnapshot(): ModePreference {
  return readModePreference();
}

export const getResolvedModeServerSnapshot = (): ResolvedMode => 'light';
export const getModePreferenceServerSnapshot = (): ModePreference => 'light';

export function subscribeMode(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window === 'undefined') return () => listeners.delete(onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_MODE_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', onChange);
  };
}

export function setModePreference(next: ModePreference) {
  try {
    if (next === 'light') {
      window.localStorage.removeItem(THEME_MODE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
    }
  } catch {
    /* ignore persistence error; update DOM/subscribers below */
  }
  syncDocumentTheme(resolveMode(next));
  listeners.forEach(listener => listener());
}

export function syncDocumentTheme(resolved: ResolvedMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', resolved);
  }
}

/** Pre-paint FOUC-prevention script injected in RootLayout <head>. Keep in sync with readModePreference(). */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_MODE_STORAGE_KEY}')||'light';var m=(p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light';document.documentElement.setAttribute('data-theme',m);var meta=document.querySelector('meta[name="color-scheme"]');if(meta)meta.content=m;}catch(e){}})();`;
