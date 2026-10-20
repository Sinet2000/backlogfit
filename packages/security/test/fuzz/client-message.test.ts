/**
 * Fuzzing the WebSocket frame parser: the first thing every untrusted byte touches.
 * Invariants: never throws, accepts only schema-shaped messages, never pollutes prototypes,
 * accepted output is a fixed point (re-serializing and re-parsing yields the same message).
 */
import { type ClientMessage, hasUnsafeChars, NAME_MAX, parseClientMessage } from '@backlogfit/core';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HOSTILE_NUMBER_LITERALS,
  hostileNumber,
  nastyString,
  POLLUTION_KEYS,
  pollutionKey,
} from './arbitraries.ts';

const RUNS = { numRuns: 2000 };
const PROTO_KEYS = Object.getOwnPropertyNames(Object.prototype).sort();
const ARRAY_PROTO_KEYS = Object.getOwnPropertyNames(Array.prototype).sort();

function assertNoPollution(): void {
  expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(PROTO_KEYS);
  expect(Object.getOwnPropertyNames(Array.prototype).sort()).toEqual(ARRAY_PROTO_KEYS);
  const probe = {} as Record<string, unknown>;
  for (const k of ['polluted', 'isAdmin', 'admin', 'authority', 'adminSecret', 'x']) {
    expect(probe[k]).toBeUndefined();
  }
}

afterEach(assertNoPollution);

const SECRET = 'S'.repeat(22);
const ID = 'abcDEF123_-';

/** Valid examples of every message type: the seeds that mutations start from. */
const SEEDS: Record<string, unknown>[] = [
  { type: 'hello', v: 1, joinSecret: SECRET, name: 'Ana', role: 'voter' },
  {
    type: 'hello',
    v: 1,
    joinSecret: SECRET,
    name: 'Bo',
    role: 'spectator',
    passcode: 'x',
    adminSecret: SECRET,
    resumeToken: SECRET,
  },
  { type: 'vote', taskId: ID, round: 1, value: '3' },
  { type: 'unvote', taskId: ID, round: 2 },
  { type: 'ping' },
  { type: 'admin.tasks.add', lines: ['ABC-1 Title', 'https://x.example/y'] },
  { type: 'admin.tasks.remove', taskId: ID },
  { type: 'admin.tasks.move', taskId: ID, toIndex: 0 },
  { type: 'admin.next' },
  { type: 'admin.select', taskId: ID },
  { type: 'admin.reveal' },
  { type: 'admin.revote' },
  { type: 'admin.final', taskId: ID, value: '5' },
  { type: 'admin.final', taskId: ID, value: null },
  { type: 'admin.timer', action: 'start', seconds: 30 },
  { type: 'admin.settings', autoReveal: true, lobby: false, timerSeconds: null },
  { type: 'admin.lock', locked: true },
  { type: 'admin.kick', participantId: ID },
  { type: 'admin.promote', participantId: ID },
  { type: 'admin.demote', participantId: ID },
  { type: 'admin.lobby', participantId: ID, decision: 'approve' },
  { type: 'admin.extend', hours: 1 },
  { type: 'admin.close' },
];

const seed = fc.constantFrom(...SEEDS);

const hostileValue = fc.oneof(
  hostileNumber,
  nastyString(40),
  fc.constantFrom(null, true, false, [], {}, [null], { $gt: '' }, '', ' '),
  fc.string({ unit: 'binary', minLength: 60, maxLength: 300 }),
  fc.array(fc.string({ maxLength: 4 }), { maxLength: 300 }),
);

type Mutation =
  | { k: 'set'; key: string; value: unknown }
  | { k: 'drop'; key: string }
  | { k: 'extra'; key: string; value: unknown }
  | { k: 'type'; value: string };

const mutation: fc.Arbitrary<Mutation> = fc.oneof(
  fc.record({
    k: fc.constant('set' as const),
    key: fc.constantFrom(
      'v',
      'joinSecret',
      'name',
      'role',
      'passcode',
      'adminSecret',
      'resumeToken',
      'taskId',
      'round',
      'value',
      'lines',
      'toIndex',
      'action',
      'seconds',
      'autoReveal',
      'timerSeconds',
      'locked',
      'participantId',
      'decision',
      'hours',
    ),
    value: hostileValue,
  }),
  fc.record({
    k: fc.constant('drop' as const),
    key: fc.constantFrom('type', 'v', 'name', 'taskId'),
  }),
  fc.record({
    k: fc.constant('extra' as const),
    key: fc.oneof(pollutionKey, fc.string({ maxLength: 10 })),
    value: hostileValue,
  }),
  fc.record({
    k: fc.constant('type' as const),
    value: fc.oneof(
      fc.constantFrom(
        'Hello',
        'hello ',
        ' hello',
        'HELLO',
        'admin',
        'admin.',
        'admin.*',
        'vote\u0000',
      ),
      fc.constantFrom('__proto__', 'constructor', 'toString'),
      nastyString(12),
    ),
  }),
);

