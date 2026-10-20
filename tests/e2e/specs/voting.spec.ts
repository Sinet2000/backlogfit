import { createRoomApi } from '../fixtures/api.ts';
import { checkFrames, revealedVotes } from '../fixtures/privacy.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import {
  addTasks,
  card,
  currentTask,
  expectVoted,
  id,
  participant,
  revealCards,
  selectedValues,
  vote,
} from '../fixtures/ui.ts';
import { ownVotes } from '../fixtures/wire.ts';

test('auto-reveal when every connected voter has voted @smoke', async ({ page, people }) => {
  const room = await createRoomApi({ autoReveal: true });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const a = await people.join(room.joinLink, 'Alice');
  const b = await people.join(room.joinLink, 'Bob');
  await people.join(room.joinLink, 'Sam', { spectator: true });
  await addTasks(page, ['SCP-20']);
  await id(page, 'btn-next').click();
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-20');

  await vote(a.page, '8');
  await expectVoted(page, 'Alice', true);
  await expect(id(page, 'reveal-results')).toHaveCount(0);
  // Spectators don't block auto-reveal.
  await vote(b.page, '8');
  for (const p of [page, a.page, b.page]) await expect(id(p, 'reveal-results')).toBeVisible();
  await expect(id(a.page, 'consensus')).toHaveAttribute('data-level', 'full');
});

test('re-vote starts a new round and keeps the previous one in history', async ({
  page,
  wire,
  people,
}) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const a = await people.join(room.joinLink, 'Alice');
  const b = await people.join(room.joinLink, 'Bob');
  await addTasks(page, ['SCP-30']);
  await id(page, 'btn-next').click();
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-30');

  await vote(a.page, '1');
  await vote(b.page, '13');
  await id(page, 'btn-reveal').click();
  await expect(id(a.page, 'consensus')).toHaveAttribute('data-level', 'split');

  await id(page, 'btn-revote').click();
  await expect(id(a.page, 'reveal-results')).toHaveCount(0);
  await expect.poll(() => selectedValues(a.page)).toEqual([]);
  await expectVoted(page, 'Alice', false);

  await vote(a.page, '8');
  await vote(b.page, '8');
  await id(page, 'btn-reveal').click();
  await expect(id(a.page, 'consensus')).toHaveAttribute('data-level', 'full');
  const cards = await revealCards(a.page);
  expect(cards.map((c) => c.value).sort()).toEqual(['8', '8']);

  // History: round 1 is still there, with its original values.
  await wire.waitFor(
    (f) =>
      f.type === 'state' &&
      ((f.room as { tasks?: { rounds: unknown[] }[] }).tasks?.[0]?.rounds.length ?? 0) === 2 &&
      (f.room as { phase?: string }).phase === 'revealed',
  );
  const votes = revealedVotes(wire.lastRoom() as never);
  expect(
    votes
      .filter((v) => v.round === 1)
      .map((v) => `${v.name}:${v.value}`)
      .sort(),
  ).toEqual(['Alice:1', 'Bob:13']);
  expect(votes.filter((v) => v.round === 2).map((v) => v.value)).toEqual(['8', '8']);
});

test('anonymous reveal shows no names, on screen or on the wire', async ({ page, people }) => {
  const room = await createRoomApi({ autoReveal: false, anonymousAfterReveal: true });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const a = await people.join(room.joinLink, 'Alice');
  const b = await people.join(room.joinLink, 'Bob');
  const c = await people.join(room.joinLink, 'Carol');
  await addTasks(page, ['SCP-40']);
  await id(page, 'btn-next').click();
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-40');
  await vote(a.page, '2');
  await vote(b.page, '5');
  await vote(c.page, '3');
  await id(page, 'btn-reveal').click();

  for (const p of [page, a.page, b.page]) {
    await expect(id(p, 'reveal-results')).toBeVisible();
    const shown = await revealCards(p);
    expect(shown).toHaveLength(3);
    expect(shown.every((s) => s.name === '')).toBe(true);
    expect(shown.map((s) => s.value).sort()).toEqual(['2', '3', '5']);
    const text = await id(p, 'reveal-results').innerText();
    for (const n of ['Alice', 'Bob', 'Carol']) expect(text).not.toContain(n);
  }
  await a.wire.waitFor(
    (f) => f.type === 'state' && (f.room as { phase?: string }).phase === 'revealed',
  );
  const votes = revealedVotes(a.wire.lastRoom() as never);
  expect(votes.every((v) => v.name === null)).toBe(true);
  // Sorted by scale order, not by join order.
  expect(votes.map((v) => v.value)).toEqual(['2', '3', '5']);
  expect(checkFrames(a.wire.received, ownVotes(a.wire))).toEqual([]);
});

test('a spectator cannot vote and is not counted', async ({ page, people }) => {
  const room = await createRoomApi({ autoReveal: true });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const a = await people.join(room.joinLink, 'Alice');
  const s = await people.join(room.joinLink, 'Sam', { spectator: true });
  await addTasks(page, ['SCP-50']);
  await id(page, 'btn-next').click();
  await expect(currentTask(s.page)).toHaveAttribute('data-key', 'SCP-50');

  await expect(participant(page, 'Sam')).toHaveAttribute('data-role', /spectator/);
  const usable = s.page.locator('[data-testid="card"]:enabled');
  await expect(usable).toHaveCount(0);
  await s.page.keyboard.press('3');
  await expectVoted(page, 'Sam', false);
  expect(s.wire.sent.some((f) => f.includes('"type":"vote"'))).toBe(false);

  await vote(a.page, '5');
  await expect(id(s.page, 'reveal-results')).toBeVisible();
  expect((await revealCards(s.page)).map((c) => c.name)).toEqual(['Alice']);
});

test('keyboard: digits pick cards, Space reveals, N moves on, ? opens help', async ({
  page,
  people,
}) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const a = await people.join(room.joinLink, 'Alice');
  await addTasks(page, ['SCP-60', 'SCP-61']);
  await id(page, 'btn-next').click();
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-60');

  // Focus the page body, not an input, so shortcuts apply.
  await a.page.locator('body').click({ position: { x: 1, y: 1 } });
  const cards = a.page.getByTestId('card');
  const second = (await cards.nth(1).getAttribute('data-value')) ?? '';
  await a.page.keyboard.press('2');
  await expect.poll(() => selectedValues(a.page)).toEqual([second]);
  await expectVoted(page, 'Alice', true);
  const third = (await cards.nth(2).getAttribute('data-value')) ?? '';
  await a.page.keyboard.press('3');
  await expect.poll(() => selectedValues(a.page)).toEqual([third]);

  // Help dialog.
  await a.page.keyboard.press('?');
  await expect(a.page.getByRole('dialog')).toBeVisible();
  await a.page.keyboard.press('Escape');
  await expect(a.page.getByRole('dialog')).toHaveCount(0);

  // Shortcuts are admin-only: a voter's Space does not reveal.
  await a.page.keyboard.press('Space');
  await expect(id(a.page, 'reveal-results')).toHaveCount(0);

  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Space');
  await expect(id(a.page, 'reveal-results')).toBeVisible();
  await page.keyboard.press('n');
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-61');

  // Typing in the task box must not trigger shortcuts.
  await id(page, 'task-add-open').click();
  await id(page, 'task-input').fill('');
  await id(page, 'task-input').press('n');
  await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-61');
  await expect(card(a.page, second)).toBeVisible();
});
