import fc from 'fast-check';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  type ClientMessage,
  computeStats,
  csvCell,
  expandEffects,
  indexScale,
  isFacilitator,
  PRESETS,
  parseClientMessage,
  project,
  type ReduceResult,
  type RoomEvent,
  type RoomState,
  RoomViewSchema,
  reduce,
  toCsv,
} from '../src/index.ts';
import { auth, counterIds, HASH, hello, newRoom, T0 } from './helpers.ts';

// -----------------------------------------------------------------------------------------------
// Abstract operations, resolved against the live state when applied.

const CONNS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
const SCALE = PRESETS.fibonacci.cards.map((c) => c.value);

type Op =
  | {
      k: 'hello';
      c: number;
      admin: boolean;
      spectator: boolean;
      resume: number | null;
      passOk: boolean;
      joinOk: boolean;
    }
  | { k: 'disconnect'; c: number }
  | { k: 'tick' }
  | { k: 'vote'; c: number; value: number; stale: boolean; unvote: boolean }
  | { k: 'admin'; c: number; msg: number; target: number; n: number; flag: boolean };

const opArb: fc.Arbitrary<{ dt: number; op: Op }> = fc.record({
  dt: fc.oneof(
    { weight: 300, arbitrary: fc.integer({ min: 0, max: 60_000 }) },
    { weight: 3, arbitrary: fc.integer({ min: 0, max: 40 * 60_000 }) },
    { weight: 1, arbitrary: fc.integer({ min: 0, max: 3 * 3_600_000 }) },
  ),
  op: fc.oneof(
    {
      weight: 3,
      arbitrary: fc.record({
        k: fc.constant('hello' as const),
        c: fc.nat(CONNS.length - 1),
        admin: fc.boolean(),
        spectator: fc.boolean(),
        resume: fc.option(fc.nat(8), { nil: null }),
        passOk: fc.boolean(),
        joinOk: fc.nat(9).map((n) => n > 0),
      }),
    },
    {
      weight: 1,
      arbitrary: fc.record({ k: fc.constant('disconnect' as const), c: fc.nat(CONNS.length - 1) }),
    },
    { weight: 1, arbitrary: fc.record({ k: fc.constant('tick' as const) }) },
    {
      weight: 5,
      arbitrary: fc.record({
        k: fc.constant('vote' as const),
        c: fc.nat(CONNS.length - 1),
        value: fc.nat(SCALE.length),
        stale: fc.nat(5).map((n) => n === 0),
        unvote: fc.nat(5).map((n) => n === 0),
      }),
    },
    {
      weight: 5,
      arbitrary: fc.record({
        k: fc.constant('admin' as const),
        c: fc.nat(CONNS.length - 1),
        msg: fc.nat(19),
        target: fc.nat(8),
        n: fc.nat(30),
        flag: fc.boolean(),
      }),
    },
  ),
});

function pick<T>(xs: readonly T[], i: number): T | undefined {
  return xs.length === 0 ? undefined : xs[i % xs.length];
}

function adminMessage(state: RoomState, o: Extract<Op, { k: 'admin' }>): ClientMessage {
  const taskId = pick(state.tasks, o.target)?.id ?? 'none';
  const participantId = pick(state.participants, o.target)?.id ?? 'none';
  const all: ClientMessage[] = [
    { type: 'admin.tasks.add', lines: [`T-${o.n} task`, o.flag ? 'https://x.example/y' : 'Plain'] },
    { type: 'admin.tasks.remove', taskId },
    { type: 'admin.tasks.move', taskId, toIndex: o.n },
    { type: 'admin.next' },
    { type: 'admin.select', taskId },
    { type: 'admin.reveal' },
    { type: 'admin.revote' },
    { type: 'admin.final', taskId, value: o.flag ? null : (SCALE[o.n % SCALE.length] ?? '1') },
    { type: 'admin.timer', action: o.flag ? 'start' : 'stop', seconds: 5 + o.n },
    { type: 'admin.settings', autoReveal: o.flag, anonymousAfterReveal: o.n % 2 === 0 },
    { type: 'admin.settings', lobby: o.flag, allowSpectators: o.n % 3 !== 0 },
    { type: 'admin.lock', locked: o.flag },
    { type: 'admin.kick', participantId },
    { type: 'admin.promote', participantId },
    { type: 'admin.demote', participantId },
    { type: 'admin.lobby', participantId, decision: o.flag ? 'approve' : 'deny' },
    { type: 'admin.extend', hours: 1 + (o.n % 8) },
    { type: 'admin.close' },
    { type: 'ping' },
    { type: 'admin.tasks.add', lines: ['javascript:alert(1)'] },
  ];
  return all[o.msg % all.length] as ClientMessage;
}

