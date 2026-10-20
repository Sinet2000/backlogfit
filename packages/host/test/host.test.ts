import { type RoomState, randomToken } from '@backlogfit/core';
import { DEFAULT_LIMITS as OPTIONS_LIMITS } from '@backlogfit/security';
import { describe, expect, it } from 'vitest';
import {
  type ConnInfo,
  hostOptions,
  RoomHost,
  readStoredState,
  STATE_VERSION,
  scaledClock,
  systemClock,
} from '../src/index.ts';
import {
  attach,
  FakeClock,
  FakeSocket,
  FakeStorage,
  FakeWakeup,
  OPTIONS,
  ports,
  type Rig,
  rig,
  T0,
} from './fakes.ts';

async function joined(
  r: Rig & { room: { joinSecret: string; adminSecret: string } },
  name: string,
  admin = false,
) {
  const s = r.connect();
  await s.write({
    type: 'hello',
    v: 1,
    joinSecret: r.room.joinSecret,
    name,
    role: 'voter',
    ...(admin ? { adminSecret: r.room.adminSecret } : {}),
  });
  const welcome = await s.next('welcome');
  return { s, welcome };
}

describe('wake-ups', () => {
  it('arms the hello deadline, then the room alarm, without re-arming on every frame', async () => {
    const r = await rig();
    expect(r.wakeup.at).toBe(r.host.state.alarmAt);
    const { s } = await joined(r, 'Ada', true);
    expect(r.wakeup.calls).toContain(T0 + OPTIONS.helloTimeoutMs);
    const calls = r.wakeup.calls.length;
    for (let i = 0; i < 5; i++) await s.write({ type: 'ping' });
    expect(r.wakeup.calls.length).toBe(calls);
    await r.advance(OPTIONS.helloTimeoutMs);
    expect(r.wakeup.at).toBe(T0 + OPTIONS.socketTimeoutMs);
  });

  it('treats an early wake-up as harmless and keeps the room', async () => {
    const r = await rig();
    const alarm = r.host.state.alarmAt;
    await r.fire();
    expect(r.host.ended).toBe(false);
    expect(r.wakeup.at).toBe(alarm);
  });

  it('closes an idle room, wipes storage and closes every socket', async () => {
    const r = await rig();
    const { s } = await joined(r, 'Ada', true);
    const lurker = r.connect();
    const idle = OPTIONS.roomLimits.idleTimeoutMs;
    for (let t = 0; t < idle; t += OPTIONS.socketTimeoutMs / 2) {
      await r.advance(OPTIONS.socketTimeoutMs / 2);
      await s.write({ type: 'ping' });
    }
    await r.advance(OPTIONS.socketTimeoutMs);
    expect(await s.next('closed')).toEqual({ type: 'closed', reason: 'idle' });
    expect(s.code).toBe(4002);
    expect(lurker.code).toBe(1008);
    expect(r.storage.wipes).toBe(1);
    expect(r.ended).toBe(1);
    expect(r.host.ended).toBe(true);
    expect(r.wakeup.at).toBeNull();
  });
});

describe('dead sockets', () => {
  it('closes a joined socket that stays silent and marks it disconnected', async () => {
    const r = await rig();
    const ada = await joined(r, 'Ada', true);
    const bob = await joined(r, 'Bob');
    for (let i = 0; i < 4; i++) {
      await r.advance(OPTIONS.socketTimeoutMs / 3);
      await ada.s.write({ type: 'ping' });
    }
    expect(bob.s.code).toBe(1001);
    expect(ada.s.code).toBeNull();
    const s = await ada.s.next(
      'state',
      (m) => m.room.participants.find((p) => p.name === 'Bob')?.connected === false,
    );
    expect(s.room.participants).toHaveLength(2);
  });

  it('remembers liveness for adapters whose sockets outlive the process', async () => {
    const r = await rig();
    const ada = await joined(r, 'Ada', true);
    expect(ada.s.remembered).toHaveLength(1);
    await ada.s.write({ type: 'ping' });
    expect(ada.s.remembered).toHaveLength(1);
    r.clock.wall += OPTIONS.socketTimeoutMs / 2;
    await ada.s.write({ type: 'ping' });
    expect(ada.s.remembered.at(-1)?.lastSeen).toBe(r.clock.wall);
  });
});

