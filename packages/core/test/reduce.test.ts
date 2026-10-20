import { describe, expect, it } from 'vitest';
import { HOUR_MS, nextDeadline, phaseOf, project, reduce } from '../src/index.ts';
import {
  auth,
  current,
  deepFreeze,
  errorsOf,
  HASH,
  hello,
  join,
  newRoom,
  outbox,
  type Sim,
  send,
  step,
  T0,
} from './helpers.ts';

function setup(config = {}, opts = {}) {
  const sim = newRoom(config, opts);
  const admin = join(sim, 'c-admin', 'Ada', { admin: true });
  const bob = join(sim, 'c-bob', 'Bob');
  const cy = join(sim, 'c-cy', 'Cy');
  return { sim, admin, bob, cy };
}

function startVoting(sim: Sim, lines = ['SCP-1 First', 'SCP-2 Second']) {
  send(sim, 'c-admin', { type: 'admin.tasks.add', lines });
  send(sim, 'c-admin', { type: 'admin.next' });
  return current(sim);
}

describe('createRoom', () => {
  it('clamps lifetime and participants to limits', () => {
    const sim = newRoom(
      { maxParticipants: 400 },
      { lifetimeHours: 24, limits: { maxParticipants: 10 } },
    );
    expect(sim.state.expiresAt - sim.state.createdAt).toBe(8 * HOUR_MS);
    expect(sim.state.config.maxParticipants).toBe(10);
    expect(sim.state.alarmAt).toBe(nextDeadline(sim.state));
  });
});

