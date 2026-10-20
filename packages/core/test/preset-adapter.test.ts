import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIFETIME_HOURS,
  DEFAULT_LIMITS,
  HOUR_MS,
  LIFETIME_CHOICES_HOURS,
  PRESET_MAX_BYTES,
  parsePreset,
  parseRoomConfig,
  presetScale,
  reconcileConnections,
  serializePreset,
  toCoreLimits,
} from '../src/index.ts';
import { ctx, join, newRoom, send, T0 } from './helpers.ts';

const config = {
  scale: presetScale('tshirt'),
  taskPolicy: 'allowlist' as const,
  allowlist: ['Jira.Example.com'],
  linkTemplate: 'https://jira.example.com/browse/{id}',
  lobby: true,
  timerSeconds: 90,
};

describe('presets', () => {
  it('serialize → parse round-trips the validated config', () => {
    const parsed = parseRoomConfig(config);
    if (!parsed.ok) throw new Error('config');
    const text = serializePreset(config, { name: ' Team Rocket ', lifetimeHours: 4 });
    const r = parsePreset(text);
    expect(r).toEqual({
      ok: true,
      msg: {
        format: 'backlogfit-preset',
        v: 1,
        name: 'Team Rocket',
        lifetimeHours: 4,
        config: parsed.msg,
      },
    });
    expect(r.ok && r.msg.config.allowlist).toEqual(['jira.example.com']);
    if (r.ok) expect(serializePreset(r.msg.config, r.msg)).toBe(text);
  });

  it('accepts a bare RoomConfig and already parsed objects', () => {
    expect(parsePreset(JSON.stringify(config))).toMatchObject({
      ok: true,
      msg: { name: null, lifetimeHours: null, config: { lobby: true } },
    });
    expect(parsePreset({ format: 'backlogfit-preset', v: 1, config })).toMatchObject({ ok: true });
  });

  it('rejects bad input with codes, never throws', () => {
    expect(parsePreset('{')).toEqual({ ok: false, code: 'bad_json' });
    expect(parsePreset('x'.repeat(PRESET_MAX_BYTES + 1))).toEqual({
      ok: false,
      code: 'too_large',
    });
    expect(parsePreset('[]')).toEqual({ ok: false, code: 'invalid_message' });
    expect(parsePreset(null)).toEqual({ ok: false, code: 'invalid_message' });
    expect(parsePreset({ format: 'backlogfit-preset', v: 2, config })).toEqual({
      ok: false,
      code: 'unsupported_version',
    });
    for (const bad of [
      { format: 'backlogfit-preset', v: 1, config, passcode: 'x' },
      { format: 'backlogfit-preset', v: 1, config, lifetimeHours: 3 },
      { format: 'backlogfit-preset', v: 1, config, name: 'a‮b' },
      { format: 'other', v: 1, config },
      { ...config, scale: [] },
      { format: 'backlogfit-preset', v: 1, config: { ...config, idPattern: '(a+)+' } },
    ]) {
      expect(parsePreset(bad)).toEqual({ ok: false, code: 'invalid_message' });
    }
    expect(() => serializePreset({ ...config, scale: [] })).toThrow(TypeError);
  });

  it('lifetime choices match the spec', () => {
    expect(LIFETIME_CHOICES_HOURS).toEqual([1, 2, 4, 8]);
    expect(DEFAULT_LIFETIME_HOURS).toBe(2);
  });
});

describe('toCoreLimits', () => {
  it('converts env units and keeps defaults', () => {
    expect(toCoreLimits()).toEqual(DEFAULT_LIMITS);
    expect(
      toCoreLimits({
        maxLifetimeHours: 4,
        idleTimeoutMinutes: 10,
        maxParticipants: 20,
        maxTasks: 50,
        passcodeMaxAttempts: 3,
      }),
    ).toEqual({
      maxLifetimeMs: 4 * HOUR_MS,
      idleTimeoutMs: 600_000,
      maxParticipants: 20,
      maxTasks: 50,
      passcodeMaxAttempts: 3,
    });
  });
});

describe('reconcileConnections', () => {
  it('disconnects ghosts after a restart and re-arms the alarm', () => {
    const sim = newRoom();
    join(sim, 'c1', 'Ada', { admin: true });
    join(sim, 'c2', 'Bob');
    sim.now = T0 + 1000;
    const r = reconcileConnections(sim.state, [], ctx(sim));
    expect(r.state.participants.every((p) => p.conn === null)).toBe(true);
    expect(r.effects.filter((e) => e.type === 'broadcastState')).toHaveLength(1);
    expect(r.effects.at(-1)).toEqual({ type: 'scheduleAlarm', at: r.state.alarmAt });
  });

  it('keeps live sockets and still re-arms when nothing changed', () => {
    const sim = newRoom();
    join(sim, 'c1', 'Ada', { admin: true });
    const r = reconcileConnections(sim.state, ['c1'], ctx(sim));
    expect(r.state).toBe(sim.state);
    expect(r.effects).toEqual([{ type: 'scheduleAlarm', at: sim.state.alarmAt }]);
  });

  it('lets auto-reveal proceed once ghosts are gone', () => {
    const sim = newRoom();
    join(sim, 'c1', 'Ada', { admin: true });
    join(sim, 'c2', 'Bob');
    send(sim, 'c1', { type: 'admin.tasks.add', lines: ['SCP-1'] });
    send(sim, 'c1', { type: 'admin.next' });
    const t = sim.state.tasks[0]?.id ?? '';
    send(sim, 'c1', { type: 'vote', taskId: t, round: 1, value: '3' });
    const r = reconcileConnections(sim.state, ['c1'], ctx(sim));
    expect(r.state.tasks[0]?.rounds[0]?.revealedAt).not.toBeNull();
  });

  it('closes an expired room and cancels the alarm', () => {
    const sim = newRoom();
    join(sim, 'c1', 'Ada', { admin: true });
    sim.now = sim.state.expiresAt + 1;
    const r = reconcileConnections(sim.state, [], ctx(sim));
    expect(r.state.closed).toBe('expired');
    expect(r.effects.some((e) => e.type === 'deleteAll')).toBe(true);
    expect(r.effects.at(-1)).toEqual({ type: 'scheduleAlarm', at: null });
    expect(r.effects.some((e) => e.type === 'broadcastState')).toBe(false);
  });
});
