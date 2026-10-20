import { describe, expect, it } from 'vitest';
import {
  parseClientMessage,
  parseCreateRoomRequest,
  parseRoomConfig,
  parseServerMessage,
  presetScale,
} from '../src/index.ts';

const hello = {
  type: 'hello',
  v: 1,
  joinSecret: 'j'.repeat(22),
  name: '  Ada  ',
  role: 'voter',
};

describe('parseClientMessage', () => {
  it('accepts and normalizes a hello', () => {
    const r = parseClientMessage(JSON.stringify(hello), 16384);
    expect(r).toEqual({ ok: true, msg: { ...hello, name: 'Ada' } });
  });

  it('rejects oversized, malformed, unknown and versioned frames with codes', () => {
    expect(parseClientMessage('x'.repeat(100), 50)).toEqual({ ok: false, code: 'too_large' });
    expect(parseClientMessage('€'.repeat(20), 50)).toEqual({ ok: false, code: 'too_large' });
    expect(parseClientMessage('{nope', 100)).toEqual({ ok: false, code: 'bad_json' });
    expect(parseClientMessage('{"type":"hack"}')).toEqual({ ok: false, code: 'invalid_message' });
    expect(parseClientMessage('null')).toEqual({ ok: false, code: 'invalid_message' });
    expect(parseClientMessage(JSON.stringify({ ...hello, v: 2 }))).toEqual({
      ok: false,
      code: 'unsupported_version',
    });
  });

  it('rejects unknown keys, prototype keys and unsafe names', () => {
    const bad = [
      { ...hello, extra: 1 },
      { type: 'ping', admin: true },
      { ...hello, name: '' },
      { ...hello, name: '   ' },
      { ...hello, name: 'a'.repeat(41) },
      { ...hello, name: 'Ada‮evil' },
      { ...hello, name: 'Ada\u0007' },
      { ...hello, joinSecret: 'short' },
      { type: 'vote', taskId: 't1', round: 0, value: '5' },
      { type: 'vote', taskId: 't1', round: 1.5, value: '5' },
      { type: 'vote', taskId: 'bad id', round: 1, value: '5' },
      { type: 'admin.tasks.add', lines: [] },
      { type: 'admin.tasks.add', lines: Array(201).fill('A-1') },
      { type: 'admin.final', taskId: 't', value: 'x'.repeat(17) },
      { type: 'admin.timer', action: 'start', seconds: 1 },
      { type: 'admin.extend', hours: 0 },
    ];
    for (const m of bad)
      expect(parseClientMessage(JSON.stringify(m)).ok, JSON.stringify(m)).toBe(false);
    expect(parseClientMessage('{"type":"ping","__proto__":{"x":1}}').ok).toBe(false);
  });

  it('accepts binary frames and rejects invalid UTF-8', () => {
    const bytes = new TextEncoder().encode('{"type":"ping"}');
    expect(parseClientMessage(bytes)).toEqual({ ok: true, msg: { type: 'ping' } });
    expect(parseClientMessage(bytes.buffer as ArrayBuffer).ok).toBe(true);
    expect(parseClientMessage(new Uint8Array([0xff, 0xfe]))).toEqual({
      ok: false,
      code: 'bad_json',
    });
    expect(parseClientMessage(new Uint8Array(100), 10)).toEqual({ ok: false, code: 'too_large' });
  });

  it('accepts every admin message shape', () => {
    const ok = [
      { type: 'unvote', taskId: 't1', round: 1 },
      { type: 'admin.tasks.remove', taskId: 't1' },
      { type: 'admin.tasks.move', taskId: 't1', toIndex: 0 },
      { type: 'admin.next' },
      { type: 'admin.select', taskId: 't1' },
      { type: 'admin.reveal' },
      { type: 'admin.revote' },
      { type: 'admin.final', taskId: 't1', value: null },
      { type: 'admin.timer', action: 'stop' },
      { type: 'admin.settings', autoReveal: false, timerSeconds: null },
      { type: 'admin.lock', locked: true },
      { type: 'admin.kick', participantId: 'p1' },
      { type: 'admin.promote', participantId: 'p1' },
      { type: 'admin.demote', participantId: 'p1' },
      { type: 'admin.lobby', participantId: 'p1', decision: 'approve' },
      { type: 'admin.extend', hours: 2 },
      { type: 'admin.close' },
    ];
    for (const m of ok) expect(parseClientMessage(JSON.stringify(m)).ok, m.type).toBe(true);
  });
});

describe('RoomConfig and create request', () => {
  const scale = presetScale('fibonacci');

  it('applies defaults and normalizes the allowlist', () => {
    const r = parseRoomConfig({
      scale,
      taskPolicy: 'allowlist',
      allowlist: ['Jira.Example.com', 'jira.example.com'],
    });
    expect(r.ok && r.msg).toMatchObject({
      taskPolicy: 'allowlist',
      allowlist: ['jira.example.com'],
      autoReveal: true,
      anonymousAfterReveal: false,
      maxParticipants: 50,
      theme: 'corporate',
      idPattern: null,
      linkTemplate: null,
    });
  });

  it('rejects bad scales, patterns, templates and allowlists', () => {
    const bad = [
      { scale: scale.slice(0, 1) },
      { scale: [scale[0], scale[0]] },
      { scale, idPattern: '(a+)+' },
      { scale, linkTemplate: 'javascript:alert({id})' },
      { scale, linkTemplate: 'https://x.example/{id}/{id}' },
      { scale, taskPolicy: 'allowlist', allowlist: [] },
      {
        scale,
        taskPolicy: 'allowlist',
        allowlist: ['a.example'],
        linkTemplate: 'https://b.example/{id}',
      },
      { scale, allowlist: ['https://x.example/path'] },
      { scale, unknown: true },
    ];
    for (const c of bad) expect(parseRoomConfig(c).ok, JSON.stringify(c).slice(0, 80)).toBe(false);
    expect(parseRoomConfig({ scale, linkTemplate: 'https://jira.example/browse/{id}' }).ok).toBe(
      true,
    );
  });

  it('validates the create request', () => {
    const base = {
      v: 1,
      config: { scale },
      joinHash: 'a'.repeat(64),
      adminHash: 'b'.repeat(64),
      lifetimeHours: 2,
    };
    expect(parseCreateRoomRequest(base).ok).toBe(true);
    expect(parseCreateRoomRequest({ ...base, joinHash: 'A'.repeat(64) }).ok).toBe(false);
    expect(
      parseCreateRoomRequest({ ...base, passcode: { salt: '0'.repeat(32), hash: 'c'.repeat(64) } })
        .ok,
    ).toBe(true);
  });
});

describe('parseServerMessage', () => {
  it('parses known messages and rejects junk', () => {
    expect(parseServerMessage('{"type":"pong","serverTime":1}').ok).toBe(true);
    expect(parseServerMessage('{"type":"closed","reason":"expired"}').ok).toBe(true);
    expect(parseServerMessage('{"type":"error","code":"nope"}').ok).toBe(false);
    expect(parseServerMessage('{').ok).toBe(false);
  });
});