describe('hello', () => {
  it('welcomes an admin with a resume token and broadcasts', () => {
    const sim = newRoom();
    const r = step(sim, {
      type: 'message',
      conn: 'c1',
      msg: hello('Ada', { adminSecret: 'a'.repeat(22) }),
      auth: auth({ adminOk: true }),
    });
    const [welcome] = outbox(r, 'c1');
    expect(welcome?.type).toBe('welcome');
    if (welcome?.type !== 'welcome') throw new Error();
    expect(welcome.you.isAdmin).toBe(true);
    expect(welcome.you.resumeToken).toBe('tok_tok_tok_tok_tok');
    expect(r.effects.some((e) => e.type === 'broadcastState')).toBe(true);
    expect(sim.state.rev).toBe(1);
  });

  it('answers a wrong join secret exactly like an unknown room', () => {
    const sim = newRoom();
    const r = step(sim, {
      type: 'message',
      conn: 'c1',
      msg: hello('X'),
      auth: auth({ joinOk: false }),
    });
    expect(r.effects).toEqual([{ type: 'close', to: 'c1', reason: 'not_found' }]);
    expect(r.state).toBe(sim.state);
  });

  it('rejects hello without auth, bad admin secret, and duplicate hello', () => {
    const sim = newRoom();
    let r = step(sim, { type: 'message', conn: 'c1', msg: hello('X') });
    expect(errorsOf(r)).toEqual(['unauthorized']);
    r = step(sim, {
      type: 'message',
      conn: 'c1',
      msg: hello('X', { adminSecret: 'z'.repeat(22) }),
      auth: auth(),
    });
    expect(errorsOf(r)).toEqual(['unauthorized']);
    join(sim, 'c1', 'X');
    r = step(sim, { type: 'message', conn: 'c1', msg: hello('X'), auth: auth() });
    expect(errorsOf(r)).toEqual(['already_joined']);
  });

  it('enforces lock, spectators and capacity for non-admins only', () => {
    const { sim } = setup({ allowSpectators: false, maxParticipants: 4 });
    let r = step(sim, {
      type: 'message',
      conn: 'c4',
      msg: hello('S', { role: 'spectator' }),
      auth: auth(),
    });
    expect(errorsOf(r)).toEqual(['spectators_disabled']);
    join(sim, 'c4', 'Dee');
    r = step(sim, { type: 'message', conn: 'c5', msg: hello('E'), auth: auth() });
    expect(errorsOf(r)).toEqual(['room_full']);
    send(sim, 'c-admin', { type: 'admin.lock', locked: true });
    step(sim, { type: 'disconnect', conn: 'c4' });
    r = step(sim, { type: 'message', conn: 'c6', msg: hello('F'), auth: auth() });
    expect(errorsOf(r)).toEqual(['room_locked']);
    join(sim, 'c7', 'Ada2', { admin: true, role: 'spectator' });
  });

  it('counts passcode failures and locks after the limit', () => {
    const sim = newRoom({}, { passcode: true, limits: { passcodeMaxAttempts: 2 } });
    join(sim, 'c-admin', 'Ada', { admin: true });
    const bad = () =>
      step(sim, {
        type: 'message',
        conn: 'cx',
        msg: hello('M'),
        auth: auth({ passcodeOk: false }),
      });
    expect(errorsOf(bad())).toEqual(['bad_passcode']);
    expect(sim.state.passcodeFailures).toBe(1);
    expect(errorsOf(bad())).toEqual(['bad_passcode']);
    expect(sim.state.passcodeLocked).toBe(true);
    const r = step(sim, {
      type: 'message',
      conn: 'cy',
      msg: hello('M'),
      auth: auth({ passcodeOk: true }),
    });
    expect(errorsOf(r)).toEqual(['passcode_locked']);
    expect(project(sim.state, sim.state.participants[0]?.id ?? null).settings.passcodeLocked).toBe(
      true,
    );
    send(sim, 'c-admin', { type: 'admin.lock', locked: false });
    expect(sim.state.passcodeLocked).toBe(false);
    join(sim, 'cz', 'M', { auth: { passcodeOk: true } });
  });

  it('resumes a participant with id, role and vote intact, replacing an old socket', () => {
    const { sim, bob } = setup({ autoReveal: false });
    const { taskId, round } = startVoting(sim);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    step(sim, { type: 'disconnect', conn: 'c-bob' });
    expect(project(sim.state, null).participants.find((p) => p.id === bob)?.connected).toBe(false);
    const id = join(sim, 'c-bob2', 'Bobby', {
      auth: { resumeParticipantId: bob },
      resumeHash: HASH('f'),
    });
    expect(id).toBe(bob);
    const p = sim.state.participants.find((x) => x.id === bob);
    expect(p?.name).toBe('Bob');
    expect(p?.resumeHash).toBe(HASH('f'));
    expect(project(sim.state, bob).myVote).toBe('5');
    const r = step(sim, {
      type: 'message',
      conn: 'c-bob3',
      msg: hello('Bob'),
      auth: auth({ resumeParticipantId: bob }),
    });
    expect(r.effects).toContainEqual({ type: 'close', to: 'c-bob2', reason: 'replaced' });
  });

  it('prunes disconnected records past twice the capacity', () => {
    const sim = newRoom({ maxParticipants: 2 });
    for (let i = 0; i < 6; i++) {
      join(sim, `c${i}`, `P${i}`);
      step(sim, { type: 'disconnect', conn: `c${i}` });
    }
    expect(sim.state.participants.length).toBeLessThanOrEqual(4);
  });

  it('refuses to grow when every record is protected', () => {
    const sim = newRoom({ maxParticipants: 2 });
    join(sim, 'a1', 'A', { admin: true });
    join(sim, 'a2', 'B', { admin: true });
    join(sim, 'a3', 'C', { admin: true });
    join(sim, 'a4', 'D', { admin: true });
    const r = step(sim, {
      type: 'message',
      conn: 'a5',
      msg: hello('E'),
      auth: auth({ adminOk: true }),
    });
    expect(errorsOf(r)).toEqual(['room_full']);
  });
});

