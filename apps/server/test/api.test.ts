import { hashSecret } from '@backlogfit/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { base, Client, createBody, createRoom, join, ORIGIN, postRoom, start } from './helpers.ts';

let server: RunningServer;

afterEach(async () => {
  await server?.close();
});

const H = 'a'.repeat(64);

describe('HTTP API', () => {
  it('GET /api/health', async () => {
    server = await start();
    const res = await fetch(`${base(server)}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    // dev mode (NODE_ENV=test): no HSTS
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });

  it('treats an empty DATA_DIR as in-memory (SEC-007)', async () => {
    const { readConfig } = await import('../src/config.ts');
    expect(readConfig({ DATA_DIR: '' }).dataDir).toBeNull();
    expect(readConfig({}).dataDir).toBeNull();
  });

  it('requires PUBLIC_ORIGIN in production', async () => {
    const { readConfig } = await import('../src/config.ts');
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('PUBLIC_ORIGIN');
  });

  it('sends HSTS in production mode', async () => {
    server = await start({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://app.test' });
    const res = await fetch(`${base(server)}/api/health`);
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('POST /api/rooms creates a room', async () => {
    server = await start();
    const res = await postRoom(server, createBody(H, await hashSecret('x')));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { roomId: string; expiresAt: number };
    expect(body.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'roomId']);
    expect(server.registry.size).toBe(1);
  });

  it('rejects bad bodies with codes only', async () => {
    server = await start();
    expect((await postRoom(server, '{nope')).status).toBe(400);
    const invalid = await postRoom(server, { v: 1, config: {}, joinHash: H });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_message' });
    const extra = await postRoom(server, { ...createBody(H, H), extra: true });
    expect(extra.status).toBe(400);
    const wrongType = await postRoom(server, createBody(H, H), { 'content-type': 'text/plain' });
    expect(wrongType.status).toBe(415);
    const huge = await postRoom(server, JSON.stringify({ pad: 'x'.repeat(70_000) }));
    expect(huge.status).toBe(413);
    expect(server.registry.size).toBe(0);
  });

  it('rejects cross-origin room creation', async () => {
    server = await start();
    const res = await postRoom(server, createBody(H, H), { origin: 'https://evil.test' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('rate-limits room creation per client', async () => {
    server = await start({ ROOM_CREATE_PER_MIN: '2' });
    expect((await postRoom(server, createBody(H, H))).status).toBe(201);
    expect((await postRoom(server, createBody(H, H))).status).toBe(201);
    const limited = await postRoom(server, createBody(H, H));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate_limited' });
  });

  it('keys room creation on the hop the trusted proxy appended (SEC-003)', async () => {
    server = await start({ ROOM_CREATE_PER_MIN: '1', TRUST_PROXY: 'true' });
    // The client controls everything left of what the proxy appended.
    const spoof1 = { 'x-forwarded-for': '1.1.1.1, 198.51.100.7' };
    const spoof2 = { 'x-forwarded-for': '2.2.2.2, 198.51.100.7' };
    const other = { 'x-forwarded-for': '1.1.1.1, 198.51.100.8' };
    expect((await postRoom(server, createBody(H, H), spoof1)).status).toBe(201);
    expect((await postRoom(server, createBody(H, H), spoof2)).status).toBe(429);
    expect((await postRoom(server, createBody(H, H), other)).status).toBe(201);
    await server.close();

    // Two trusted proxies: the client is the second entry from the right.
    server = await start({ ROOM_CREATE_PER_MIN: '1', TRUST_PROXY: '2' });
    const viaA = { 'x-forwarded-for': '9.9.9.9, 198.51.100.7, 10.0.0.1' };
    const viaB = { 'x-forwarded-for': '8.8.8.8, 198.51.100.7, 10.0.0.2' };
    expect((await postRoom(server, createBody(H, H), viaA)).status).toBe(201);
    expect((await postRoom(server, createBody(H, H), viaB)).status).toBe(429);
    await server.close();

    // Without TRUST_PROXY the header is ignored entirely.
    server = await start({ ROOM_CREATE_PER_MIN: '1' });
    expect((await postRoom(server, createBody(H, H), spoof1)).status).toBe(201);
    expect((await postRoom(server, createBody(H, H), other)).status).toBe(429);
  });

  it('rejects an invalid TRUST_PROXY value', async () => {
    const { readConfig } = await import('../src/config.ts');
    expect(() => readConfig({ TRUST_PROXY: 'yes' })).toThrow('TRUST_PROXY');
    expect(readConfig({ TRUST_PROXY: 'cloudflare' }).trustProxy).toBe('cloudflare');
  });

  it('enforces MAX_ROOMS', async () => {
    server = await start({ MAX_ROOMS: '1' });
    expect((await postRoom(server, createBody(H, H))).status).toBe(201);
    const full = await postRoom(server, createBody(H, H));
    expect(full.status).toBe(503);
    expect(await full.json()).toEqual({ error: 'room_limit' });
  });

  it('unknown API routes and plain GET /ws are errors', async () => {
    server = await start();
    expect((await fetch(`${base(server)}/api/nope`)).status).toBe(404);
    expect((await fetch(`${base(server)}/ws/abc`)).status).toBe(426);
    expect((await fetch(`${base(server)}/`, { method: 'DELETE' })).status).toBe(405);
  });
});

describe('WebSocket guards', () => {
  it('rejects a foreign or missing Origin before upgrading', async () => {
    server = await start({ ALLOWED_ORIGINS: 'http://localhost:5173' });
    const room = await createRoom(server);
    await expect(Client.open(server, room.roomId, 'https://evil.test')).rejects.toThrow(
      'unexpected-response 403',
    );
    await expect(Client.open(server, room.roomId, null)).rejects.toThrow('unexpected-response 403');
    // ALLOWED_ORIGINS adds exact extra origins.
    const dev = await Client.open(server, room.roomId, 'http://localhost:5173');
    dev.close();
    await expect(Client.open(server, room.roomId, 'http://localhost:5174')).rejects.toThrow(
      'unexpected-response 403',
    );
    expect(server.registry.get(room.roomId)?.connectionCount).toBeLessThanOrEqual(1);
  });

  it('rejects malformed WebSocket paths', async () => {
    server = await start();
    const c = new Client(`ws://127.0.0.1:${server.port}/ws/bad%20id`, ORIGIN);
    await expect(c.opened).rejects.toThrow('unexpected-response 404');
  });

  it('closes on an oversized frame (1009)', async () => {
    server = await start({ MAX_MESSAGE_BYTES: '1024' });
    const room = await createRoom(server);
    const c = await Client.open(server, room.roomId);
    c.ws.send('x'.repeat(1025));
    expect((await c.closed).code).toBe(1009);
  });

  it('answers invalid frames with codes, then closes a flood with 1008', async () => {
    server = await start();
    const room = await createRoom(server);
    const c = await Client.open(server, room.roomId);
    c.ws.send('not json');
    expect(await c.next('error')).toEqual({ type: 'error', code: 'bad_json' });
    c.send({ type: 'hello', v: 2 });
    expect(await c.next('error')).toEqual({ type: 'error', code: 'unsupported_version' });
    c.send({ type: 'vote', __proto__: 1 });
    expect(await c.next('error')).toEqual({ type: 'error', code: 'invalid_message' });
    for (let i = 0; i < 20; i++) c.ws.send('{');
    expect((await c.closed).code).toBe(1008);
    // Error frames never echo input.
    for (const f of c.frames) expect(f).not.toContain('not json');
  });

  it('rate-limits a whole room without striking its sockets', async () => {
    // Per-connection burst 2 → per-room burst 10. Six sockets × 2 frames exceed the room bucket.
    server = await start({ RATE_MSGS_PER_SEC: '1', RATE_BURST: '2' });
    const room = await createRoom(server);
    const clients = await Promise.all(
      Array.from({ length: 6 }, () => Client.open(server, room.roomId)),
    );
    for (const c of clients) for (let i = 0; i < 2; i++) c.send({ type: 'ping' });
    await new Promise((r) => setTimeout(r, 200));
    const codes = clients.flatMap((c) =>
      c.messages.flatMap((m) => (m.type === 'error' ? [m.code] : [])),
    );
    expect(codes.filter((c) => c === 'rate_limited')).toHaveLength(2);
    expect(codes).toHaveLength(12);
    for (const c of clients) expect(c.ws.readyState).toBe(c.ws.OPEN);
  });

  it('rate-limits messages per connection', async () => {
    server = await start({ RATE_MSGS_PER_SEC: '1', RATE_BURST: '3' });
    const room = await createRoom(server);
    const admin = await join(server, room, 'Ada', { admin: true });
    for (let i = 0; i < 5; i++) admin.c.send({ type: 'ping' });
    expect(await admin.c.next('error')).toEqual({ type: 'error', code: 'rate_limited' });
  });
});