function toRoomEvent(state: RoomState, op: Op, seq: number): RoomEvent {
  switch (op.k) {
    case 'tick':
      return { type: 'tick' };
    case 'disconnect':
      return { type: 'disconnect', conn: CONNS[op.c] ?? 'c0' };
    case 'hello': {
      const resume = op.resume === null ? null : (pick(state.participants, op.resume)?.id ?? null);
      return {
        type: 'message',
        conn: CONNS[op.c] ?? 'c0',
        msg: hello(`N${op.c}`, {
          role: op.spectator ? 'spectator' : 'voter',
          ...(op.admin ? { adminSecret: 'a'.repeat(22) } : {}),
        }),
        auth: auth({
          joinOk: op.joinOk,
          adminOk: op.admin,
          passcodeOk: state.secrets.passcode ? op.passOk : null,
          resumeParticipantId: resume,
          resume: { token: `tok${seq}-xxxxxxxxxxxxxxx`, hash: HASH(String(seq % 10)) },
        }),
      };
    }
    case 'vote': {
      const task =
        state.tasks.find((t) => t.id === state.currentTaskId) ?? pick(state.tasks, op.value);
      const round = task?.rounds[task.rounds.length - 1]?.n ?? 1;
      const taskId = task?.id ?? 'none';
      const r = op.stale ? round + 1 : round;
      const msg: ClientMessage = op.unvote
        ? { type: 'unvote', taskId, round: r }
        : { type: 'vote', taskId, round: r, value: SCALE[op.value] ?? '4' };
      return { type: 'message', conn: CONNS[op.c] ?? 'c0', msg };
    }
    case 'admin':
      return { type: 'message', conn: CONNS[op.c] ?? 'c0', msg: adminMessage(state, op) };
  }
}

interface Trace {
  steps: { before: RoomState; event: RoomEvent; result: ReduceResult }[];
}

function run(ops: { dt: number; op: Op }[], config = {}, passcode = false): Trace {
  const sim = newRoom(config, { passcode });
  const ids = counterIds('x');
  let now = T0;
  const steps: Trace['steps'] = [];
  ops.forEach(({ dt, op }, i) => {
    now += dt;
    const before = sim.state;
    const event = toRoomEvent(before, op, i);
    const result = reduce(before, event, { now, randomId: ids });
    sim.state = result.state;
    steps.push({ before, event, result });
  });
  return { steps };
}

const configArb = fc.record({
  autoReveal: fc.boolean(),
  anonymousAfterReveal: fc.boolean(),
  lobby: fc.boolean(),
  allowSpectators: fc.boolean(),
  maxParticipants: fc.integer({ min: 2, max: 6 }),
});

// A typical opening (admin + voters join, tasks added, voting starts) followed by chaos.
const H = { admin: false, spectator: false, resume: null, passOk: true, joinOk: true } as const;
const OPENING: { dt: number; op: Op }[] = [
  { dt: 0, op: { k: 'hello', c: 0, ...H, admin: true } },
  { dt: 0, op: { k: 'hello', c: 1, ...H } },
  { dt: 0, op: { k: 'hello', c: 2, ...H } },
  { dt: 0, op: { k: 'admin', c: 0, msg: 15, target: 1, n: 0, flag: true } },
  { dt: 0, op: { k: 'admin', c: 0, msg: 15, target: 2, n: 0, flag: true } },
  { dt: 0, op: { k: 'admin', c: 0, msg: 0, target: 0, n: 1, flag: false } },
  { dt: 0, op: { k: 'admin', c: 0, msg: 3, target: 0, n: 0, flag: false } },
];

const scenario = fc.tuple(
  fc
    .tuple(fc.boolean(), fc.array(opArb, { minLength: 5, maxLength: 120, size: 'medium' }))
    .map(([open, ops]) => (open ? [...OPENING, ...ops] : ops)),
  configArb,
  fc.boolean(),
);

const RUNS = { numRuns: 300 };

// -----------------------------------------------------------------------------------------------

/** Replace every unrevealed vote value except `keep`'s with a different card. */
function perturb(state: RoomState, keep: string): RoomState {
  const s = structuredClone(state);
  for (const t of s.tasks) {
    for (const r of t.rounds) {
      if (r.revealedAt !== null) continue;
      for (const vote of r.votes) {
        if (vote.pid === keep) continue;
        const i = SCALE.indexOf(vote.value);
        vote.value = SCALE[(i + 1) % SCALE.length] ?? vote.value;
      }
    }
  }
  return s;
}

const interesting = { secretVotes: 0, revealed: 0 };

