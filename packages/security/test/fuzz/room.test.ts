import {
  type ClientMessageInput,
  type LoopbackClient,
  LoopbackEngine,
  PRESETS,
  type RoomState,
  reduce,
  type ServerMessage,
} from '@backlogfit/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nastyString, pollutionKey } from './arbitraries.ts';

type Kind = 'admin' | 'member' | 'spectator' | 'intruder' | 'mute' | 'forger';
const KINDS: readonly Kind[] = [
  'admin',
  'member',
  'member',
  'spectator',
  'intruder',
  'mute',
  'forger',
];
const SCALE = PRESETS.fibonacci.cards.map((c) => c.value);
const FAKE_SECRET = 'Z'.repeat(22);

type Op =
  | { k: 'hello'; who: number; resumeOwn: boolean }
  | { k: 'vote'; who: number; value: number; unvote: boolean; stale: boolean }
  | { k: 'admin'; who: number; msg: number; target: number; n: number; flag: boolean }
  | { k: 'raw'; who: number; text: string }
  | { k: 'extraKey'; who: number; msg: number; key: string }
  | { k: 'reconnect'; who: number }
  | { k: 'disconnect'; who: number }
  | { k: 'time'; ms: number };

const who = fc.nat(KINDS.length - 1);
const opArb: fc.Arbitrary<Op> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({ k: fc.constant('hello' as const), who, resumeOwn: fc.boolean() }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      k: fc.constant('vote' as const),
      who: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(1, 2) }, { weight: 2, arbitrary: who }),
      value: fc.nat(SCALE.length + 1),
      unvote: fc.nat(6).map((n) => n === 0),
      stale: fc.nat(6).map((n) => n === 0),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      k: fc.constant('admin' as const),
      who: fc.oneof({ weight: 3, arbitrary: fc.constant(0) }, { weight: 4, arbitrary: who }),
      msg: fc.nat(30),
      target: fc.nat(10),
      n: fc.nat(40),
      flag: fc.boolean(),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ k: fc.constant('raw' as const), who, text: nastyString(40) }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('extraKey' as const),
      who,
      msg: fc.nat(30),
      key: pollutionKey,
    }),
  },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('reconnect' as const), who }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('disconnect' as const), who }) },
  {
    weight: 2,
    arbitrary: fc.record({
      k: fc.constant('time' as const),
      ms: fc.oneof(
        { weight: 20, arbitrary: fc.integer({ min: 0, max: 90_000 }) },
        { weight: 1, arbitrary: fc.integer({ min: 0, max: 3 * 3_600_000 }) },
      ),
    }),
  },
);

const configArb = fc.record({
  autoReveal: fc.boolean(),
  anonymousAfterReveal: fc.boolean(),
  lobby: fc.boolean(),
  allowSpectators: fc.boolean(),
  passcode: fc.boolean(),
});

interface Actor {
  kind: Kind;
  client: LoopbackClient;
  seen: number;
  tokens: string[];
  everWelcomed: boolean;
}

function pick<T>(xs: readonly T[], i: number): T | undefined {
  return xs.length === 0 ? undefined : xs[i % xs.length];
}

function adminMessage(
  state: RoomState,
  o: Extract<Op, { k: 'admin' | 'extraKey' }>,
): ClientMessageInput {
  const target = 'target' in o ? o.target : 0;
  const n = 'n' in o ? o.n : 1;
  const flag = 'flag' in o ? o.flag : true;
  const taskId = pick(state.tasks, target)?.id ?? 'nonexistent';
  const participantId = pick(state.participants, target)?.id ?? 'nonexistent';
  const all: ClientMessageInput[] = [
    { type: 'admin.tasks.add', lines: [`ABC-${n} Task ${n}`, 'Plain title'] },
    { type: 'admin.tasks.add', lines: ['javascript:alert(1)', 'https://evil.example/x', '‮evil'] },
    { type: 'admin.tasks.remove', taskId },
    { type: 'admin.tasks.move', taskId, toIndex: n },
    { type: 'admin.next' },
    { type: 'admin.next' },
    { type: 'admin.select', taskId },
    { type: 'admin.reveal' },
    { type: 'admin.reveal' },
    { type: 'admin.revote' },
    { type: 'admin.final', taskId, value: flag ? null : (SCALE[n % SCALE.length] ?? '1') },
    { type: 'admin.timer', action: flag ? 'start' : 'stop', seconds: 5 + n },
    { type: 'admin.settings', autoReveal: flag, anonymousAfterReveal: n % 2 === 0 },
    { type: 'admin.settings', lobby: flag, allowSpectators: n % 3 !== 0 },
    { type: 'admin.lock', locked: flag },
    { type: 'admin.kick', participantId },
    { type: 'admin.promote', participantId },
    { type: 'admin.demote', participantId },
    { type: 'admin.lobby', participantId, decision: flag ? 'approve' : 'deny' },
    { type: 'admin.extend', hours: 1 + (n % 8) },
    { type: 'ping' },
    { type: 'admin.close' },
  ];
  const i = o.msg % all.length;
  return (i === all.length - 1 && n % 4 !== 0 ? all[0] : all[i]) as ClientMessageInput;
}