describe('lobby', () => {
  it('holds newcomers until approved; deny closes', () => {
    const sim = newRoom({ lobby: true });
    const admin = join(sim, 'c-admin', 'Ada', { admin: true });
    const r = step(sim, { type: 'message', conn: 'c1', msg: hello('Bob'), auth: auth() });
    expect(outbox(r, 'c1')).toEqual([
      { type: 'lobby', status: 'waiting', resumeToken: 'tok_tok_tok_tok_tok' },
    ]);
    expect(outbox(r, 'c1').some((m) => m.type === 'state')).toBe(false);
    const bob = sim.state.participants.find((p) => p.conn === 'c1')?.id ?? '';
    expect(project(sim.state, admin).lobby).toHaveLength(1);
    expect(project(sim.state, bob).lobby).toHaveLength(0);
    expect(outbox(send(sim, 'c1', { type: 'ping' }), 'c1')).toEqual([
      { type: 'pong', serverTime: expect.any(Number) },
    ]);
    expect(errorsOf(send(sim, 'c1', { type: 'unvote', taskId: 't', round: 1 }))).toEqual([
      'lobby_waiting',
    ]);

    const a = send(sim, 'c-admin', {
      type: 'admin.lobby',
      participantId: bob,
      decision: 'approve',
    });
    const welcome = outbox(a, 'c1')[0];
    expect(welcome?.type).toBe('welcome');
    expect(welcome?.type === 'welcome' && 'resumeToken' in welcome.you).toBe(false);

    step(sim, { type: 'message', conn: 'c2', msg: hello('Eve'), auth: auth() });
    const eve = sim.state.participants.find((p) => p.conn === 'c2')?.id ?? '';
    const d = send(sim, 'c-admin', { type: 'admin.lobby', participantId: eve, decision: 'deny' });
    expect(d.effects).toContainEqual({ type: 'close', to: 'c2', reason: 'denied' });
    expect(
      errorsOf(send(sim, 'c-admin', { type: 'admin.lobby', participantId: eve, decision: 'deny' })),
    ).toEqual(['unknown_participant']);
  });

  it('removes waiting entries on disconnect and admits all when the lobby is turned off', () => {
    const sim = newRoom({ lobby: true });
    join(sim, 'c-admin', 'Ada', { admin: true });
    step(sim, { type: 'message', conn: 'c1', msg: hello('A'), auth: auth() });
    step(sim, { type: 'message', conn: 'c2', msg: hello('B'), auth: auth() });
    step(sim, { type: 'disconnect', conn: 'c1' });
    expect(sim.state.participants.filter((p) => p.status === 'lobby')).toHaveLength(1);
    const r = send(sim, 'c-admin', { type: 'admin.settings', lobby: false });
    expect(outbox(r, 'c2')[0]?.type).toBe('welcome');
  });

  it('a waiting participant resuming stays in the lobby', () => {
    const sim = newRoom({ lobby: true });
    step(sim, { type: 'message', conn: 'c1', msg: hello('A'), auth: auth() });
    const id = sim.state.participants[0]?.id ?? '';
    const r = step(sim, {
      type: 'message',
      conn: 'c1b',
      msg: hello('A'),
      auth: auth({ resumeParticipantId: id }),
    });
    expect(outbox(r, 'c1b')[0]?.type).toBe('lobby');
  });
});

