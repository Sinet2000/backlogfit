import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from 'cloudflare:test';
import {
  type ClientMessageInput,
  hashSecret,
  parseServerMessage,
  presetScale,
  type RoomState,
  randomToken,
  type ServerMessage,
} from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/env.ts';

const ORIGIN = 'http://app.test';
const BASE = 'http://app.test';
const rooms = (env as unknown as Env).ROOMS;

interface Room {
  roomId: string;
  joinSecret: string;
  adminSecret: string;
}

function body(joinHash: string, adminHash: string) {
  return {
    v: 1,
    config: { scale: presetScale('fibonacci') },
    joinHash,
    adminHash,
    lifetimeHours: 2,
  };
}

function post(data: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

async function createRoom(): Promise<Room> {
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const res = await post(body(await hashSecret(joinSecret), await hashSecret(adminSecret)), {
    'cf-connecting-ip': randomIp(),
  });
  expect(res.status).toBe(201);
  const { roomId } = (await res.json()) as { roomId: string };
  return { roomId, joinSecret, adminSecret };
}

/** A fresh TEST-NET-3 address per call, so the per-client upgrade budget does not interfere. */
function randomIp(): string {
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  return `203.0.${b[0]}.${b[1]}`;
}

function upgrade(roomId: string, origin: string | null = ORIGIN, ip: string = randomIp()) {
  return SELF.fetch(`${BASE}/ws/${roomId}`, {
    headers: { upgrade: 'websocket', 'cf-connecting-ip': ip, ...(origin ? { origin } : {}) },
  });
}

function stubOf(roomId: string) {
  return rooms.get(rooms.idFromName(roomId));
}

class Client {
  readonly messages: ServerMessage[] = [];
  readonly frames: string[] = [];
  readonly closed: Promise<number>;
  #seen = 0;
  #wake: (() => void) | null = null;

  readonly ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.accept();
    this.closed = new Promise((resolve) => ws.addEventListener('close', (e) => resolve(e.code)));
    ws.addEventListener('message', (e) => {
      const text = typeof e.data === 'string' ? e.data : '';
      this.frames.push(text);
      const parsed = parseServerMessage(text);
      if (!parsed.ok) throw new Error(`invalid server message ${text}`);
      this.messages.push(parsed.msg);
      this.#wake?.();
    });
  }

  static async open(
    roomId: string,
    origin: string | null = ORIGIN,
    ip: string = randomIp(),
  ): Promise<Client> {
    const res = await upgrade(roomId, origin, ip);
    if (!res.webSocket) throw new Error(`upgrade refused: ${res.status}`);
    return new Client(res.webSocket);
  }

  send(msg: ClientMessageInput | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  async next<T extends ServerMessage['type']>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + 5000;
    for (;;) {
      for (let i = this.#seen; i < this.messages.length; i++) {
        const m = this.messages[i] as ServerMessage;
        if (m.type === type && pred(m as Extract<ServerMessage, { type: T }>)) {
          this.#seen = i + 1;
          return m as Extract<ServerMessage, { type: T }>;
        }
      }
      if (Date.now() > deadline) throw new Error(`timeout waiting for ${type}`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        this.#wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
    }
  }
}

async function join(room: Room, name: string, admin = false) {
  const c = await Client.open(room.roomId);
  c.send({
    type: 'hello',
    v: 1,
    joinSecret: room.joinSecret,
    name,
    role: 'voter',
    ...(admin ? { adminSecret: room.adminSecret } : {}),
  });
  const welcome = await c.next('welcome');
  return { c, welcome };
}

/** Every table in the object's SQLite database (internal `_cf_` tables excluded). */
async function tables(roomId: string): Promise<string[]> {
  return runInDurableObject(stubOf(roomId), (_i, state) =>
    state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
      )
      .toArray()
      .map((r) => r.name),
  );
}

async function storageKeys(roomId: string): Promise<number> {
  return runInDurableObject(stubOf(roomId), async (_instance, state) => {
    const rows = state.storage.sql
      .exec<{ n: number }>(
        "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'room'",
      )
      .one().n;
    const data = rows ? state.storage.sql.exec('SELECT * FROM room').toArray().length : 0;
    const alarm = await state.storage.getAlarm();
    return data + (alarm === null ? 0 : 1);
  });
}