describe('restore', () => {
  it('keeps adopted sockets and disconnects the rest', async () => {
    const r = await rig();
    const ada = await joined(r, 'Ada', true);
    const bob = await joined(r, 'Bob');
    const state = r.host.state;
    const wakeup = new FakeWakeup();
    const storage = new FakeStorage();
    const next = new RoomHost(state, ports(r.clock, wakeup, storage), OPTIONS);
    const socket = new FakeSocket();
    socket.host = next;
    socket.conn = ada.s.conn;
    next.adopt(socket, ada.s.remembered[0] as ConnInfo);
    await next.restore(null);
    const p = next.state.participants;
    expect(p.find((x) => x.name === 'Ada')?.conn).toBe(ada.s.conn);
    expect(p.find((x) => x.name === 'Bob')?.conn).toBeNull();
    expect(storage.saved).toHaveLength(1);
    expect(wakeup.at).not.toBeNull();
    await socket.write({ type: 'ping' });
    expect((await socket.next('pong')).serverTime).toBe(r.clock.wall);
    expect(bob.s.code).toBeNull();
  });

  it('keeps a platform alarm that is already early enough', async () => {
    const r = await rig();
    const wakeup = new FakeWakeup();
    const next = new RoomHost(r.host.state, ports(r.clock, wakeup, new FakeStorage()), OPTIONS);
    await next.restore(T0 + 1);
    expect(wakeup.calls).toEqual([]);
  });

  it('expires an overdue room on restore', async () => {
    const r = await rig();
    const overdue: RoomState = { ...r.host.state, expiresAt: T0 - 1 };
    const storage = new FakeStorage();
    const next = new RoomHost(overdue, ports(r.clock, new FakeWakeup(), storage), OPTIONS);
    await next.restore();
    expect(next.ended).toBe(true);
    expect(storage.wipes).toBe(1);
  });

  it('closes adopted sockets whose hello deadline passed', async () => {
    const r = await rig();
    const next = new RoomHost(
      r.host.state,
      ports(r.clock, new FakeWakeup(), new FakeStorage()),
      OPTIONS,
    );
    const socket = new FakeSocket();
    next.adopt(socket, { conn: 'c1', helloBy: T0 - 1, lastSeen: T0 - 1 });
    await next.restore();
    expect(socket.code).toBe(1008);
  });
});