describe('voting', () => {
  it('validates phase, task, round, value and role', () => {
    const { sim } = setup({ autoReveal: false });
    expect(
      errorsOf(send(sim, 'c-bob', { type: 'vote', taskId: 'x', round: 1, value: '5' })),
    ).toEqual(['not_voting']);
    const { taskId, round } = startVoting(sim);
    expect(errorsOf(send(sim, 'c-bob', { type: 'vote', taskId: 'x', round, value: '5' }))).toEqual([
      'wrong_task',
    ]);
    expect(errorsOf(send(sim, 'c-bob', { type: 'vote', taskId, round: 2, value: '5' }))).toEqual([
      'wrong_round',
    ]);
    expect(errorsOf(send(sim, 'c-bob', { type: 'vote', taskId, round, value: '4' }))).toEqual([
      'invalid_value',
    ]);
    expect(errorsOf(send(sim, 'c-nobody', { type: 'vote', taskId, round, value: '5' }))).toEqual([
      'not_joined',
    ]);
    join(sim, 'c-spec', 'Spec', { role: 'spectator' });
    expect(errorsOf(send(sim, 'c-spec', { type: 'vote', taskId, round, value: '5' }))).toEqual([
      'forbidden',
    ]);

    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '8' });
    expect(current(sim).r?.votes).toEqual([{ pid: expect.any(String), name: 'Bob', value: '8' }]);
    send(sim, 'c-bob', { type: 'unvote', taskId, round });
    expect(current(sim).r?.votes).toEqual([]);
  });

  it('auto-reveals when every connected voter has voted', () => {
    const { sim } = setup();
    const { taskId, round } = startVoting(sim);
    send(sim, 'c-admin', { type: 'vote', taskId, round, value: '3' });
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    expect(phaseOf(sim.state)).toBe('voting');
    step(sim, { type: 'disconnect', conn: 'c-cy' });
    expect(phaseOf(sim.state)).toBe('revealed');
    expect(errorsOf(send(sim, 'c-bob', { type: 'vote', taskId, round, value: '8' }))).toEqual([
      'not_voting',
    ]);
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.reveal' }))).toEqual(['not_voting']);
  });

  it('revote keeps history; revote before reveal just clears', () => {
    const { sim } = setup({ autoReveal: false });
    const { taskId, round } = startVoting(sim);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    send(sim, 'c-admin', { type: 'admin.revote' });
    expect(current(sim).task?.rounds).toHaveLength(1);
    expect(current(sim).r?.votes).toHaveLength(0);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    send(sim, 'c-admin', { type: 'admin.reveal' });
    send(sim, 'c-admin', { type: 'admin.revote' });
    expect(current(sim).task?.rounds.map((r) => r.n)).toEqual([1, 2]);
    expect(phaseOf(sim.state)).toBe('voting');
  });

  it('timer start/stop and expiry reveals', () => {
    const { sim } = setup({ autoReveal: false, timerSeconds: 30 });
    startVoting(sim);
    send(sim, 'c-admin', { type: 'admin.timer', action: 'start' });
    expect(sim.state.timer).toEqual({ endsAt: T0 + 30_000, seconds: 30 });
    expect(sim.state.alarmAt).toBe(T0 + 30_000);
    send(sim, 'c-admin', { type: 'admin.timer', action: 'stop' });
    expect(sim.state.timer).toBeNull();
    send(sim, 'c-admin', { type: 'admin.timer', action: 'start', seconds: 10 });
    sim.now += 10_000;
    const r = step(sim, { type: 'tick' });
    expect(phaseOf(sim.state)).toBe('revealed');
    expect(r.effects.some((e) => e.type === 'scheduleAlarm')).toBe(true);
    send(sim, 'c-admin', { type: 'admin.revote' });
    send(sim, 'c-admin', { type: 'admin.timer', action: 'start' });
    expect(sim.state.timer?.seconds).toBe(30);
    send(sim, 'c-admin', { type: 'admin.settings', timerSeconds: null });
    send(sim, 'c-admin', { type: 'admin.timer', action: 'start' });
    expect(sim.state.timer?.seconds).toBe(60);
  });

  it('anonymity can be switched on mid-round but never off for cast votes', () => {
    const { sim } = setup({ autoReveal: false });
    const { taskId, round } = startVoting(sim);
    send(sim, 'c-admin', { type: 'admin.settings', anonymousAfterReveal: true });
    expect(current(sim).r?.anonymous).toBe(true);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    send(sim, 'c-admin', { type: 'admin.settings', anonymousAfterReveal: false });
    expect(current(sim).r?.anonymous).toBe(true);
    send(sim, 'c-admin', { type: 'admin.reveal' });
    const view = project(sim.state, null);
    expect(view.tasks[0]?.rounds[0]?.votes).toEqual([
      { participantId: null, name: null, value: '5' },
    ]);
  });
});

describe('tasks', () => {
  it('adds with policy, reports invalid lines by index, enforces the cap', () => {
    const { sim } = setup({}, { limits: { maxTasks: 3 } });
    const r = send(sim, 'c-admin', {
      type: 'admin.tasks.add',
      lines: ['SCP-1', '', 'https://evil.example/x', 'Plain title'],
    });
    expect(sim.state.tasks.map((t) => t.key ?? t.title)).toEqual(['SCP-1', 'Plain title']);
    expect(r.effects).toContainEqual({
      type: 'send',
      to: 'c-admin',
      msg: { type: 'error', code: 'invalid_task', ref: 'lines:2' },
    });
    expect(
      errorsOf(send(sim, 'c-admin', { type: 'admin.tasks.add', lines: ['A-1', 'A-2'] })),
    ).toEqual(['too_many_tasks']);
    expect(sim.state.tasks).toHaveLength(2);
  });

  it('moves, selects, removes and walks with next (wrapping, skipping finals)', () => {
    const { sim } = setup();
    send(sim, 'c-admin', { type: 'admin.tasks.add', lines: ['A-1', 'A-2', 'A-3'] });
    const [a, b, c] = sim.state.tasks.map((t) => t.id) as [string, string, string];
    send(sim, 'c-admin', { type: 'admin.tasks.move', taskId: c, toIndex: 0 });
    expect(sim.state.tasks.map((t) => t.id)).toEqual([c, a, b]);
    send(sim, 'c-admin', { type: 'admin.tasks.move', taskId: c, toIndex: 99 });
    expect(sim.state.tasks.map((t) => t.id)).toEqual([a, b, c]);
    send(sim, 'c-admin', { type: 'admin.select', taskId: b });
    expect(sim.state.currentTaskId).toBe(b);
    send(sim, 'c-admin', { type: 'admin.final', taskId: c, value: '8' });
    send(sim, 'c-admin', { type: 'admin.next' });
    expect(sim.state.currentTaskId).toBe(a);
    send(sim, 'c-admin', { type: 'admin.final', taskId: a, value: 'big' });
    send(sim, 'c-admin', { type: 'admin.final', taskId: b, value: '3' });
    send(sim, 'c-admin', { type: 'admin.next' });
    expect(sim.state.currentTaskId).toBeNull();
    send(sim, 'c-admin', { type: 'admin.final', taskId: b, value: null });
    send(sim, 'c-admin', { type: 'admin.next' });
    expect(sim.state.currentTaskId).toBe(b);
    send(sim, 'c-admin', { type: 'admin.tasks.remove', taskId: b });
    expect(sim.state.currentTaskId).toBeNull();
    send(sim, 'c-admin', { type: 'admin.tasks.remove', taskId: a });
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.select', taskId: a }))).toEqual([
      'unknown_task',
    ]);
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.revote' }))).toEqual(['no_current_task']);
  });
});

