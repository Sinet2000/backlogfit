import { localStore } from './room/storage.ts';
import { LEGACY_THEME_KEYS, STORAGE_KEYS } from './storage-keys.ts';

export type Theme = 'corporate' | 'colorful';
export type Mode = 'system' | 'light' | 'dark' | 'contrast';

export const THEME_LABELS: Record<Theme, string> = { corporate: 'Corporate', colorful: 'Colorful' };
export const MODE_LABELS: Record<Mode, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
};

function stored(key: 'theme' | 'mode'): string | null {
  const s = localStore();
  return s.getItem(STORAGE_KEYS[key]) ?? s.getItem(LEGACY_THEME_KEYS[key]);
}

export function readTheme(): { theme: Theme; mode: Mode } {
  const t = stored('theme');
  const m = stored('mode');
  return {
    theme: t === 'colorful' ? 'colorful' : 'corporate',
    mode: m === 'light' || m === 'dark' || m === 'contrast' ? m : 'system',
  };
}

export function hasThemePreference(): boolean {
  return stored('theme') !== null;
}

export function applyTheme(theme: Theme, mode: Mode, persist = true): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'colorful') root.setAttribute('data-theme', 'colorful');
  else root.removeAttribute('data-theme');
  if (mode === 'system') root.removeAttribute('data-mode');
  else root.setAttribute('data-mode', mode);
  if (!persist) return;
  const s = localStore();
  s.removeItem(LEGACY_THEME_KEYS.theme);
  s.removeItem(LEGACY_THEME_KEYS.mode);
  if (theme === 'corporate') s.removeItem(STORAGE_KEYS.theme);
  else s.setItem(STORAGE_KEYS.theme, theme);
  if (mode === 'system') s.removeItem(STORAGE_KEYS.mode);
  else s.setItem(STORAGE_KEYS.mode, mode);
}
