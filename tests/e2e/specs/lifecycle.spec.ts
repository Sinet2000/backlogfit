/** Reconnect, close, expiry (fast clock server) and dead links. */
import { createRoomApi } from '../fixtures/api.ts';
import { FAST_TIME_SCALE, FAST_URL } from '../fixtures/env.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import {
  addTasks,
  currentTask,
  expectClosed,
  expectVoted,
  id,
  participant,
  selectedValues,
  submitJoin,
  vote,
  waitInRoom,
} from '../fixtures/ui.ts';

test('reload resumes the same participant with the same vote @smoke', async ({ page, people }) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const alice = await people.join(room.joinLink, 'Alice');
  await addTasks(page, ['SCP-80']);
  await id(page, 'btn-next').click();
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-80');
  await vote(alice.page, '5');

  const before = alice.wire.ofType('welcome')[0] as { you: { participantId: string } } | undefined;
  await alice.page.reload();
  // No join form: the resume token in sessionStorage brings Alice straight back.
  await waitInRoom(alice.page, 'Alice');
  await expect(id(alice.page, 'join-name')).toHaveCount(0);
  await expect.poll(() => selectedValues(alice.page)).toEqual(['5']);
  await expect(participant(page, 'Alice')).toHaveCount(1);
  await expectVoted(page, 'Alice', true);
  const welcomes = alice.wire.ofType('welcome') as { you: { participantId: string } }[];
  expect(welcomes.length).toBe(2);
  expect(welcomes[1]?.you.participantId).toBe(before?.you.participantId);

  // Admin reload keeps admin powers.
  await page.reload();
  await expect(id(page, 'btn-reveal')).toBeVisible();
});

test('admin closes the room: everyone sees the closed screen', async ({ page, people }) => {
  const room = await createRoomApi();
  await joinAdmin(page, room.adminLink);
  const alice = await people.join(room.joinLink, 'Alice');
  await id(page, 'btn-close-room').click();
  const confirm = page.getByTestId('btn-close-confirm');
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expectClosed(alice.page, 'closed');
  // The link is dead afterwards, and indistinguishable from a link that never existed.
  const again = await people.open();
  await again.page.goto(room.joinLink);
  if (
    await id(again.page, 'join-name')
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
  ) {
    await submitJoin(again.page, 'Again', { expect: 'none' });
  }
  await expectClosed(again.page, 'not_found');
});

test('invalid and malformed links show the friendly ended page', async ({ page }) => {
  const bogus = `/r#${'A'.repeat(22)}.${'B'.repeat(22)}`;
  await page.goto(bogus);
  if (
    await id(page, 'join-name')
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
  ) {
    await submitJoin(page, 'Nobody', { expect: 'none' });
  }
  await expectClosed(page, 'not_found');

  for (const hash of ['', '#', '#garbage', '#a.b.c.d.e', '#%3Cscript%3E.x']) {
    await page.goto(`/r${hash}`);
    await expect(
      id(page, 'room-closed').or(page.getByRole('heading')).first(),
      `page for /r${hash}`,
    ).toBeVisible();
    await expect(page.locator('script:not([src])')).toHaveCount(0);
  }
});

test.describe('expiry with TEST_TIME_SCALE', () => {
  test.use({ baseURL: FAST_URL });
  test.skip(() => process.env.E2E_NO_FAST === '1', 'fast-clock server disabled');

  test('idle timeout closes the room with reason idle', async ({ page, people }) => {
    // Default IDLE_TIMEOUT_MINUTES=30 → 30 s at 60x.
    test.setTimeout(120_000);
    const room = await createRoomApi({ baseURL: FAST_URL });
    await joinAdmin(page, room.adminLink);
    const alice = await people.join(room.joinLink, 'Alice');
    const idleMs = (30 * 60_000) / FAST_TIME_SCALE;
    await expectClosed(alice.page, 'idle', idleMs + 30_000);
    await expectClosed(page, 'idle', 5_000);
  });

  test('hard expiry closes the room with reason expired despite activity', async ({
    page,
    people,
  }) => {
    // lifetime 1 h → 60 s at 60x. Keep voting so the idle timeout never fires first.
    test.setTimeout(150_000);
    const room = await createRoomApi({ baseURL: FAST_URL, lifetimeHours: 1 });
    await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
    const alice = await people.join(room.joinLink, 'Alice');
    await addTasks(page, ['SCP-90']);
    await id(page, 'btn-next').click();
    await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-90');
    const deadline = Date.now() + (60 * 60_000) / FAST_TIME_SCALE + 30_000;
    const values = ['1', '2'];
    let i = 0;
    while (Date.now() < deadline) {
      if (await id(alice.page, 'room-closed').isVisible()) break;
      await alice.page
        .locator(`[data-testid="card"][data-value="${values[i++ % 2]}"]`)
        .click({ timeout: 2_000 })
        .catch(() => undefined);
      await alice.page.waitForTimeout(5_000);
    }
    await expectClosed(alice.page, 'expired', 5_000);
    await expectClosed(page, 'expired', 5_000);
  });
});
