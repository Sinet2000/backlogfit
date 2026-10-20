import { mkdir } from 'node:fs/promises';
import { type BrowserContext, expect, test } from '@playwright/test';
import { createRoomApi } from '../fixtures/api.ts';
import {
  addTasks,
  createRoom,
  currentTask,
  hostAction,
  id,
  nextTask,
  submitJoin,
  vote,
} from '../fixtures/ui.ts';

const OUT = new URL('../../../docs/assets/screenshots/', import.meta.url).pathname;
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
  await nextTask(page);
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
  await id(page, 'btn-save-next').click();
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
  await hostAction(page, 'btn-final');
  await page.mouse.move(0, 0);
  await page.screenshot(shot('results'));
  await page.screenshot({ ...shot('results-full'), fullPage: true });
  await Promise.all(contexts.map((c) => c.close()));
});

test('teams: invite links, a team task and the per-team results', async ({
  page,
  browser,
  contextOptions,
}) => {
  const teams = [
    { id: 'dev', name: 'Dev' },
    { id: 'qa', name: 'QA' },
  ];
  const room = await createRoomApi({ autoReveal: true, theme: 'corporate', teams });
  await page.goto(room.adminLink);
  await submitJoin(page, 'Maria (Scrum Master)', { spectator: true, team: '' });
  const contexts: BrowserContext[] = [];
  const pages = [];
  for (const [name, team] of [
    ['Alex', 'dev'],
    ['Jonas', 'dev'],
    ['Priya', 'qa'],
    ['Mei', 'qa'],
  ] as const) {
    const ctx = await browser.newContext(contextOptions);
    contexts.push(ctx);
    const p = await ctx.newPage();
    await p.goto(`${room.joinLink}@${team}`);
    await submitJoin(p, name, { team: 'keep' });
    pages.push(p);
  }
  const [alex, jonas, priya, mei] = pages;
  if (!alex || !jonas || !priya || !mei) throw new Error('team not joined');
  await addTasks(page, ['SCP-3660 Checkout redesign', 'SCP-3661 Regression test plan #qa']);
  await nextTask(page);
  for (const [p, v] of [
    [alex, '5'],
    [jonas, '8'],
    [priya, '3'],
    [mei, '3'],
  ] as const) {
    await vote(p, v);
  }
  await expect(id(page, 'team-summary')).toBeVisible();
  await page.screenshot(shot('teams-reveal'));
  await id(page, 'btn-save-next').click();
  await expect(currentTask(alex)).toHaveAttribute('data-key', 'SCP-3661');
  await alex.mouse.move(0, 0);
  await alex.screenshot(shot('teams-follow-along'));
  await id(page, 'btn-invite').click();
  await page.locator('[data-testid="invite-tab"][data-team="qa"]').click();
  await page.screenshot(shot('teams-invite'));
  await Promise.all(contexts.map((c) => c.close()));
});
