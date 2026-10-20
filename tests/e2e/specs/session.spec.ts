/**
 * Full session: configurator (Fibonacci) → admin + 3 voters + 1 spectator → tasks → vote →
 * reveal → stats → final → next → exports.
 */
import { readFile } from 'node:fs/promises';
import type { Download, Page } from '@playwright/test';
import { expect, test } from '../fixtures/test.ts';
import {
  addTasks,
  createRoom,
  currentTask,
  expectVoted,
  id,
  participant,
  revealCards,
  selectedValues,
  statNumber,
  submitJoin,
  vote,
} from '../fixtures/ui.ts';

async function downloadText(page: Page, testId: string): Promise<{ d: Download; text: string }> {
  const [d] = await Promise.all([page.waitForEvent('download'), id(page, testId).click()]);
  const path = await d.path();
  return { d, text: await readFile(path, 'utf8') };
}

test('full session with configurator, voting, reveal, final and exports @smoke', async ({
  page,
  people,
  browserName,
  context,
}) => {
  test.slow();
  const room = await createRoom(page, { preset: 'fibonacci', autoReveal: false });
  expect(room.joinLink).toMatch(/\/r#[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(room.adminLink).toBe(`${room.joinLink}.${room.adminSecret}`);
  await expect(id(page, 'qr-code')).toBeVisible();

  // Admin enters the room from the configurator.
  await id(page, 'open-room').click();
  await submitJoin(page, 'Admin');
  const adminVotes = ((await participant(page, 'Admin').getAttribute('data-role')) ?? '').includes(
    'voter',
  );

  const alice = await people.join(room.joinLink, 'Alice');
  const bob = await people.join(room.joinLink, 'Bob');
  const carol = await people.join(room.joinLink, 'Carol');
  const sam = await people.join(room.joinLink, 'Sam', { spectator: true });

  for (const p of [page, alice.page, sam.page]) {
    for (const n of ['Alice', 'Bob', 'Carol', 'Sam']) await expect(participant(p, n)).toBeVisible();
  }
  await expect(participant(page, 'Sam')).toHaveAttribute('data-role', /spectator/);

  // Tasks: an ID, an ID with title, and a URL (reduced to its key under the default ids policy).
  await addTasks(page, [
    'SCP-3655',
    'SCP-3656 Fix login',
    'https://jira.example.com/browse/SCP-3657',
  ]);
  await expect(page.getByTestId('task-item')).toHaveCount(3);
  await expect(page.locator('[data-testid="task-item"][data-key="SCP-3656"]')).toContainText(
    'Fix login',
  );
  await expect(page.locator('[data-testid="task-item"][data-key="SCP-3657"]')).toHaveCount(1);

  await id(page, 'btn-next').click();
  for (const p of [page, alice.page, bob.page, carol.page, sam.page]) {
    await expect(currentTask(p)).toHaveAttribute('data-key', 'SCP-3655');
  }

  // Spectator has no usable cards.
  await expect(sam.page.locator('[data-testid="card"]:enabled')).toHaveCount(0);

  await vote(alice.page, '3');
  await vote(bob.page, '5');
  await vote(carol.page, '5');
  if (adminVotes) await vote(page, '5');

  // Voted indicators visible to everyone, values hidden.
  for (const p of [alice.page, sam.page, page]) {
    for (const n of ['Alice', 'Bob', 'Carol']) await expectVoted(p, n, true);
    await expectVoted(p, 'Sam', false);
    await expect(p.getByTestId('reveal-card')).toHaveCount(0);
    await expect(p.getByTestId('reveal-results')).toHaveCount(0);
  }
  // A voter only sees their own selection.
  expect(await selectedValues(alice.page)).toEqual(['3']);
  expect(await selectedValues(bob.page)).toEqual(['5']);

  await id(page, 'btn-reveal').click();
  for (const p of [page, alice.page, bob.page, carol.page, sam.page]) {
    await expect(id(p, 'reveal-results')).toBeVisible();
  }
  const revealed = await revealCards(alice.page);
  const byName = Object.fromEntries(revealed.map((r) => [r.name, r.value]));
  expect(byName).toMatchObject({ Alice: '3', Bob: '5', Carol: '5' });
  expect(Object.keys(byName)).not.toContain('Sam');

  // Votes 3,5,5 (+ admin 5): median 5, mode 5, average 4.33 (or 4.5), consensus near.
  expect(await statNumber(alice.page, 'stat-median')).toBe(5);
  expect(await statNumber(alice.page, 'stat-mode')).toBe(5);
  const avg = await statNumber(alice.page, 'stat-average');
  expect(avg).toBeCloseTo(adminVotes ? 4.5 : 13 / 3, 1);
  await expect(id(alice.page, 'consensus')).toHaveAttribute('data-level', 'near');

  // Final estimate.
  await page.locator('[data-testid="final-value"][data-value="5"]').first().click();
  const finalBtn = id(page, 'btn-final');
  if (await finalBtn.isVisible().catch(() => false)) await finalBtn.click();
  await expect(alice.page.locator('[data-testid="task-item"][data-key="SCP-3655"]')).toContainText(
    '5',
  );

  await id(page, 'btn-next').click();
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-3656');
  await expect.poll(() => selectedValues(alice.page)).toEqual([]);

  // Exports from the admin view.
  const csv = await downloadText(page, 'btn-export-csv');
  expect(csv.d.suggestedFilename()).toMatch(/\.csv$/);
  const lines = csv.text.trim().split(/\r?\n/);
  expect(lines[0]).toBe(
    'task_key,task_title,task_url,final,round,participant,vote,median,average,consensus',
  );
  expect(lines).toEqual(
    expect.arrayContaining([expect.stringMatching(/^SCP-3655,.*,5,1,Alice,3,5,/)]),
  );
  expect(lines.some((l) => l.startsWith('SCP-3656,Fix login'))).toBe(true);

  const json = await downloadText(page, 'btn-export-json');
  expect(json.d.suggestedFilename()).toMatch(/\.json$/);
  const data = JSON.parse(json.text) as {
    format: string;
    tasks: {
      key: string;
      final: string | null;
      rounds: { votes: { name: string; value: string }[] }[];
    }[];
  };
  expect(data.format).toBe('backlogfit-export');
  const t1 = data.tasks.find((t) => t.key === 'SCP-3655');
  expect(t1?.final).toBe('5');
  expect(t1?.rounds[0]?.votes).toEqual(
    expect.arrayContaining([
      { name: 'Alice', value: '3' },
      { name: 'Bob', value: '5' },
    ]),
  );

  const md = await downloadText(page, 'btn-export-md');
  expect(md.d.suggestedFilename()).toMatch(/\.md$/);
  expect(md.text).toContain('| Task | Title | Final |');
  expect(md.text).toMatch(/\| SCP\\-3655 \|.*\| 5 \|/);

  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await id(page, 'btn-copy-summary').click();
    await expect(id(page, 'toast')).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('SCP-3655');
    expect(clip).toContain('5');
  }
});
