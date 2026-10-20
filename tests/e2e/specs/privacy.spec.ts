/**
 * Wire privacy: a voter's WebSocket must never carry another participant's vote value before
 * reveal. Frames are parsed and checked structurally (fixtures/privacy.ts).
 */
import { createRoomApi } from '../fixtures/api.ts';
import { checkFrames, revealedVotes } from '../fixtures/privacy.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { addTasks, currentTask, expectVoted, id, nextTask, vote } from '../fixtures/ui.ts';
import { ownVotes } from '../fixtures/wire.ts';

test('no other vote value reaches a voter before reveal @smoke', async ({ page, wire, people }) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const alice = await people.join(room.joinLink, 'Alice');
  const bob = await people.join(room.joinLink, 'Bob');
  const carol = await people.join(room.joinLink, 'Carol');

  await addTasks(page, ['SCP-1', 'SCP-2']);
  await nextTask(page);
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-1');

  // Alice changes her mind once; others use values Alice never picks.
  await vote(alice.page, '2');
  await vote(alice.page, '3');
  await vote(bob.page, '13');
  await vote(carol.page, '21');
  for (const n of ['Alice', 'Bob', 'Carol']) await expectVoted(alice.page, n, true);

  const beforeReveal = [...alice.wire.received];
  expect(beforeReveal.length).toBeGreaterThan(3);
  expect(checkFrames(beforeReveal, ownVotes(alice.wire))).toEqual([]);
  // Raw substring check as a second net: no frame mentions Bob's/Carol's value as a vote.
  for (const raw of beforeReveal) {
    const f = JSON.parse(raw) as { room?: { config?: unknown } };
    if (f.room) f.room.config = null; // the scale legitimately lists every card value
    expect(JSON.stringify(f)).not.toMatch(/"(13|21)"/);
  }

  // The socket URL carries only the room id, secrets travel in the first frame.
  for (const ws of alice.wire.sockets) {
    expect(ws.url()).not.toContain(room.joinSecret);
    expect(new URL(ws.url()).pathname).toBe(`/ws/${room.roomId}`);
  }
  const hello = JSON.parse(alice.wire.sent[0] ?? '{}') as Record<string, unknown>;
  expect(hello.type).toBe('hello');
  expect(hello.joinSecret).toBe(room.joinSecret);
  expect(hello).not.toHaveProperty('adminSecret');

  // The spectating admin's frames are equally clean (it cast no vote at all).
  expect(checkFrames(wire.received, new Set())).toEqual([]);

  await id(page, 'btn-reveal').click();
  await expect(id(alice.page, 'reveal-results')).toBeVisible();
  await alice.wire.waitFor(
    (f) => f.type === 'state' && (f.room as { phase?: string }).phase === 'revealed',
  );
  const view = alice.wire.lastRoom();
  expect(view).not.toBeNull();
  const values = revealedVotes(view as never).map((v) => `${v.name}:${v.value}`);
  expect(values.sort()).toEqual(['Alice:3', 'Bob:13', 'Carol:21']);
});

test('admin frames before reveal contain no vote values either', async ({ page, wire, people }) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin');
  const bob = await people.join(room.joinLink, 'Bob');
  await addTasks(page, ['SCP-10']);
  await nextTask(page);
  await expect(currentTask(bob.page)).toHaveAttribute('data-key', 'SCP-10');
  await vote(bob.page, '8');
  await expectVoted(page, 'Bob', true);
  expect(checkFrames(wire.received, ownVotes(wire))).toEqual([]);
  expect(checkFrames(bob.wire.received, ownVotes(bob.wire))).toEqual([]);
});
