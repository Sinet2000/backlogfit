import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  HOUR_MS,
  type LoopbackClient,
  LoopbackEngine,
  presetScale,
  RoomViewSchema,
  ServerMessageSchema,
  toCsv,
  toJson,
  toMarkdown,
  toSummary,
} from '../src/index.ts';
import { counterIds, T0 } from './helpers.ts';

function view(c: LoopbackClient) {
  const s = c.last('state');
  if (!s) throw new Error('no state yet');
  return s.room;
}

async function setup(config = {}, extra: { passcode?: string } = {}) {
  let now = T0;
  const clock = { advance: (ms: number) => (now += ms) };
  const { engine, joinSecret, adminSecret } = await LoopbackEngine.create(
    { config: { scale: presetScale('fibonacci'), ...config }, ...extra },
    { now: () => now, randomId: counterIds('id') },
  );
  return { engine, joinSecret, adminSecret, clock };
}

describe('lifecycle via LoopbackEngine', () => {
  it('create → join ×3 → tasks → next → vote → auto-reveal → revote → final → next → export', async () => {
    const { engine, joinSecret, adminSecret } = await setup();
    const admin = engine.connect();
    await admin.send({ type: 'hello', v: 1, joinSecret, adminSecret, name: 'Ada', role: 'voter' });
    const welcome = admin.last('welcome');
    expect(welcome?.you.isAdmin).toBe(true);

    const voters = [engine.connect(), engine.connect(), engine.connect()];
    for (const [i, c] of voters.entries()) {
      await c.send({ type: 'hello', v: 1, joinSecret, name: `Voter ${i}`, role: 'voter' });
      expect(c.last('welcome')?.you.authority).toBe('none');
    }
    expect(view(admin).participants).toHaveLength(4);

    await admin.send({ type: 'admin.tasks.add', lines: ['SCP-1 Login', 'SCP-2 Logout'] });
    await admin.send({ type: 'admin.next' });
    const room = view(admin);
    const taskId = room.currentTaskId ?? '';
    expect(room.phase).toBe('voting');

    const values = ['3', '5', '5', '8'];
    const all = [admin, ...voters];
    for (const [i, c] of all.entries()) {
      await c.send({ type: 'vote', taskId, round: 1, value: values[i] ?? '?' });
      if (i < all.length - 1) {
        // still secret: nobody sees anyone else's vote
        for (const other of all) {
          const r = view(other).tasks[0]?.rounds[0];
          expect(r?.votes).toBeNull();
        }
      }
    }
    const revealed = view(voters[0] as LoopbackClient);
    expect(revealed.phase).toBe('revealed');
    expect(revealed.tasks[0]?.rounds[0]?.stats?.median).toBe(5);

    await admin.send({ type: 'admin.revote' });
    expect(view(admin).round).toBe(2);
    for (const c of all) await c.send({ type: 'vote', taskId, round: 2, value: '5' });
    expect(view(admin).tasks[0]?.rounds[1]?.stats?.consensus).toBe('full');

    await admin.send({ type: 'admin.final', taskId, value: '5' });
    await admin.send({ type: 'admin.next' });
    expect(view(admin).currentTaskId).not.toBe(taskId);

    const final = view(admin);
    expect(v.safeParse(RoomViewSchema, final).success).toBe(true);
    for (const c of all)
      for (const m of c.messages) expect(v.safeParse(ServerMessageSchema, m).success).toBe(true);

    const csv = toCsv(final);
    expect(csv.split('\r\n')[0]).toBe(
      'task_key,task_title,task_url,final,round,participant,vote,median,average,consensus',
    );
    expect(csv).toContain('SCP-1,Login,,5,2,Ada,5,5,5,full');
    expect(
      JSON.parse(toJson(final, { generatedAt: '2026-01-01T00:00:00Z' })).tasks[0].rounds,
    ).toHaveLength(2);
    expect(toMarkdown(final)).toContain('| SCP\\-1 | Login | 5 | 2 | 4×5 | 5 | full |');
    expect(toSummary(final, taskId)).toContain('Final estimate: 5');
  });

  it('reconnects with the resume token and keeps the vote', async () => {
    const { engine, joinSecret, adminSecret } = await setup({ autoReveal: false });
    const admin = engine.connect();
    await admin.send({
      type: 'hello',
      v: 1,
      joinSecret,
      adminSecret,
      name: 'Ada',
      role: 'spectator',
    });
    const bob = engine.connect();
    await bob.send({ type: 'hello', v: 1, joinSecret, name: 'Bob', role: 'voter' });
    const token = bob.last('welcome')?.you.resumeToken ?? '';
    const id = bob.last('welcome')?.you.participantId;
    await admin.send({ type: 'admin.tasks.add', lines: ['A-1'] });
    await admin.send({ type: 'admin.next' });
    const taskId = view(admin).currentTaskId ?? '';
    await bob.send({ type: 'vote', taskId, round: 1, value: '8' });
    await bob.disconnect();
    expect(bob.open).toBe(false);

    const bob2 = engine.connect();
    await bob2.send({
      type: 'hello',
      v: 1,
      joinSecret,
      name: 'Bob',
      role: 'voter',
      resumeToken: token,
    });
    const w = bob2.last('welcome');
    expect(w?.you.participantId).toBe(id);
    expect(w?.room.myVote).toBe('8');
    expect(w?.you.resumeToken).not.toBe(token);

    // the old token no longer works
    const bob3 = engine.connect();
    await bob3.send({
      type: 'hello',
      v: 1,
      joinSecret,
      name: 'Bob',
      role: 'voter',
      resumeToken: token,
    });
    expect(bob3.last('welcome')?.you.participantId).not.toBe(id);
  });

  it('passcode, bad frames, unknown secret, expiry and listeners', async () => {
    const { engine, joinSecret, adminSecret, clock } = await setup({}, { passcode: '4242' });
    const admin = engine.connect();
    const seen: string[] = [];
    const off = admin.onMessage((m) => seen.push(m.type));
    await admin.send({ type: 'hello', v: 1, joinSecret, adminSecret, name: 'Ada', role: 'voter' });
    off();
    expect(seen).toEqual(['welcome', 'state']);

    const wrong = engine.connect();
    await wrong.send({
      type: 'hello',
      v: 1,
      joinSecret,
      name: 'X',
      role: 'voter',
      passcode: '0000',
    });
    expect(wrong.last('error')?.code).toBe('bad_passcode');
    expect(wrong.closedReason).toBe('rejected');
    await wrong.send({ type: 'ping' }); // ignored once closed

    const right = engine.connect();
    await right.send({
      type: 'hello',
      v: 1,
      joinSecret,
      name: 'Y',
      role: 'voter',
      passcode: '4242',
    });
    expect(right.last('welcome')).toBeDefined();
    await right.send('not json');
    expect(right.last('error')?.code).toBe('bad_json');

    const stranger = engine.connect();
    await stranger.send({
      type: 'hello',
      v: 1,
      joinSecret: 'z'.repeat(22),
      name: 'Z',
      role: 'voter',
    });
    expect(stranger.closedReason).toBe('not_found');
    expect(stranger.last('closed')?.reason).toBe('not_found');

    const lurker = engine.connect(); // never says hello
    clock.advance(2 * HOUR_MS);
    await engine.runAlarms();
    expect(engine.closed).toBe(true);
    expect(admin.closedReason).toBe('expired');
    expect(lurker.closedReason).toBe('expired');
    await engine.idle();
  });

  it('runAlarms is a no-op before the deadline', async () => {
    const { engine } = await setup();
    const before = engine.state;
    await engine.runAlarms();
    expect(engine.state).toBe(before);
  });

  it('rejects an invalid room request', async () => {
    await expect(
      LoopbackEngine.create({ config: { scale: [] } }, { now: () => T0 }),
    ).rejects.toThrow('invalid room request');
  });
});
