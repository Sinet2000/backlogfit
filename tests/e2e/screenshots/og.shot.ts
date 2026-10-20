/** OG images (1200×630) from tests/e2e/og/template.html into tests/e2e/artifacts/og/. */
import { mkdir, readFile } from 'node:fs/promises';
import { test } from '@playwright/test';

const OUT = new URL('../artifacts/og/', import.meta.url).pathname;
const TEMPLATE = new URL('../og/template.html', import.meta.url);

const VARIANTS = [
  {
    file: 'og-default',
    title: 'Fit the backlog. Estimate together.',
    subtitle: 'Story point estimation for agile teams. Free, open source, no accounts.',
  },
  {
    file: 'og-planning-poker-alternative',
    title: 'A planning poker alternative',
    subtitle:
      'Share a link, vote in private, reveal together. Nothing is stored after the session.',
  },
  {
    file: 'og-guide',
    title: 'Manager Guide',
    subtitle: 'Run your first estimation session in five minutes.',
  },
  {
    file: 'og-faq',
    title: 'Questions, answered',
    subtitle: 'How Backlogfit keeps votes secret and your data out of anyone’s database.',
  },
  {
    file: 'og-story-points',
    title: 'How story point estimation works',
    subtitle: 'Fibonacci, T-shirt sizes and consensus, explained without jargon.',
  },
];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

test.use({ viewport: { width: 1200, height: 630 } });

test('og images', async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  const template = await readFile(TEMPLATE, 'utf8');
  for (const v of VARIANTS) {
    const html = template
      .replace('{{title}}', escapeHtml(v.title))
      .replace('{{subtitle}}', escapeHtml(v.subtitle));
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${OUT}${v.file}.png`,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
  }
});
