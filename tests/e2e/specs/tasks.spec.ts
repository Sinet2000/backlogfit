/** Task lines: links are rendered safely, dangerous schemes never reach the DOM. */
import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { addTasks, id } from '../fixtures/ui.ts';

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
  // The rejected lines are reported, never silently dropped.
  await expect(id(page, 'toast').first()).toBeVisible();

  // Only the https line and the harmless plain-text title survive.
  await expect(page.getByTestId('task-item').first()).toBeVisible();
  for (const t of await page.getByTestId('task-item').allInnerTexts()) {
    expect(t.toLowerCase()).not.toMatch(/javascript:|data:/);
  }
  await id(page, 'btn-next').click();
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
    // Title is plain text: no markup is interpreted.
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