const ADMIN_ONLY = new Set([
  'admin.settings',
  'admin.promote',
  'admin.demote',
  'admin.extend',
  'admin.close',
]);
const UNAUTH_ERRORS = new Set([
  'not_joined',
  'bad_json',
  'invalid_message',
  'too_large',
  'unsupported_version',
  'unauthorized',
]);

type RoomCfg = typeof configArb extends fc.Arbitrary<infer T> ? T : never;

const stats = { revealedFrames: 0, unrevealedFrames: 0, intruderFrames: 0, forgerAttempts: 0 };

async function runScenario(ops: Op[], cfg: RoomCfg): Promise<void> {
  let now = 1_700_000_000_000;
  const { engine, joinSecret, adminSecret } = await LoopbackEngine.create(
    {
      config: {
        scale: PRESETS.fibonacci.cards.map((c) => ({ ...c })),
        autoReveal: cfg.autoReveal,
        anonymousAfterReveal: cfg.anonymousAfterReveal,
        lobby: cfg.lobby,
        allowSpectators: cfg.allowSpectators,
        maxParticipants: 6,
      },
      ...(cfg.passcode ? { passcode: 'open sesame' } : {}),
    },
    { now: () => now },
  );
  const forbidden = [
    joinSecret,
    adminSecret,
    ...Object.values(engine.state.secrets).filter((s) => typeof s === 'string'),
  ];
  const actors: Actor[] = KINDS.map((kind) => ({
    kind,
    client: engine.connect(),
    seen: 0,
    tokens: [],
    everWelcomed: false,
  }));

  const helloFor = (a: Actor, resumeOwn: boolean): ClientMessageInput => {
    const base = {
      type: 'hello' as const,
      v: 1 as const,
      name: `${a.kind}-${actors.indexOf(a)}`,
      role: a.kind === 'spectator' ? ('spectator' as const) : ('voter' as const),
      joinSecret: a.kind === 'intruder' ? FAKE_SECRET : joinSecret,
      ...(cfg.passcode ? { passcode: a.kind === 'intruder' ? 'guess' : 'open sesame' } : {}),
    };
    if (a.kind === 'admin') return { ...base, adminSecret };
    if (a.kind === 'forger') return { ...base, adminSecret: FAKE_SECRET };
    const token = resumeOwn ? a.tokens.at(-1) : undefined;
    return token ? { ...base, resumeToken: token } : base;
  };

  const checkFrames = (a: Actor) => {
    const fresh = a.client.messages.slice(a.seen);
    a.seen = a.client.messages.length;
    for (const m of fresh) {
      const text = JSON.stringify(m);
      for (const s of forbidden) expect(text.includes(s), `secret leaked to ${a.kind}`).toBe(false);
      if (a.kind === 'intruder' || a.kind === 'mute') {
        stats.intruderFrames++;
        expect(['error', 'closed']).toContain(m.type);
        if (m.type === 'error') expect(UNAUTH_ERRORS.has(m.code), m.code).toBe(true);
        if (m.type === 'closed')
          expect(['not_found', 'expired', 'idle', 'closed', 'rejected']).toContain(m.reason);
        if (a.kind === 'intruder' && m.type === 'closed' && engine.state.closed === null) {
          expect(m.reason).toBe('not_found');
        }
      }
      if (m.type === 'welcome' || m.type === 'lobby') {
        if (m.type === 'welcome') a.everWelcomed = true;
        const t = m.type === 'welcome' ? m.you.resumeToken : m.resumeToken;
        if (t) a.tokens.push(t);
      }
      if (m.type === 'welcome' || m.type === 'state') checkView(a, m);
    }
    const others = actors.filter((o) => o !== a).flatMap((o) => o.tokens);
    for (const m of fresh) {
      const text = JSON.stringify(m);
      for (const t of others) expect(text.includes(t)).toBe(false);
    }
  };

  const checkView = (a: Actor, m: Extract<ServerMessage, { type: 'welcome' | 'state' }>) => {
    const view = m.room;
    expect(a.kind === 'intruder' || a.kind === 'mute').toBe(false);
    for (const t of view.tasks) {
      for (const r of t.rounds) {
        if (!r.revealed) {
          stats.unrevealedFrames++;
          expect(r.votes).toBeNull();
          expect(r.stats).toBeNull();
        } else {
          stats.revealedFrames++;
          if (r.anonymous)
            for (const vote of r.votes ?? []) expect(vote.participantId ?? vote.name).toBeNull();
        }
      }
    }
    const me = view.me;
    const facilitator = me !== null && me.authority !== 'none';
    if (!facilitator) {
      expect(view.lobby).toEqual([]);
      expect(view.config.allowlist).toEqual([]);
      expect(view.settings.passcodeLocked).toBe(false);
    }
    if (me?.authority === 'admin') expect(a.kind).toBe('admin');
  };

  const send = async (a: Actor, msg: ClientMessageInput | string) => {
    if (!a.client.open) return;
    await a.client.send(msg);
  };

  for (const op of ops) {
    if (engine.closed) break;
    const before = engine.state;
    let sender: Actor | undefined;
    let sentType: string | null = null;
    switch (op.k) {
      case 'time':
        now += op.ms;
        await engine.runAlarms();
        break;
      case 'hello': {
        sender = actors[op.who];
        if (sender) {
          if (sender.kind === 'forger') stats.forgerAttempts++;
          await send(
            sender,
            sender.kind === 'mute' ? { type: 'ping' } : helloFor(sender, op.resumeOwn),
          );
        }
        break;
      }
      case 'vote': {
        sender = actors[op.who];
        const s = engine.state;
        const task = s.tasks.find((t) => t.id === s.currentTaskId);
        const round = (task?.rounds.at(-1)?.n ?? 1) + (op.stale ? 1 : 0);
        const taskId = task?.id ?? 'nonexistent';
        const msg: ClientMessageInput = op.unvote
          ? { type: 'unvote', taskId, round }
          : { type: 'vote', taskId, round, value: SCALE[op.value] ?? '42' };
        if (sender) await send(sender, msg);
        break;
      }
      case 'admin': {
        sender = actors[op.who];
        const msg = adminMessage(engine.state, op);
        sentType = msg.type;
        if (sender) await send(sender, msg);
        break;
      }
      case 'raw':
        sender = actors[op.who];
        if (sender) await send(sender, op.text);
        break;
      case 'extraKey': {
        sender = actors[op.who];
        const msg = adminMessage(engine.state, op) as Record<string, unknown>;
        const text = `${JSON.stringify(msg).slice(0, -1)},${JSON.stringify(op.key)}:{"authority":"admin"}}`;
        if (sender) await send(sender, text);
        expect(engine.state).toBe(before);
        break;
      }
      case 'reconnect': {
        const a = actors[op.who];
        if (a) {
          if (a.client.open) await a.client.disconnect();
          a.client = engine.connect();
          a.seen = 0;
          await engine.idle();
        }
        break;
      }
      case 'disconnect': {
        const a = actors[op.who];
        if (a?.client.open) await a.client.disconnect();
        break;
      }
    }

    for (const a of actors) checkFrames(a);
    const s = engine.state;

    const adminConns = new Set(actors.filter((a) => a.kind === 'admin').map((a) => a.client.id));
    for (const p of s.participants) {
      if (p.authority === 'admin') expect(p.conn === null || adminConns.has(p.conn)).toBe(true);
    }
    for (const a of actors) {
      if (a.kind === 'intruder' || a.kind === 'mute') {
        expect(s.participants.some((p) => p.conn === a.client.id)).toBe(false);
      }
    }
    if (sender && sender.kind !== 'admin' && op.k !== 'time' && s.closed === null) {
      expect(s.settings.autoReveal).toBe(before.settings.autoReveal);
      expect(s.settings.lobby).toBe(before.settings.lobby);
      expect(s.settings.allowSpectators).toBe(before.settings.allowSpectators);
      expect(s.settings.anonymousAfterReveal).toBe(before.settings.anonymousAfterReveal);
      expect(s.expiresAt).toBe(before.expiresAt);
    }
    if (sender && sentType && ADMIN_ONLY.has(sentType) && sender.kind !== 'admin') {
      expect(s.closed === 'closed' && before.closed === null).toBe(false);
    }
    for (const t of s.tasks)
      for (const r of t.rounds) for (const v of r.votes) expect(SCALE).toContain(v.value);
    expect(s.expiresAt - s.createdAt).toBeLessThanOrEqual(s.limits.maxLifetimeMs);
  }

  if (!engine.closed) {
    const s = engine.state;
    const r = reduce(s, { type: 'tick' }, { now: s.expiresAt, randomId: () => 'x' });
    expect(r.effects.filter((e) => e.type === 'deleteAll')).toHaveLength(1);
    expect(r.state.closed).toBe('expired');
    const again = reduce(
      r.state,
      { type: 'message', conn: 'late', msg: { type: 'ping' } },
      { now: s.expiresAt + 1, randomId: () => 'x' },
    );
    expect(again.state).toBe(r.state);
    expect(again.effects).toEqual([{ type: 'close', to: 'late', reason: 'expired' }]);
    const idleTick = reduce(
      s,
      { type: 'tick' },
      { now: s.lastActivityAt + s.limits.idleTimeoutMs, randomId: () => 'x' },
    );
    expect(idleTick.effects.some((e) => e.type === 'deleteAll')).toBe(true);

    now = Math.max(now, s.expiresAt);
    await engine.runAlarms();
    expect(engine.closed).toBe(true);
    for (const a of actors) expect(a.client.open).toBe(false);
  }
}