describe('decoys', () => {
  it('never stores anything and still refuses a hello after a long time', async () => {
    const r = await rig(OPTIONS, { decoy: true });
    expect(r.host.isDecoy).toBe(true);
    r.clock.wall += 10 * 60 * 60 * 1000;
    const s = r.connect();
    await s.write({ type: 'hello', v: 1, joinSecret: 'A'.repeat(22), name: 'Eve', role: 'voter' });
    expect(await s.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
    expect(r.storage.saved).toEqual([]);
    expect(r.wakeup.calls.every((at) => at === null || at >= T0)).toBe(true);
    expect(r.host.state.createdAt).toBe(r.clock.wall);
  });

  it('arms only socket deadlines', async () => {
    const r = await rig(OPTIONS, { decoy: true });
    expect(r.wakeup.at).toBeNull();
    const s = r.connect();
    await r.host.idle();
    expect(r.wakeup.at).toBe(T0 + OPTIONS.helloTimeoutMs);
    await r.advance(OPTIONS.helloTimeoutMs);
    expect(s.code).toBe(1008);
  });

  it('refuses to create a real room without storage', async () => {
    const r = await rig();
    await expect(
      RoomHost.create(
        { ...r.host.state, v: 1 } as never,
        'x',
        ports(r.clock, new FakeWakeup(), null),
        OPTIONS,
      ),
    ).rejects.toThrow('storage');
  });
});

describe('abuse limits', () => {
  it('rate-limits a connection, strikes it and closes it with 1008', async () => {
    const options = { ...OPTIONS, rateBurst: 2, rateMsgsPerSec: 1 };
    const r = await rig(options);
    const s = r.connect();
    for (let i = 0; i < 2; i++) await s.write({ type: 'ping' });
    await s.write({ type: 'ping' });
    expect(s.messages.at(-1)).toEqual({ type: 'error', code: 'rate_limited' });
    for (let i = 0; i < options.maxStrikes; i++) await s.write({ type: 'ping' });
    expect(s.code).toBe(1008);
  });

  it('answers rate_limited without a strike when the whole room is saturated', async () => {
    const options = { ...OPTIONS, rateBurst: 1, rateMsgsPerSec: 1 };
    const r = await rig(options);
    const sockets = Array.from({ length: 7 }, () => r.connect());
    for (const s of sockets) await s.write({ type: 'ping' });
    expect(sockets.at(-1)?.messages.at(-1)).toEqual({ type: 'error', code: 'rate_limited' });
    expect(sockets.every((s) => s.code === null)).toBe(true);
  });

  it('closes a socket whose send throws', async () => {
    const r = await rig();
    const s = new FakeSocket();
    s.send = () => {
      throw new Error('gone');
    };
    attach(r.host, s);
    await s.write('{');
    expect(s.code).toBe(1001);
  });
});

describe('errors and shutdown', () => {
  it('reports internal errors and keeps processing', async () => {
    const r = await rig();
    const { s } = await joined(r, 'Ada', true);
    r.storage.failNext = true;
    await s.write({ type: 'admin.tasks.add', lines: ['SCP-1'] });
    expect(r.errors).toHaveLength(1);
    await s.write({ type: 'ping' });
    expect(await s.next('pong')).toMatchObject({ type: 'pong' });
  });

  it('stop closes sockets with 1001 and leaves state untouched', async () => {
    const r = await rig();
    const { s } = await joined(r, 'Ada', true);
    const saved = r.storage.saved.length;
    await r.host.stop();
    await r.host.idle();
    expect(s.code).toBe(1001);
    expect(r.storage.saved).toHaveLength(saved);
    expect(r.wakeup.at).toBeNull();
    await s.write({ type: 'ping' });
    expect(r.host.connectionCount).toBe(0);
  });

  it('ignores frames and disconnects for unknown connections', async () => {
    const r = await rig();
    await r.host.receive('nope', '{}');
    await r.host.disconnected('nope');
    expect(r.errors).toEqual([]);
  });
});

describe('clocks and options', () => {
  it('scales room time and maps it back to wall time', () => {
    let wall = 1000;
    const c = scaledClock(60, () => wall);
    wall = 2000;
    expect(c.roomNow()).toBe(1000 + 60_000);
    expect(c.wallAt(c.roomNow())).toBe(2000);
    expect(c.now()).toBe(2000);
    expect(scaledClock(1).wallAt(5)).toBe(5);
    expect(systemClock(() => 7).roomNow()).toBe(7);
  });

  it('derives host options from env limits', () => {
    const o = hostOptions({ ...OPTIONS_LIMITS, maxParticipants: 3, helloTimeoutSeconds: 2 });
    expect(o.maxPending).toBe(26);
    expect(o.helloTimeoutMs).toBe(2000);
    expect(o.roomLimits.maxParticipants).toBe(3);
  });
});

describe('stored state', () => {
  it('accepts this version only', async () => {
    const r = await rig();
    const json = JSON.stringify(r.host.state);
    expect(readStoredState(json, r.host.roomId)?.roomId).toBe(r.host.roomId);
    expect(readStoredState(json, 'other')).toBeNull();
    expect(readStoredState('{nope')).toBeNull();
    expect(readStoredState('null')).toBeNull();
    expect(readStoredState(JSON.stringify({ ...r.host.state, v: STATE_VERSION + 1 }))).toBeNull();
    expect(readStoredState(JSON.stringify({ ...r.host.state, participants: 1 }))).toBeNull();
    expect(randomToken(4)).toHaveLength(6);
    expect(new FakeClock().now()).toBe(T0);
  });
});