describe('HTTP API', () => {
  it('health, create, validation, origin', async () => {
    const health = await SELF.fetch(`${BASE}/api/health`);
    expect(await health.json()).toEqual({ ok: true });
    expect(health.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(health.headers.get('cache-control')).toBe('no-store');

    const room = await createRoom();
    expect(room.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ v: 1 })).status).toBe(400);
    const h = 'a'.repeat(64);
    expect((await post(body(h, h), { origin: 'https://evil.test' })).status).toBe(403);
    expect((await post(body(h, h), { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await SELF.fetch(`${BASE}/api/nope`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/ws/abc`)).status).toBe(426);
  });

  it('rate-limits room creation per client address', async () => {
    const h = 'a'.repeat(64);
    const ip = { 'cf-connecting-ip': '203.0.113.9' };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await post(body(h, h), ip)).status);
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe('RoomDO over WebSockets', () => {
  it('full session: join, vote, reveal, final, close wipes storage', async () => {
    const room = await createRoom();
    const admin = await join(room, 'Ada', true);
    expect(admin.welcome.you.isAdmin).toBe(true);
    const bob = await join(room, 'Bob');

    admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-1 Login'] });
    const added = await admin.c.next('state', (m) => m.room.tasks.length === 1);
    const taskId = added.room.tasks[0]?.id as string;
    admin.c.send({ type: 'admin.next' });
    await bob.c.next('state', (m) => m.room.phase === 'voting');

    admin.c.send({ type: 'vote', taskId, round: 1, value: '13' });
    const seen = await bob.c.next('state', (m) =>
      m.room.participants.some((p) => p.name === 'Ada' && p.hasVoted),
    );
    expect(seen.room.tasks[0]?.rounds[0]?.votes).toBeNull();
    expect(seen.room.myVote).toBeNull();

    bob.c.send({ type: 'vote', taskId, round: 1, value: '5' });
    const revealed = await admin.c.next('state', (m) => m.room.phase === 'revealed');
    expect(revealed.room.tasks[0]?.rounds[0]?.votes?.map((v) => v.value).sort()).toEqual([
      '13',
      '5',
    ]);
    admin.c.send({ type: 'admin.final', taskId, value: '8' });
    await bob.c.next('state', (m) => m.room.tasks[0]?.final === '8');
    expect(await storageKeys(room.roomId)).toBe(2); // state row + alarm

    admin.c.send({ type: 'admin.close' });
    expect(await bob.c.next('closed')).toEqual({ type: 'closed', reason: 'closed' });
    expect(await bob.c.closed).toBe(4003);
    expect(await storageKeys(room.roomId)).toBe(0);

    const late = await Client.open(room.roomId);
    late.send({ type: 'hello', v: 1, joinSecret: room.joinSecret, name: 'Late', role: 'voter' });
    expect(await late.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
    expect(await late.closed).toBe(4404);
  });

  it('unknown rooms answer like a wrong join secret and store nothing', async () => {
    const room = await createRoom();
    const real = await Client.open(room.roomId);
    real.send({ type: 'hello', v: 1, joinSecret: 'A'.repeat(22), name: 'Eve', role: 'voter' });
    const fakeId = `unknownRoom${randomToken(8)}`;
    const fake = await Client.open(fakeId);
    fake.send({ type: 'hello', v: 1, joinSecret: 'A'.repeat(22), name: 'Eve', role: 'voter' });
    expect(await real.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
    expect(await fake.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
    expect(await real.closed).toBe(4404);
    expect(await fake.closed).toBe(4404);
    expect(fake.frames).toEqual(real.frames);
    expect(await storageKeys(fakeId)).toBe(0);
  });

  it('rejects a foreign or missing Origin before upgrading', async () => {
    const room = await createRoom();
    for (const origin of ['https://evil.test', null]) {
      const res = await SELF.fetch(`${BASE}/ws/${room.roomId}`, {
        headers: { upgrade: 'websocket', ...(origin ? { origin } : {}) },
      });
      expect(res.status).toBe(403);
      expect(res.webSocket).toBeNull();
    }
    const dev = await Client.open(room.roomId, 'http://localhost:5173');
    dev.ws.close();
  });

  it('closes on an oversized message (1009) and on an invalid flood (1008)', async () => {
    const room = await createRoom();
    const big = await Client.open(room.roomId);
    big.ws.send('x'.repeat(1025));
    expect(await big.closed).toBe(1009);

    const flood = await Client.open(room.roomId);
    flood.ws.send('not json');
    expect(await flood.next('error')).toEqual({ type: 'error', code: 'bad_json' });
    for (let i = 0; i < 20; i++) flood.ws.send('{');
    expect(await flood.closed).toBe(1008);
  });

  it('closes sockets that never say hello', async () => {
    const room = await createRoom();
    const idle = await Client.open(room.roomId);
    expect(await idle.closed).toBe(1008);
  });

  it('restores connections from attachments after hibernation', async () => {
    const room = await createRoom();
    const admin = await join(room, 'Ada', true);
    const bob = await join(room, 'Bob');
    const stub = stubOf(room.roomId);
    await evictDurableObject(stub); // in-memory state gone, sockets hibernated
    admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-9 After hibernation'] });
    const s = await bob.c.next('state', (m) => m.room.tasks.length === 1);
    // Both participants are still connected: attachments mapped sockets back to them.
    expect(s.room.participants.map((p) => [p.name, p.connected])).toEqual([
      ['Ada', true],
      ['Bob', true],
    ]);
    expect(s.room.me?.participantId).toBe(bob.welcome.you.participantId);
  });

  it('alarm expiry closes sockets and deletes all storage', async () => {
    const room = await createRoom();
    const admin = await join(room, 'Ada', true);
    const stub = stubOf(room.roomId);
    // Pull the hard expiry close, then let a fresh instance pick it up from storage.
    const expiresAt = Date.now() + 4000;
    await runInDurableObject(stub, (_i, state) => {
      const row = state.storage.sql.exec<{ state: string }>('SELECT state FROM room').one();
      const s = JSON.parse(row.state) as RoomState;
      s.expiresAt = expiresAt;
      state.storage.sql.exec('UPDATE room SET state = ?', JSON.stringify(s));
    });
    await evictDurableObject(stub);
    admin.c.send({ type: 'ping' }); // wakes the object: reconcile re-arms the alarm earlier
    await admin.c.next('pong');
    const alarmAt = () => runInDurableObject(stub, (_i, state) => state.storage.getAlarm());
    expect(await alarmAt()).toBe(expiresAt);
    // An early alarm is a harmless tick: the room survives and the alarm is re-armed.
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await alarmAt()).toBe(expiresAt);
    expect(admin.c.messages.some((m) => m.type === 'closed')).toBe(false);
    // Then the real alarm fires at expiresAt.
    await new Promise((r) => setTimeout(r, Math.max(0, expiresAt - Date.now()) + 500));
    expect(await admin.c.next('closed')).toEqual({ type: 'closed', reason: 'expired' });
    expect(await admin.c.closed).toBe(4001);
    expect(await storageKeys(room.roomId)).toBe(0);
  });
});

describe('static assets headers (SEC-006)', () => {
  it('/r and /new are no-store and noindex; hashed assets immutable', async () => {
    for (const p of ['/r', '/new']) {
      const res = await SELF.fetch(`${BASE}${p}`);
      expect(res.status, p).toBe(200);
      expect(res.headers.get('cache-control'), p).toBe('no-store');
      expect(res.headers.get('x-robots-tag'), p).toContain('noindex');
      expect(res.headers.get('content-security-policy'), p).toContain("default-src 'none'");
    }
    const home = await SELF.fetch(`${BASE}/`);
    expect(home.headers.get('x-robots-tag')).toBeNull();
    const js = await SELF.fetch(`${BASE}/_app/immutable/app.abc.js`);
    // Exactly one value: no duplicated immutable block in _headers (SEC-011).
    expect(js.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});

describe('abuse limits', () => {
  it('rate-limits WebSocket upgrades per client address (SEC-004)', async () => {
    const ip = '198.51.100.44';
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await upgrade(`probe${i}abcdefghijklmnop`, ORIGIN, ip);
      statuses.push(res.status);
      res.webSocket?.accept();
      res.webSocket?.close();
    }
    expect(statuses.slice(0, 5).every((s) => s === 101)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it('unknown and ended rooms leave no storage behind (SEC-010)', async () => {
    const fakeId = `unknownRoom${randomToken(8)}`;
    const fake = await Client.open(fakeId);
    fake.send({ type: 'hello', v: 1, joinSecret: 'A'.repeat(22), name: 'Eve', role: 'voter' });
    expect(await fake.closed).toBe(4404);
    expect(await tables(fakeId)).toEqual([]);
    expect(await storageKeys(fakeId)).toBe(0);

    const room = await createRoom();
    expect(await tables(room.roomId)).toEqual(['room']);
    const admin = await join(room, 'Ada', true);
    admin.c.send({ type: 'admin.close' });
    expect(await admin.c.closed).toBe(4003);
    expect(await tables(room.roomId)).toEqual([]);
    // Touching the ended id again (wake-up, probe) still writes nothing.
    const again = await Client.open(room.roomId);
    again.send({ type: 'hello', v: 1, joinSecret: room.joinSecret, name: 'Late', role: 'voter' });
    expect(await again.closed).toBe(4404);
    expect(await tables(room.roomId)).toEqual([]);
    expect(await storageKeys(room.roomId)).toBe(0);
  });

  it('pre-hello squatters cannot lock participants out (SEC-005)', async () => {
    // MAX_PARTICIPANTS=2 in the test config ⇒ pre-hello pool of 2 × 2 + 20 = 24 sockets.
    const room = await createRoom();
    const squatters = await Promise.all(Array.from({ length: 30 }, () => Client.open(room.roomId)));
    const admin = await join(room, 'Ada', true);
    const bob = await join(room, 'Bob');
    expect(bob.welcome.room.participants).toHaveLength(2);
    // The oldest squatters were dropped to make room; the newest are still waiting.
    const codes = await Promise.all(
      squatters.slice(0, 8).map((s) => Promise.race([s.closed, Promise.resolve(-1)])),
    );
    expect(codes.filter((c) => c === 1008).length).toBeGreaterThan(0);
    admin.c.ws.close();
  });
});