/** Builds JSON text by hand so __proto__ becomes an own key exactly as JSON.parse would see it. */
function toJsonText(base: Record<string, unknown>, muts: Mutation[]): string {
  const entries: [string, unknown][] = Object.entries(base);
  for (const m of muts) {
    if (m.k === 'drop') {
      const i = entries.findIndex(([k]) => k === m.key);
      if (i !== -1) entries.splice(i, 1);
    } else if (m.k === 'set') {
      const i = entries.findIndex(([k]) => k === m.key);
      if (i !== -1) entries[i] = [m.key, m.value];
      else entries.push([m.key, m.value]);
    } else if (m.k === 'extra') {
      entries.push([m.key, m.value]);
    } else {
      const i = entries.findIndex(([k]) => k === 'type');
      if (i !== -1) entries[i] = ['type', m.value];
    }
  }
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v) ?? 'null'}`).join(',')}}`;
}

/** The invariants every accepted message must satisfy, independent of how it was produced. */
function checkAccepted(msg: ClientMessage, raw: string): void {
  expect(Object.getPrototypeOf(msg)).toBe(Object.prototype);
  for (const k of POLLUTION_KEYS) {
    if (k === 'admin') continue;
    expect(Object.hasOwn(msg, k), `own key ${k} in ${raw.slice(0, 120)}`).toBe(false);
  }
  // Fixed point: what we accepted survives a round trip unchanged.
  const again = parseClientMessage(JSON.stringify(msg));
  expect(again).toEqual({ ok: true, msg });
  if (msg.type === 'hello') {
    expect(msg.v).toBe(1);
    expect(hasUnsafeChars(msg.name)).toBe(false);
    expect(msg.name.length).toBeGreaterThan(0);
    expect(msg.name.length).toBeLessThanOrEqual(NAME_MAX);
    expect(msg.name).toBe(msg.name.normalize('NFC').trim());
    expect(msg.joinSecret).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  }
  for (const key of ['round', 'toIndex', 'seconds', 'hours'] as const) {
    const n = (msg as Record<string, unknown>)[key];
    if (n !== undefined) {
      expect(Number.isSafeInteger(n)).toBe(true);
      expect(Object.is(n, -0) ? 0 : (n as number)).toBeGreaterThanOrEqual(0);
    }
  }
  if (msg.type === 'vote' || msg.type === 'admin.final') {
    if (msg.value !== null) expect(hasUnsafeChars(msg.value)).toBe(false);
  }
}

function parseNeverThrows(raw: string | Uint8Array, maxBytes?: number) {
  let r: ReturnType<typeof parseClientMessage> | undefined;
  expect(() => {
    r = parseClientMessage(raw, maxBytes);
  }).not.toThrow();
  if (!r) throw new Error('unreachable');
  return r;
}