describe('authority', () => {
  it('blocks voters from admin actions and co-admins from owner actions', () => {
    const { sim, bob, cy } = setup();
    for (const msg of [
      { type: 'admin.next' },
      { type: 'admin.lock', locked: true },
      { type: 'admin.kick', participantId: cy },
    ] as const) {
      const r = send(sim, 'c-bob', msg);
      expect(errorsOf(r)).toEqual(['forbidden']);
      expect(r.state).toBe(sim.state);
    }
    send(sim, 'c-admin', { type: 'admin.promote', participantId: bob });
    expect(project(sim.state, bob).me?.authority).toBe('coadmin');
    expect(errorsOf(send(sim, 'c-bob', { type: 'admin.close' }))).toEqual(['forbidden']);
    expect(errorsOf(send(sim, 'c-bob', { type: 'admin.extend', hours: 1 }))).toEqual(['forbidden']);
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.promote', participantId: bob }))).toEqual([
      'invalid_target',
    ]);
    send(sim, 'c-bob', { type: 'admin.tasks.add', lines: ['X-1'] });
    expect(sim.state.tasks).toHaveLength(1);
    send(sim, 'c-admin', { type: 'admin.promote', participantId: cy });
    expect(errorsOf(send(sim, 'c-bob', { type: 'admin.kick', participantId: cy }))).toEqual([
      'forbidden',
    ]);
    const admin = sim.state.participants.find((p) => p.authority === 'admin')?.id ?? '';
    expect(errorsOf(send(sim, 'c-bob', { type: 'admin.kick', participantId: admin }))).toEqual([
      'invalid_target',
    ]);
    send(sim, 'c-admin', { type: 'admin.demote', participantId: bob });
    expect(project(sim.state, bob).me?.authority).toBe('none');
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.demote', participantId: bob }))).toEqual([
      'invalid_target',
    ]);
    expect(errorsOf(send(sim, 'c-admin', { type: 'admin.kick', participantId: 'nobody' }))).toEqual(
      ['unknown_participant'],
    );
  });

  it('kick removes the participant, their pending vote, and closes their socket', () => {
    const { sim, bob } = setup({ autoReveal: false });
    const { taskId, round } = startVoting(sim);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    const r = send(sim, 'c-admin', { type: 'admin.kick', participantId: bob });
    expect(r.effects).toContainEqual({ type: 'close', to: 'c-bob', reason: 'kicked' });
    expect(current(sim).r?.votes).toHaveLength(0);
    expect(sim.state.participants.some((p) => p.id === bob)).toBe(false);
  });
});

