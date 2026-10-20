import type { Page } from '@playwright/test';

export const THEMES = ['corporate', 'colorful'] as const;
export const MODES = ['light', 'dark', 'high-contrast'] as const;
export type Theme = (typeof THEMES)[number];
export type Mode = (typeof MODES)[number];

export async function emulateMode(page: Page, mode: Mode): Promise<void> {
  await page.emulateMedia({
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    contrast: mode === 'high-contrast' ? 'more' : 'no-preference',
  });
}

/**
 * Pick a theme/mode through the header's theme switcher (a trigger button that opens radio groups
 * `theme-<corporate|colorful>` and `mode-<system|light|dark|contrast>`). Returns false when the
 * page has no switcher.
 */
export async function useSwitcher(page: Page, theme: Theme, mode: Mode): Promise<boolean> {
  const sw = page.getByTestId('theme-switcher');
  if ((await sw.count()) === 0 || !(await sw.first().isVisible())) return false;
  const radio = (tid: string) => page.getByTestId(tid);
  if (!(await radio(`theme-${theme}`).isVisible())) await sw.first().click();
  await radio(`theme-${theme}`).check();
  await radio(`mode-${mode === 'high-contrast' ? 'contrast' : mode}`).check();
  await page.keyboard.press('Escape');
  return true;
}

/** Remember the current theme attributes for assertions/screenshot names. */
export function themeAttrs(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() => {
    const r = document.documentElement;
    return {
      theme: r.getAttribute('data-theme'),
      mode: r.getAttribute('data-mode'),
      scheme: getComputedStyle(r).colorScheme,
    };
  });
}
