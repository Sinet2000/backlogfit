/** Theme and mode preference, mirrored on <html data-theme / data-mode> (see static/theme.js). */
import { localStore } from './room/storage.ts';

export type Theme = 'corporate' | 'colorful';
export type Mode = 'system' | 'light' | 'dark' | 'contrast';

export const THEME_LABELS: Record<Theme, string> = { corporate: 'Corporate', colorful: 'Colorful' };
export const MODE_LABELS: Record<Mode, string> = {
  system: 'Match my device',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
};

export function readTheme(): { theme: Theme; mode: Mode } {
  const s = localStore();
  const t = s.getItem('bf-theme');
  const m = s.getItem('bf-mode');
  return {
    theme: t === 'colorful' ? 'colorful' : 'corporate',
    mode: m === 'light' || m === 'dark' || m === 'contrast' ? m : 'system',
  };
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
  if (theme === 'corporate') s.removeItem('bf-theme');
  else s.setItem('bf-theme', theme);
  if (mode === 'system') s.removeItem('bf-mode');
  else s.setItem('bf-mode', mode);
}
