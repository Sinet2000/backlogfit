import type { ServerMessage } from '@backlogfit/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { Client, createRoom, join, start } from './helpers.ts';

let server: RunningServer;

afterEach(async () => {
  await server?.close();
});

function assertNoForeignVotes(messages: ServerMessage[], ownVote: string | null) {
  for (const m of messages) {
    const room = m.type === 'state' || m.type === 'welcome' ? m.room : null;
    if (!room) continue;
    for (const task of room.tasks) {
      for (const round of task.rounds) {
        if (!round.revealed) {
          expect(round.votes).toBeNull();
          expect(round.stats).toBeNull();
        }
      }
    }
    if (room.phase === 'voting') expect([null, ownVote]).toContain(room.myVote);
  }
}

describe('full session over real WebSockets', () => {
  it('create → join → vote → reveal → final → close', async () => {
    server = await start();
    const room = await createRoom(server);

    const admin = await join(server, room, 'Ada', { admin: true });
    expect(admin.welcome.you.isAdmin).toBe(true);
    expect(admin.welcome.you.resumeToken).toBeTypeOf('string');
    const bob = await join(server, room, 'Bob');
    expect(bob.welcome.you.authority).toBe('none');

    admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-1 Login page', 'SCP-2'] });
    const added = await admin.c.next('state', (m) => m.room.tasks.length === 2);
    const taskId = added.room.tasks[0]?.id as string;

    admin.c.send({ type: 'admin.next' });
    await bob.c.next('state', (m) => m.room.phase === 'voting');

    const bobSeenBefore = bob.c.messages.length;
    admin.c.send({ type: 'vote', taskId, round: 1, value: '13' });
    const afterAdminVote = await bob.c.next(
      'state',
      (m) => m.room.participants.find((p) => p.name === 'Ada')?.hasVoted === true,
    );
    expect(afterAdminVote.room.phase).toBe('voting');
    expect(afterAdminVote.room.myVote).toBeNull();
    const voteFrames = bob.c.frames.slice(bobSeenBefore);
    for (const f of voteFrames) expect(f).not.toContain('"votes":[');

    bob.c.send({ type: 'vote', taskId, round: 1, value: '5' });
    const revealed = await admin.c.next('state', (m) => m.room.phase === 'revealed');
    const round = revealed.room.tasks[0]?.rounds[0];
    expect(round?.revealed).toBe(true);
    expect(round?.votes?.map((v) => v.value).sort()).toEqual(['13', '5']);

    assertNoForeignVotes(
      bob.c.messages.filter(
        (m) => m.type !== 'state' || m.room.phase !== 'revealed',
      ) as ServerMessage[],
      '5',
    );

    admin.c.send({ type: 'admin.final', taskId, value: '8' });
    const final = await bob.c.next('state', (m) => m.room.tasks[0]?.final === '8');
    expect(final.room.tasks[0]?.final).toBe('8');

    bob.c.send({ type: 'admin.close' });
    const err = await bob.c.next('error');
    expect(err).toEqual({ type: 'error', code: 'forbidden', ref: 'admin.close' });

    admin.c.send({ type: 'admin.close' });
    expect(await bob.c.next('closed')).toEqual({ type: 'closed', reason: 'closed' });
    expect((await bob.c.closed).code).toBe(4003);
    expect((await admin.c.closed).code).toBe(4003);
    expect(server.registry.get(room.roomId)).toBeUndefined();

    const late = await Client.open(server, room.roomId);
    late.send({ type: 'hello', v: 1, joinSecret: room.joinSecret, name: 'Late', role: 'voter' });
    expect(await late.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
    expect((await late.closed).code).toBe(4404);
  });

  it('closes sockets with 1001 on shutdown', async () => {
    server = await start();
    const room = await createRoom(server);
    const admin = await join(server, room, 'Ada', { admin: true });
    await server.close();
    expect((await admin.c.closed).code).toBe(1001);
  });
});
