/**
 * Theme × mode. Mode comes from emulated media (prefers-color-scheme, prefers-contrast); the theme
 * (Corporate/Colorful) from the room config, or from `theme-switcher` where the page has one.
 */
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
 * Pick a theme/mode through the theme switcher, whatever its form (select, radio group or
 * menu). Returns false when the page has no switcher.
 */
export async function useSwitcher(page: Page, theme: Theme, mode: Mode): Promise<boolean> {
  const sw = page.getByTestId('theme-switcher');
  if ((await sw.count()) === 0) return false;
  const tag = await sw.evaluate((el) => el.tagName.toLowerCase());
  const want = [theme, mode];
  if (tag === 'select') {
    const options = await sw
      .locator('option')
      .evaluateAll((os) =>
        os.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent ?? '' })),
      );
    const hit = options.find((o) =>
      want.every((w) => `${o.value} ${o.label}`.toLowerCase().includes(w.replace('-', ''))),
    );
    if (hit) {
      await sw.selectOption(hit.value);
      return true;
    }
  }
  // Nested selects/radios: one control per dimension.
  for (const w of want) {
    const sel = sw.locator('select');
    for (const s of await sel.all()) {
      const values = await s
        .locator('option')
        .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      const v = values.find((x) => x.toLowerCase().replace('-', '') === w.replace('-', ''));
      if (v) await s.selectOption(v);
    }
    const radio = sw.getByRole('radio', { name: new RegExp(w.replace('-', '.?'), 'i') });
    if ((await radio.count()) > 0) await radio.first().check();
  }
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
