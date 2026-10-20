/** Who gets in: lobby, passcode, lock, capacity; and facilitator powers: kick, promote. */
import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import {
  addTasks,
  closeSettings,
  currentTask,
  expectClosed,
  id,
  nextTask,
  openSettings,
  participant,
  participantAction,
  setToggle,
  submitJoin,
  vote,
  waitInRoom,
} from '../fixtures/ui.ts';

test('lobby: admin approves one and denies another @smoke', async ({ page, people }) => {
  const room = await createRoomApi({ lobby: true });
  await joinAdmin(page, room.adminLink);

  const alice = await people.join(room.joinLink, 'Alice', { expect: 'lobby' });
  await expect(participant(page, 'Alice')).toHaveCount(0);
  await id(page, 'lobby-approve').first().click();
  await waitInRoom(alice.page, 'Alice');
  await expect(participant(page, 'Alice')).toBeVisible();

  const mallory = await people.join(room.joinLink, 'Mallory', { expect: 'lobby' });
  await id(page, 'lobby-deny').first().click();
  await expectClosed(mallory.page, 'denied');
  await expect(participant(page, 'Mallory')).toHaveCount(0);
  await expect(participant(alice.page, 'Mallory')).toHaveCount(0);
});

test('passcode: wrong is refused, right gets in', async ({ page, people }) => {
  const room = await createRoomApi({ passcode: 'tiger-42' });
  await joinAdmin(page, room.adminLink);

  const p = await people.open();
  await p.page.goto(room.joinLink);
  await submitJoin(p.page, 'Alice', { passcode: 'wrong', expect: 'none' });
  await expect(id(p.page, 'toast').or(p.page.getByRole('alert')).first()).toBeVisible();
  await expect(participant(page, 'Alice')).toHaveCount(0);

  if (!(await id(p.page, 'join-name').isVisible())) await p.page.reload();
  await submitJoin(p.page, 'Alice', { passcode: 'tiger-42' });
  await expect(participant(page, 'Alice')).toBeVisible();
});

test('lock: new joins are refused while locked, allowed after unlock', async ({ page, people }) => {
  const room = await createRoomApi();
  await joinAdmin(page, room.adminLink);
  const alice = await people.join(room.joinLink, 'Alice');

  await openSettings(page);
  await setToggle(id(page, 'btn-lock'), true);
  await closeSettings(page);
  const late = await people.open();
  await late.page.goto(room.joinLink);
  await submitJoin(late.page, 'Late', { expect: 'none' });
  const closed = id(late.page, 'room-closed');
  await expect(closed).toHaveAttribute('data-reason', 'rejected');
  await expect(closed).toHaveAttribute('data-error', 'room_locked');
  await expect(participant(page, 'Late')).toHaveCount(0);
  await expect(participant(alice.page, 'Alice')).toBeVisible();

  await openSettings(page);
  await setToggle(id(page, 'btn-lock'), false);
  await closeSettings(page);
  await people.join(room.joinLink, 'Later');
  await expect(participant(page, 'Later')).toBeVisible();
});

test('kick removes a participant with a friendly closed screen @smoke', async ({
  page,
  people,
}) => {
  const room = await createRoomApi();
  await joinAdmin(page, room.adminLink);
  const bob = await people.join(room.joinLink, 'Bob');
  const alice = await people.join(room.joinLink, 'Alice');
  await participantAction(page, 'Bob', 'btn-kick');
  await id(page, 'btn-kick-confirm').click();
  await expectClosed(bob.page, 'kicked');
  await expect(participant(alice.page, 'Bob')).toHaveCount(0);
  await bob.page.reload();
  await bob.page.waitForTimeout(2_000);
  await expect(participant(page, 'Bob')).toHaveCount(0);
});

test('promote: a co-admin can run the round but not admin-only actions', async ({
  page,
  people,
}) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const bob = await people.join(room.joinLink, 'Bob');
  const alice = await people.join(room.joinLink, 'Alice');
  await expect(id(bob.page, 'btn-reveal')).toHaveCount(0);

  await participantAction(page, 'Bob', 'btn-promote');
  await expect(id(bob.page, 'task-input')).toBeVisible();
  await addTasks(bob.page, ['SCP-70']);
  await nextTask(bob.page);
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-70');
  await vote(alice.page, '3');
  await id(bob.page, 'btn-reveal').click();
  await expect(id(alice.page, 'reveal-results')).toBeVisible();
  await expect(id(bob.page, 'btn-close-room')).toHaveCount(0);
  await expect(id(bob.page, 'btn-extend')).toHaveCount(0);
  await expect(participant(bob.page, 'Alice').getByTestId('participant-menu')).toHaveCount(1);
  await participant(bob.page, 'Alice').getByTestId('participant-menu').click();
  await expect(id(bob.page, 'btn-kick')).toBeVisible();
  await expect(id(bob.page, 'btn-promote')).toHaveCount(0);
});

test('max participants: the room refuses joins once full', async ({ page, people }) => {
  const room = await createRoomApi({ maxParticipants: 3 });
  await joinAdmin(page, room.adminLink);
  await people.join(room.joinLink, 'Alice');
  await people.join(room.joinLink, 'Bob');
  const extra = await people.open();
  await extra.page.goto(room.joinLink);
  await submitJoin(extra.page, 'Extra', { expect: 'none' });
  await expect(
    id(extra.page, 'room-closed')
      .or(id(extra.page, 'toast'))
      .or(extra.page.getByRole('alert'))
      .first(),
  ).toBeVisible();
  await expect(participant(page, 'Extra')).toHaveCount(0);
  await expect(page.getByTestId('participant')).toHaveCount(3);
});