describe('lifetime', () => {
  it('extend is clamped to the maximum lifetime', () => {
    const { sim } = setup();
    send(sim, 'c-admin', { type: 'admin.extend', hours: 4 });
    expect(sim.state.expiresAt).toBe(T0 + 6 * HOUR_MS);
    send(sim, 'c-admin', { type: 'admin.extend', hours: 24 });
    expect(sim.state.expiresAt).toBe(T0 + 8 * HOUR_MS);
  });

  it('closes everything on expiry, idle timeout and admin close', () => {
    for (const [advance, reason] of [
      [2 * HOUR_MS, 'expired'],
      [31 * 60_000, 'idle'],
    ] as const) {
      const { sim } = setup();
      sim.now += advance;
      const r = step(sim, { type: 'tick' });
      expect(r.effects).toContainEqual({ type: 'deleteAll', reason });
      expect(r.effects.filter((e) => e.type === 'close')).toHaveLength(3);
      expect(sim.state.closed).toBe(reason);
      expect(sim.state.alarmAt).toBeNull();
      const late = send(sim, 'c-bob', { type: 'ping' });
      expect(late.effects).toEqual([{ type: 'close', to: 'c-bob', reason }]);
      expect(step(sim, { type: 'tick' }).effects).toEqual([]);
    }
    const { sim } = setup();
    const r = send(sim, 'c-admin', { type: 'admin.close' });
    expect(r.effects).toContainEqual({ type: 'deleteAll', reason: 'closed' });
  });

  it('activity postpones idle; an early alarm just reschedules', () => {
    const { sim, admin } = setup();
    const firstAlarm = sim.state.alarmAt ?? 0;
    sim.now += 20 * 60_000;
    send(sim, 'c-admin', { type: 'admin.tasks.add', lines: ['A-1'] });
    expect(sim.state.alarmAt).toBe(firstAlarm);
    sim.now = firstAlarm;
    const r = step(sim, { type: 'tick' });
    expect(sim.state.closed).toBeNull();
    expect(r.effects).toContainEqual({ type: 'scheduleAlarm', at: T0 + 50 * 60_000 });
    expect(project(sim.state, admin).idleAt).toBe(T0 + 50 * 60_000);
  });

  it('ping answers pong without touching state', () => {
    const { sim } = setup();
    sim.now += 1000;
    const before = sim.state;
    const r = send(sim, 'c-bob', { type: 'ping' });
    expect(r.state).toBe(before);
    expect(outbox(r, 'c-bob')).toEqual([{ type: 'pong', serverTime: T0 + 1000 }]);
  });
});

describe('purity', () => {
  it('never mutates its input (deep-frozen state)', () => {
    const { sim } = setup({ autoReveal: false });
    deepFreeze(sim.state);
    const { taskId, round } = startVoting(sim);
    deepFreeze(sim.state);
    send(sim, 'c-bob', { type: 'vote', taskId, round, value: '5' });
    deepFreeze(sim.state);
    send(sim, 'c-admin', { type: 'admin.reveal' });
    deepFreeze(sim.state);
    step(sim, { type: 'disconnect', conn: 'c-cy' });
    expect(phaseOf(sim.state)).toBe('revealed');
  });

  it('connect and unknown disconnect are no-ops', () => {
    const { sim } = setup();
    const s = sim.state;
    expect(reduce(s, { type: 'connect', conn: 'zz' }, { now: T0, randomId: () => 'x' }).state).toBe(
      s,
    );
    expect(
      reduce(s, { type: 'disconnect', conn: 'zz' }, { now: T0, randomId: () => 'x' }).state,
    ).toBe(s);
  });
});

describe('leave', () => {
  it('removes the participant, drops an unrevealed vote and closes with left', () => {
    const { sim, bob, cy } = setup();
    const task = startVoting(sim);
    send(sim, 'c-bob', { type: 'vote', taskId: task.taskId, round: 1, value: '5' });
    expect(project(sim.state, cy).tasks[0]?.rounds[0]?.voteCount).toBe(1);
    const r = send(sim, 'c-bob', { type: 'leave' });
    expect(r.effects).toContainEqual({ type: 'close', to: 'c-bob', reason: 'left' });
    expect(sim.state.participants.some((p) => p.id === bob)).toBe(false);
    expect(project(sim.state, cy).tasks[0]?.rounds[0]?.voteCount).toBe(0);
  });

  it('lets a lobby participant leave and rejects a leave before hello', () => {
    const sim = newRoom({ lobby: true });
    join(sim, 'c-admin', 'Ada', { admin: true });
    step(sim, { type: 'message', conn: 'c1', msg: hello('Bob'), auth: auth() });
    expect(sim.state.participants.some((p) => p.status === 'lobby')).toBe(true);
    send(sim, 'c1', { type: 'leave' });
    expect(sim.state.participants.some((p) => p.status === 'lobby')).toBe(false);
    expect(errorsOf(send(sim, 'c9', { type: 'leave' }))).toEqual(['not_joined']);
  });
});
