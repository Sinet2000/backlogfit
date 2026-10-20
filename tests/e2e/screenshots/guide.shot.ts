/**
 * README / Manager Guide screenshots at 1440×900, light Corporate theme, written to
 * tests/e2e/artifacts/screenshots/. Data is fixed so reruns produce the same pictures.
 */
import { mkdir } from 'node:fs/promises';
import { type BrowserContext, expect, test } from '@playwright/test';
import { createRoomApi } from '../fixtures/api.ts';
import { addTasks, createRoom, currentTask, id, submitJoin, vote } from '../fixtures/ui.ts';

const OUT = new URL('../artifacts/screenshots/', import.meta.url).pathname;
const shot = (name: string) => ({ path: `${OUT}${name}.png`, animations: 'disabled' as const });

test.beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
});

test('landing and configurator', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot(shot('landing'));
  await createRoom(page, {
    preset: 'fibonacci',
    autoReveal: false,
    tasks: [
      'SCP-3655 Fix login timeout',
      'SCP-3656 Export results to PDF',
      'SCP-3701 Audit log for admins',
      'SCP-3702 Dark mode for reports',
    ],
    onStep: async (p, step) => {
      await p.screenshot(shot(`configurator-step-${step}`));
    },
  });
  await page.screenshot(shot('configurator-created'));
});

test('voter view, reveal and results', async ({ page, browser, contextOptions }) => {
  const room = await createRoomApi({ autoReveal: false, theme: 'corporate' });
  await page.goto(room.adminLink);
  await submitJoin(page, 'Maria (Scrum Master)', { spectator: true });

  const team = ['Alex', 'Priya', 'Jonas', 'Mei'];
  const contexts: BrowserContext[] = [];
  const pages = [];
  for (const name of team) {
    const ctx = await browser.newContext(contextOptions);
    contexts.push(ctx);
    const p = await ctx.newPage();
    await p.goto(room.joinLink);
    await submitJoin(p, name);
    pages.push(p);
  }
  await addTasks(page, [
    'SCP-3655 Password reset email',
    'SCP-3656 Fix login on Safari',
    'SCP-3657 Export invoices as PDF',
  ]);
  await id(page, 'btn-next').click();
  const [alex, priya, jonas, mei] = pages;
  if (!alex || !priya || !jonas || !mei) throw new Error('team not joined');
  await expect(currentTask(alex)).toHaveAttribute('data-key', 'SCP-3655');

  await vote(alex, '5');
  await vote(priya, '3');
  await alex.mouse.move(0, 0);
  await alex.screenshot(shot('voter'));
  await vote(jonas, '5');
  await vote(mei, '5');
  await page.screenshot(shot('admin-voting'));

  await id(page, 'btn-reveal').click();
  await expect(id(alex, 'reveal-results')).toBeVisible();
  await alex.screenshot(shot('reveal'));
  await page.screenshot(shot('admin-reveal'));

  await page.locator('[data-testid="final-value"][data-value="5"]').first().click();
  const finalBtn = id(page, 'btn-final');
  if (await finalBtn.isVisible().catch(() => false)) await finalBtn.click();
  await id(page, 'btn-next').click();
  await expect(currentTask(alex)).toHaveAttribute('data-key', 'SCP-3656');
  for (const [p, v] of [
    [alex, '8'],
    [priya, '8'],
    [jonas, '5'],
    [mei, '8'],
  ] as const) {
    await vote(p, v);
  }
  await id(page, 'btn-reveal').click();
  await page.locator('[data-testid="final-value"][data-value="8"]').first().click();
  if (await finalBtn.isVisible().catch(() => false)) await finalBtn.click();
  await page.mouse.move(0, 0);
  await page.screenshot(shot('results'));
  await page.screenshot({ ...shot('results-full'), fullPage: true });
  await Promise.all(contexts.map((c) => c.close()));
});
