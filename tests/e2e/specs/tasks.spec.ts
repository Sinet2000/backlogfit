import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { addTasks, createRoom, currentTask, id, nextTask, rowAction } from '../fixtures/ui.ts';

test('link tasks render as safe external links and javascript: is rejected @smoke', async ({
  page,
  people,
}) => {
  const room = await createRoomApi({ taskPolicy: 'links' });
  await joinAdmin(page, room.adminLink);
  const alice = await people.join(room.joinLink, 'Alice');

  page.on('dialog', (d) => {
    throw new Error(`unexpected dialog: ${d.message()}`);
  });
  await addTasks(page, [
    'https://tracker.example.com/browse/SCP-100 Checkout <b>bold</b>',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(2) Title',
    'data:text/html,<script>alert(3)</script>',
    '<img src=x onerror=alert(4)>',
  ]);
  await expect(id(page, 'toast').first()).toBeVisible();

  await expect(page.getByTestId('task-item').first()).toBeVisible();
  for (const t of await page.getByTestId('task-item').allInnerTexts()) {
    expect(t.toLowerCase()).not.toMatch(/javascript:|data:/);
  }
  await nextTask(page);
  for (const p of [page, alice.page]) {
    const items = p.getByTestId('task-item');
    await expect(items.first()).toBeVisible();
    const link = p.locator(
      ':is([data-testid="task-item"], [data-testid="current-task"]) a[href^="https://tracker.example.com/"]',
    );
    await expect(link.first()).toBeVisible();
    for (const a of await link.all()) {
      const rel = ((await a.getAttribute('rel')) ?? '').split(/\s+/);
      expect(rel).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
    await expect(
      p.locator(':is([data-testid="task-item"], [data-testid="current-task"]) b'),
    ).toHaveCount(0);
    await expect(
      p.locator(':is([data-testid="task-item"], [data-testid="current-task"]) img'),
    ).toHaveCount(0);
    await expect(id(p, 'current-task')).toContainText('<b>bold</b>');
    await expect(p.locator('a[href^="javascript:" i], a[href^="data:" i]')).toHaveCount(0);
    const all = await p
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).protocol));
    expect(all.every((proto) => proto === 'https:' || proto === 'http:')).toBe(true);
  }
});

test('ids policy keeps only the key of an issue URL and never stores the URL', async ({
  page,
  wire,
}) => {
  const room = await createRoomApi({ taskPolicy: 'ids' });
  await joinAdmin(page, room.adminLink);
  await addTasks(page, ['https://evil.example.com/browse/ABC-12']);
  await expect(page.locator('[data-testid="task-item"][data-key="ABC-12"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="task-item"] a[href*="evil.example.com"]')).toHaveCount(
    0,
  );
  expect(wire.received.some((f) => f.includes('evil.example.com'))).toBe(false);
});

const keys = (p: import('@playwright/test').Page) =>
  p.getByTestId('task-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));

test('tasks prepared in the configurator arrive in order; any task can be estimated now @smoke', async ({
  page,
  people,
}) => {
  const room = await createRoom(page, {
    tasks: ['SCP-1 First', 'SCP-2 Second', 'SCP-3 Third', 'SCP-1 First'],
    onStep: async (p) => {
      const items = p.getByTestId('prepared-item');
      if ((await items.count()) === 3) {
        await rowAction(items.nth(2), 'move-up');
        await rowAction(items.nth(1), 'move-up');
      }
    },
  });
  await expect(id(page, 'prepared-note')).toContainText('3 prepared tasks');
  await id(page, 'open-room').click();
  await id(page, 'join-name').fill('Admin');
  await id(page, 'join-submit').click();
  await expect.poll(() => keys(page)).toEqual(['SCP-3', 'SCP-1', 'SCP-2']);
  await expect(id(page, 'toast').filter({ hasText: '3 tasks added from your list' })).toBeVisible();
  await page.reload();
  await expect.poll(() => keys(page)).toEqual(['SCP-3', 'SCP-1', 'SCP-2']);

  const alice = await people.join(room.joinLink, 'Alice');
  await expect.poll(() => keys(alice.page)).toEqual(['SCP-3', 'SCP-1', 'SCP-2']);

  await rowAction(page.getByTestId('task-item').first(), 'move-down');
  await expect.poll(() => keys(alice.page)).toEqual(['SCP-1', 'SCP-3', 'SCP-2']);

  await nextTask(page);
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-1');
  await addTasks(page, ['SCP-9 Raised in standup'], { estimateNow: true });
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-9');
  await page
    .locator('[data-testid="task-item"][data-key="SCP-2"]')
    .getByTestId('task-select')
    .click();
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-2');

  await page.reload();
  await expect.poll(() => keys(page)).toEqual(['SCP-1', 'SCP-3', 'SCP-2', 'SCP-9']);
});