describe('room fuzz (full pipeline, hostile actors)', () => {
  it('keeps privacy and authorization invariants for random sessions', async () => {
    const opening: Op[] = [
      { k: 'hello', who: 0, resumeOwn: false },
      { k: 'hello', who: 1, resumeOwn: false },
      { k: 'hello', who: 2, resumeOwn: false },
      { k: 'hello', who: 3, resumeOwn: false },
      { k: 'admin', who: 0, msg: 18, target: 1, n: 0, flag: true },
      { k: 'admin', who: 0, msg: 18, target: 2, n: 0, flag: true },
      { k: 'admin', who: 0, msg: 18, target: 3, n: 0, flag: true },
      { k: 'admin', who: 0, msg: 0, target: 0, n: 1, flag: false },
      { k: 'admin', who: 0, msg: 4, target: 0, n: 0, flag: false },
      { k: 'vote', who: 1, value: 2, unvote: false, stale: false },
    ];
    await fc.assert(
      fc.asyncProperty(
        fc.nat(4),
        fc.array(opArb, { minLength: 5, maxLength: 100 }),
        configArb,
        async (open, ops, cfg) => {
          await runScenario(open > 0 ? [...opening, ...ops] : ops, cfg);
        },
      ),
      { numRuns: 1000 },
    );
    expect(stats.unrevealedFrames).toBeGreaterThan(100);
    expect(stats.revealedFrames).toBeGreaterThan(100);
    expect(stats.intruderFrames).toBeGreaterThan(100);
    expect(stats.forgerAttempts).toBeGreaterThan(50);
  });

  it('a hello without adapter authentication is rejected', async () => {
    const { engine } = await LoopbackEngine.create(
      { config: { scale: PRESETS.fibonacci.cards.map((c) => ({ ...c })) } },
      { now: () => 1 },
    );
    const s = engine.state;
    const r = reduce(
      s,
      {
        type: 'message',
        conn: 'c',
        msg: { type: 'hello', v: 1, joinSecret: FAKE_SECRET, name: 'x', role: 'voter' },
      },
      { now: 2, randomId: () => 'p' },
    );
    expect(r.state).toBe(s);
    expect(r.effects).toContainEqual({ type: 'close', to: 'c', reason: 'rejected' });
  });
});