describe('properties', () => {
  it('(a) before reveal no viewer sees anyone else’s vote value', () => {
    fc.assert(
      fc.property(scenario, ([ops, config, passcode]) => {
        const { steps } = run(ops, config, passcode);
        for (const { result } of steps) {
          const s = result.state;
          const r = s.tasks.find((t) => t.id === s.currentTaskId)?.rounds.at(-1);
          if (r && r.revealedAt === null && new Set(r.votes.map((x) => x.value)).size >= 2) {
            interesting.secretVotes++;
          }
          if (s.tasks.some((t) => t.rounds.some((x) => x.revealedAt !== null)))
            interesting.revealed++;
          const viewers = [null, 'nobody', ...s.participants.map((p) => p.id)];
          for (const viewer of viewers) {
            const view = project(s, viewer);
            // strict schema: no unexpected fields anywhere in the view
            expect(v.safeParse(RoomViewSchema, view).success).toBe(true);
            // unrevealed rounds carry no values
            for (const t of view.tasks) {
              for (const r of t.rounds) if (!r.revealed) expect(r.votes).toBeNull();
            }
            // non-interference: changing others' secret votes changes nothing the viewer sees
            expect(project(perturb(s, viewer ?? ''), viewer)).toEqual(view);
          }
          // the same holds for every frame actually sent
          for (const out of expandEffects(s, result.effects)) {
            if (out.type !== 'send' || (out.msg.type !== 'state' && out.msg.type !== 'welcome'))
              continue;
            const viewer = s.participants.find((p) => p.conn === out.to)?.id ?? '';
            expect(project(perturb(s, viewer), viewer)).toEqual(out.msg.room);
          }
        }
      }),
      RUNS,
    );
    // guard against a vacuous property: the generator must reach interesting states
    expect(interesting.secretVotes).toBeGreaterThan(100);
    expect(interesting.revealed).toBeGreaterThan(100);
  });

  it('(b) non-facilitators never change admin-controlled state', () => {
    const adminView = (s: RoomState) =>
      JSON.stringify({
        settings: s.settings,
        config: s.config,
        secrets: s.secrets,
        expiresAt: s.expiresAt,
        closed: s.closed,
        currentTaskId: s.currentTaskId,
        tasks: s.tasks.map((t) => [t.id, t.key, t.title, t.url, t.final, t.rounds.length]),
        roles: s.participants.map((p) => [p.id, p.authority, p.status]),
      });
    fc.assert(
      fc.property(scenario, ([ops, config, passcode]) => {
        for (const { before, event, result } of run(ops, config, passcode).steps) {
          if (event.type !== 'message' || event.msg.type === 'hello') continue;
          const actor = before.participants.find((p) => p.conn === event.conn);
          const expired = result.state.closed === 'expired' || result.state.closed === 'idle';
          if (expired) continue;
          const t = event.msg.type;
          if (t.startsWith('admin.')) {
            const ownerOnly = [
              'admin.settings',
              'admin.promote',
              'admin.demote',
              'admin.extend',
              'admin.close',
            ].includes(t);
            const allowed = isFacilitator(actor) && (!ownerOnly || actor?.authority === 'admin');
            if (!allowed) expect(result.state).toBe(before);
          } else if (!isFacilitator(actor)) {
            expect(adminView(result.state)).toBe(adminView(before));
          }
        }
      }),
      RUNS,
    );
  });

  it('(c) lifetime never exceeds the maximum', () => {
    fc.assert(
      fc.property(scenario, ([ops, config]) => {
        for (const { result } of run(ops, config).steps) {
          const s = result.state;
          expect(s.expiresAt - s.createdAt).toBeLessThanOrEqual(s.limits.maxLifetimeMs);
        }
      }),
      RUNS,
    );
  });

  it('(d) reduce is deterministic', () => {
    fc.assert(
      fc.property(scenario, ([ops, config, passcode]) => {
        const a = run(ops, config, passcode).steps.map((s) => s.result);
        const b = run(ops, config, passcode).steps.map((s) => s.result);
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      }),
      { numRuns: 100 },
    );
  });

  it('(e) stats invariants', () => {
    const presets = Object.values(PRESETS).map((p) => p.cards);
    fc.assert(
      fc.property(
        fc.nat(presets.length - 1).chain((i) => {
          const scale = presets[i] ?? [];
          return fc.tuple(
            fc.constant(scale),
            fc.array(
              fc.oneof(fc.constantFrom(...scale.map((c) => c.value)), fc.string({ maxLength: 3 })),
              { maxLength: 60 },
            ),
          );
        }),
        ([scale, values]) => {
          const s = computeStats(values, scale);
          const onScale = values.filter((x) => scale.some((c) => c.value === x)).length;
          const sum = [...s.distribution, ...s.special].reduce((a, d) => a + d.count, 0);
          expect(sum).toBe(s.total);
          expect(s.total).toBe(onScale);
          if (s.median === null) {
            expect(s.estimableCount).toBe(0);
            return;
          }
          const idx = indexScale(scale);
          const lo = idx.measure.get(s.min ?? '') ?? Number.NaN;
          const hi = idx.measure.get(s.max ?? '') ?? Number.NaN;
          expect(lo).toBeLessThanOrEqual(s.median);
          expect(s.median).toBeLessThanOrEqual(hi);
          expect(lo).toBeLessThanOrEqual(s.average ?? Number.NaN);
          expect(s.average ?? Number.NaN).toBeLessThanOrEqual(hi);
          expect(s.spreadSteps).toBeGreaterThanOrEqual(0);
          expect(s.consensus === 'full').toBe(s.spreadSteps === 0);
          for (const m of s.mode) expect(idx.position.has(m)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('(f) parseClientMessage never throws', () => {
    const hello = { type: 'hello', v: 1, joinSecret: 'j'.repeat(22), name: 'A', role: 'voter' };
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ maxLength: 300 }),
          fc.string({ unit: 'binary', maxLength: 300 }),
          fc.jsonValue().map((j) => JSON.stringify(j)),
          fc
            .dictionary(fc.string({ maxLength: 12 }), fc.jsonValue())
            .map((d) => JSON.stringify({ ...hello, ...d })),
          fc.constantFrom(
            '{"__proto__":{"type":"ping"}}',
            '[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]',
            '1e999',
          ),
        ),
        fc.integer({ min: 0, max: 20_000 }),
        (raw, max) => {
          const r = parseClientMessage(raw, max);
          expect(typeof r.ok).toBe('boolean');
        },
      ),
      { numRuns: 1000 },
    );
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(typeof parseClientMessage(bytes).ok).toBe('boolean');
      }),
      { numRuns: 500 },
    );
  });

  it('(g) CSV never emits a cell starting with a formula character', () => {
    const FORMULA = /^[=+\-@\t\r]/;
    const cellsOf = (csv: string) => {
      // minimal RFC 4180 reader
      const cells: string[] = [];
      let i = 0;
      while (i < csv.length) {
        let cell = '';
        if (csv[i] === '"') {
          i++;
          while (i < csv.length) {
            if (csv[i] === '"' && csv[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else if (csv[i] === '"') {
              i++;
              break;
            } else cell += csv[i++];
          }
        } else {
          while (i < csv.length && csv[i] !== ',' && csv[i] !== '\r') cell += csv[i++];
        }
        cells.push(cell);
        if (csv[i] === ',') i++;
        else if (csv[i] === '\r') i += 2;
      }
      return cells;
    };
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        expect(FORMULA.test(cellsOf(csvCell(s))[0] ?? '')).toBe(false);
      }),
      { numRuns: 1000 },
    );
    const textArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.constantFrom('=1+1', '+SUM(A1)', '-2', '@x', '\t=x', 'a,"b"', '=HYPERLINK("http://x")'),
    );
    fc.assert(
      fc.property(
        fc.array(textArb, { minLength: 1, maxLength: 4 }),
        fc.array(textArb, { minLength: 1, maxLength: 4 }),
        (names, titles) => {
          const sim = newRoom({ autoReveal: false, taskPolicy: 'links' });
          const ids = counterIds('q');
          const ctx = () => ({ now: T0, randomId: ids });
          const go = (event: RoomEvent) => {
            sim.state = reduce(sim.state, event, ctx()).state;
          };
          go({
            type: 'message',
            conn: 'ca',
            msg: hello('Admin', { adminSecret: 'a'.repeat(22) }),
            auth: auth({ adminOk: true }),
          });
          names.forEach((name, i) => {
            const parsed = parseClientMessage(JSON.stringify(hello(name)));
            if (parsed.ok) go({ type: 'message', conn: `v${i}`, msg: parsed.msg, auth: auth() });
          });
          go({ type: 'message', conn: 'ca', msg: { type: 'admin.tasks.add', lines: titles } });
          for (const t of sim.state.tasks) {
            go({ type: 'message', conn: 'ca', msg: { type: 'admin.select', taskId: t.id } });
            const round = 1;
            for (const p of sim.state.participants) {
              go({
                type: 'message',
                conn: p.conn ?? '',
                msg: { type: 'vote', taskId: t.id, round, value: '5' },
              });
            }
            go({ type: 'message', conn: 'ca', msg: { type: 'admin.reveal' } });
            const final = parseClientMessage(
              JSON.stringify({ type: 'admin.final', taskId: t.id, value: titles[0]?.slice(0, 16) }),
            );
            if (final.ok) go({ type: 'message', conn: 'ca', msg: final.msg });
          }
          const admin = sim.state.participants[0]?.id ?? '';
          for (const cell of cellsOf(toCsv(project(sim.state, admin)))) {
            expect(FORMULA.test(cell)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