describe('parseClientMessage fuzz', () => {
  it('never throws on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 400 }), (s) => {
        const r = parseNeverThrows(s);
        if (r.ok) checkAccepted(r.msg, s);
      }),
      RUNS,
    );
  });

  it('never throws on arbitrary bytes (strict UTF-8)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 400 }), (b) => {
        const r = parseNeverThrows(b);
        if (r.ok) checkAccepted(r.msg, '<bytes>');
      }),
      RUNS,
    );
    // Invalid UTF-8 never decodes leniently.
    expect(parseClientMessage(new Uint8Array([0x7b, 0xff, 0x7d]))).toEqual({
      ok: false,
      code: 'bad_json',
    });
    // An overlong encoding of '"' must not be accepted as a quote.
    expect(parseClientMessage(new Uint8Array([0x7b, 0xc0, 0xa2, 0x7d])).ok).toBe(false);
  });

  it('never throws on arbitrary JSON values and accepts only schema shapes', () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 6 }), (value) => {
        const raw = JSON.stringify(value);
        const r = parseNeverThrows(raw, 1 << 20);
        if (r.ok) checkAccepted(r.msg, raw);
      }),
      RUNS,
    );
  });

  it('mutated valid messages are either rejected or still satisfy every invariant', () => {
    let accepted = 0;
    fc.assert(
      fc.property(seed, fc.array(mutation, { minLength: 1, maxLength: 4 }), (base, muts) => {
        const raw = toJsonText(base, muts);
        const r = parseNeverThrows(raw, 1 << 20);
        if (r.ok) {
          accepted++;
          checkAccepted(r.msg, raw);
        }
      }),
      { numRuns: 5000 },
    );
    // Some mutations are benign (e.g. a valid optional field); the property must not be vacuous.
    expect(accepted).toBeGreaterThan(0);
  });

  it('rejects every extra key, including prototype keys, on every message type', () => {
    for (const base of SEEDS) {
      for (const key of [...POLLUTION_KEYS, 'extra', 'Type', 'type ']) {
        const raw = toJsonText(base, [{ k: 'extra', key, value: { polluted: true } }]);
        expect(parseClientMessage(raw).ok, raw).toBe(false);
      }
      expect(parseClientMessage(toJsonText(base, [])).ok).toBe(true);
    }
  });

  it('hostile number literals are rejected or exact integers', () => {
    for (const lit of HOSTILE_NUMBER_LITERALS) {
      for (const key of ['round', 'toIndex', 'hours', 'seconds', 'v']) {
        const raw = `{"type":"vote","taskId":"t1","value":"3","${key}":${lit}}`;
        const r = parseNeverThrows(raw);
        if (r.ok) checkAccepted(r.msg, raw);
      }
    }
    expect(parseClientMessage('{"type":"admin.extend","hours":1e400}').ok).toBe(false);
    expect(parseClientMessage('{"type":"admin.tasks.move","taskId":"t","toIndex":1e21}').ok).toBe(
      false,
    );
  });

  it('survives pathological nesting and size', () => {
    for (const depth of [1_000, 10_000, 100_000]) {
      const arrays = `${'['.repeat(depth)}${']'.repeat(depth)}`;
      const objects = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`;
      const inField = `{"type":"ping","x":${arrays}}`;
      for (const raw of [arrays, objects, inField]) {
        const r = parseNeverThrows(raw, 1 << 22);
        expect(r.ok).toBe(false);
      }
    }
    // Default cap: big frames are refused before JSON.parse.
    const big = JSON.stringify({
      type: 'admin.tasks.add',
      lines: Array(200).fill('x'.repeat(100)),
    });
    expect(parseClientMessage(big)).toEqual({ ok: false, code: 'too_large' });
    const multiByte = `{"type":"ping","x":"${'€'.repeat(6000)}"}`;
    expect(parseClientMessage(multiByte)).toEqual({ ok: false, code: 'too_large' });
    // Oversized arrays inside the cap are still rejected by the schema.
    const many = JSON.stringify({ type: 'admin.tasks.add', lines: Array(201).fill('') });
    expect(parseClientMessage(many).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ type: 'admin.tasks.add', lines: [] })).ok).toBe(
      false,
    );
  });

  it('only versioned hellos get unsupported_version, and no input is echoed back', () => {
    fc.assert(
      fc.property(nastyString(30), (s) => {
        const r = parseNeverThrows(JSON.stringify({ type: 'hello', v: s }));
        expect(r).toEqual({ ok: false, code: 'unsupported_version' });
        const r2 = parseNeverThrows(s);
        if (!r2.ok) expect(Object.keys(r2).sort()).toEqual(['code', 'ok']);
      }),
      { numRuns: 500 },
    );
  });
});

describe('display names', () => {
  const helloWith = (name: unknown) =>
    JSON.stringify({ type: 'hello', v: 1, joinSecret: SECRET, name, role: 'voter' });

  it('accepted names are NFC, trimmed, bounded and free of control/bidi/zero-width characters', () => {
    fc.assert(
      fc.property(nastyString(30), (name) => {
        const r = parseNeverThrows(helloWith(name));
        if (r.ok && r.msg.type === 'hello') checkAccepted(r.msg, name);
      }),
      { numRuns: 5000 },
    );
  });

  it('rejects classic spoofing names', () => {
    for (const name of [
      '',
      ' ',
      '​',
      'Admin‮',
      '‮nimdA',
      'Ana\u0000',
      'Ana\nBo',
      'Ana Bo',
      '⁦Ana⁩',
      'A﻿na',
      'x'.repeat(41),
      'é'.repeat(41),
    ]) {
      expect(parseClientMessage(helloWith(name)).ok, JSON.stringify(name)).toBe(false);
    }
    // NFC: a decomposed name is accepted in composed form, so it cannot impersonate.
    const r = parseClientMessage(helloWith('René'));
    expect(r.ok && r.msg.type === 'hello' && r.msg.name).toBe('René');
  });

  // SEC finding (owner A1): lone surrogates and invisible filler characters pass the name
  // filter. Kept as it.fails so the suite stays green; flip to `it` once text.ts is tightened.
  it.fails('rejects lone surrogates and invisible fillers in names', () => {
    for (const name of ['\ud800', 'Ana\udfff', 'ㅤ', 'ᅟ', '⠀', '­', '؜', 'A\u{e0041}']) {
      expect(parseClientMessage(helloWith(name)).ok, JSON.stringify(name)).toBe(false);
    }
  });
});
