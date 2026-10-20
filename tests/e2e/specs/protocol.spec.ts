import { request as httpRequest } from 'node:http';
import { createRoomApi, type RoomLinks } from '../fixtures/api.ts';
import { FAST_TIME_SCALE, FAST_URL } from '../fixtures/env.ts';
import { checkFrames } from '../fixtures/privacy.ts';
import { hello, RawClient } from '../fixtures/raw.ts';
import { expect, test } from '../fixtures/test.ts';

type Room = { tasks: { id: string }[]; currentTaskId: string | null; round: number | null };

async function adminWithTask(
  page: import('@playwright/test').Page,
  room: RoomLinks,
): Promise<{ admin: RawClient; taskId: string; round: number }> {
  const admin = await RawClient.open(page, room.roomId);
  await admin.send(
    hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret, role: 'spectator' }),
  );
  await admin.waitType('welcome');
  await admin.send({ type: 'admin.tasks.add', lines: ['SCP-500'] });
  await admin.send({ type: 'admin.next' });
  const f = await admin.waitFor(
    (x) => x.type === 'state' && (x.room as Room).currentTaskId !== null,
  );
  const r = f.room as Room;
  return { admin, taskId: r.currentTaskId ?? '', round: r.round ?? 1 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('wrong join secret and unknown room are indistinguishable (closed not_found, 4404) @smoke', async ({
  page,
}) => {
  const room = await createRoomApi();
  const wrong = await RawClient.open(page, room.roomId);
  await wrong.send(hello('A'.repeat(22), 'Eve'));
  const c1 = await wrong.waitClose();
  const unknown = await RawClient.open(page, 'B'.repeat(22));
  await unknown.send(hello('A'.repeat(22), 'Eve')).catch(() => undefined);
  const c2 = await unknown.waitClose();
  expect(c1.code).toBe(4404);
  expect(c2.code).toBe(4404);
  const f1 = (await wrong.frames()).filter((f) => f.type === 'closed');
  const f2 = (await unknown.frames()).filter((f) => f.type === 'closed');
  expect(f1).toEqual([{ type: 'closed', reason: 'not_found' }]);
  expect(f2).toEqual(f1);
});

test('bad admin secret: error unauthorized then closed rejected (4008)', async ({ page }) => {
  const room = await createRoomApi();
  const c = await RawClient.open(page, room.roomId);
  await c.send(hello(room.joinSecret, 'Mallory', { adminSecret: 'C'.repeat(22) }));
  await c.waitFor((f) => f.type === 'error' && f.code === 'unauthorized');
  await c.waitFor((f) => f.type === 'closed' && f.reason === 'rejected');
  expect((await c.waitClose()).code).toBe(4008);
});

test('messages before hello, bad JSON and unknown keys get error codes; a flood closes 1008', async ({
  page,
}) => {
  const room = await createRoomApi();
  const c = await RawClient.open(page, room.roomId);
  await c.send({ type: 'ping' });
  await c.waitFor((f) => f.type === 'error' && f.code === 'not_joined');
  await c.send('{not json');
  await c.waitFor((f) => f.type === 'error' && f.code === 'bad_json');
  await c.send({ ...hello(room.joinSecret, 'Ada'), extra: 1 });
  await c.waitFor((f) => f.type === 'error' && f.code === 'invalid_message');
  await c.send({ ...hello(room.joinSecret, 'Ada'), v: 2 });
  await c.waitFor((f) => f.type === 'error' && f.code === 'unsupported_version');
  for (const f of await c.frames()) expect(JSON.stringify(f)).not.toContain('not json');
  for (let i = 0; i < 40; i++) await c.send('x');
  expect((await c.waitClose()).code).toBe(1008);
});

test('oversized frames are refused', async ({ page }) => {
  const room = await createRoomApi();
  const c = await RawClient.open(page, room.roomId);
  await c.send(hello(room.joinSecret, 'Ada'));
  await c.waitType('welcome');
  await c.send({ type: 'admin.tasks.add', lines: ['x'.repeat(20_000)] });
  const outcome = await Promise.race([
    c.waitFor((f) => f.type === 'error' && f.code === 'too_large').then(() => 'error'),
    c.waitClose().then((x) => `close:${x.code}`),
  ]);
  expect(['error', 'close:1009', 'close:1008']).toContain(outcome);
});

test('authorization: voters cannot run admin actions, spectators cannot vote, values must be on the scale', async ({
  page,
}) => {
  const room = await createRoomApi({ autoReveal: false });
  const { taskId, round } = await adminWithTask(page, room);

  const voter = await RawClient.open(page, room.roomId);
  await voter.send(hello(room.joinSecret, 'Ada'));
  await voter.waitType('welcome');
  for (const type of ['admin.reveal', 'admin.next', 'admin.close', 'admin.revote']) {
    await voter.send({ type });
    await voter.waitFor((f) => f.type === 'error' && f.code === 'forbidden' && f.ref === type);
  }
  await voter.send({ type: 'vote', taskId, round, value: '4' });
  await voter.waitFor((f) => f.type === 'error' && f.code === 'invalid_value');
  await voter.send({ type: 'vote', taskId, round: round + 1, value: '5' });
  await voter.waitFor((f) => f.type === 'error' && f.code === 'wrong_round');

  const spec = await RawClient.open(page, room.roomId);
  await spec.send(hello(room.joinSecret, 'Sam', { role: 'spectator' }));
  await spec.waitType('welcome');
  await spec.send({ type: 'vote', taskId, round, value: '5' });
  await spec.waitFor((f) => f.type === 'error' && f.code === 'forbidden');

  const frames = (await voter.frames()).map((f) => JSON.stringify(f));
  expect(checkFrames(frames, new Set())).toEqual([]);
});

test('resume token: a second connection takes over and the first gets closed replaced (4006)', async ({
  page,
}) => {
  const room = await createRoomApi();
  const a = await RawClient.open(page, room.roomId);
  await a.send(hello(room.joinSecret, 'Ada'));
  const w = await a.waitType('welcome');
  const you = w.you as { participantId: string; resumeToken: string };
  const b = await RawClient.open(page, room.roomId);
  await b.send(hello(room.joinSecret, 'Ada', { resumeToken: you.resumeToken }));
  const w2 = await b.waitType('welcome');
  expect((w2.you as { participantId: string }).participantId).toBe(you.participantId);
  expect((w2.you as { resumeToken: string }).resumeToken).not.toBe(you.resumeToken);
  await a.waitFor((f) => f.type === 'closed' && f.reason === 'replaced');
  expect((await a.waitClose()).code).toBe(4006);
  const c = await RawClient.open(page, room.roomId);
  await c.send(hello(room.joinSecret, 'Ada', { resumeToken: you.resumeToken }));
  const w3 = await c.waitType('welcome');
  expect((w3.you as { participantId: string }).participantId).not.toBe(you.participantId);
});

test('passcode attempts are limited room-wide', async ({ page }) => {
  const room = await createRoomApi({ passcode: 'open sesame' });
  for (let i = 0; i < 5; i++) {
    const c = await RawClient.open(page, room.roomId);
    await c.send(hello(room.joinSecret, `Guess ${i}`, { passcode: `nope ${i}` }));
    await c.waitFor(
      (f) => f.type === 'error' && (f.code === 'bad_passcode' || f.code === 'passcode_locked'),
    );
  }
  const right = await RawClient.open(page, room.roomId);
  await right.send(hello(room.joinSecret, 'Ada', { passcode: 'open sesame' }));
  await right.waitFor((f) => f.type === 'error' && f.code === 'passcode_locked');
  const admin = await RawClient.open(page, room.roomId);
  await admin.send(hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret }));
  await admin.waitType('welcome');
  await admin.send({ type: 'admin.lock', locked: false });
  await admin.waitType('state');
  const again = await RawClient.open(page, room.roomId);
  await again.send(hello(room.joinSecret, 'Ada', { passcode: 'open sesame' }));
  await again.waitType('welcome');
});

test('the WebSocket upgrade checks Origin', async ({ baseURL }) => {
  const room = await createRoomApi();
  const status = (origin: string | null) =>
    new Promise<number>((resolve, reject) => {
      const u = new URL(`/ws/${room.roomId}`, baseURL);
      const headers: Record<string, string> = {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      };
      if (origin) headers.origin = origin;
      const req = httpRequest({ host: u.hostname, port: u.port, path: u.pathname, headers });
      req.on('upgrade', (_res, socket) => {
        socket.destroy();
        resolve(101);
      });
      req.on('response', (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
  expect(await status('https://evil.example')).toBe(403);
  expect(await status(null)).toBe(403);
  expect(await status(new URL(baseURL ?? '').origin)).toBe(101);
});

test('API: unknown routes 404, health ok, no cookies', async ({ request }) => {
  const h = await request.get('/api/health');
  expect(h.status()).toBe(200);
  expect(await h.json()).toEqual({ ok: true });
  expect((await request.get('/api/nope')).status()).toBe(404);
  expect((await request.get('/api/rooms')).status()).not.toBe(200);
  expect(h.headers()['set-cookie']).toBeUndefined();
});

test('extend is admin-only and clamped to the maximum lifetime', async ({ page }) => {
  const room = await createRoomApi({ lifetimeHours: 2 });
  const admin = await RawClient.open(page, room.roomId);
  await admin.send(hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret }));
  const w = await admin.waitType('welcome');
  const v = w.room as { createdAt: number; expiresAt: number; maxExpiresAt: number };
  const voter = await RawClient.open(page, room.roomId);
  await voter.send(hello(room.joinSecret, 'Ada'));
  await voter.waitType('welcome');
  await voter.send({ type: 'admin.extend', hours: 1 });
  await voter.waitFor((f) => f.type === 'error' && f.code === 'forbidden');
  await admin.send({ type: 'admin.extend', hours: 24 });
  const s = await admin.waitFor(
    (f) => f.type === 'state' && (f.room as { expiresAt: number }).expiresAt !== v.expiresAt,
  );
  expect((s.room as { expiresAt: number }).expiresAt).toBe(v.maxExpiresAt);
});

test.describe('expiry on the fast clock (TEST_TIME_SCALE)', () => {
  test.use({ baseURL: FAST_URL });
  test.skip(() => process.env.E2E_NO_FAST === '1', 'fast-clock server disabled');

  test('idle timeout: closed idle (4002), then the room is gone', async ({ page }) => {
    test.setTimeout(90_000);
    const room = await createRoomApi({ baseURL: FAST_URL });
    const admin = await RawClient.open(page, room.roomId);
    await admin.send(hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret }));
    await admin.waitType('welcome');
    const started = Date.now();
    const pinger = setInterval(
      () => void admin.send({ type: 'ping' }).catch(() => undefined),
      5_000,
    );
    try {
      await admin.waitFor((f) => f.type === 'closed', (30 * 60_000) / FAST_TIME_SCALE + 20_000);
    } finally {
      clearInterval(pinger);
    }
    expect((await admin.frames()).find((f) => f.type === 'closed')).toEqual({
      type: 'closed',
      reason: 'idle',
    });
    expect((await admin.waitClose()).code).toBe(4002);
    expect(Date.now() - started).toBeGreaterThan(((30 * 60_000) / FAST_TIME_SCALE) * 0.8);
    const after = await RawClient.open(page, room.roomId);
    await after
      .send(hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret }))
      .catch(() => undefined);
    expect((await after.waitClose()).code).toBe(4404);
  });

  test('hard expiry: closed expired (4001) even with activity', async ({ page }) => {
    test.setTimeout(120_000);
    const room = await createRoomApi({ baseURL: FAST_URL, lifetimeHours: 1 });
    const admin = await RawClient.open(page, room.roomId);
    await admin.send(hello(room.joinSecret, 'Admin', { adminSecret: room.adminSecret }));
    const w = await admin.waitType('welcome');
    const view = w.room as { createdAt: number; expiresAt: number; maxExpiresAt: number };
    expect(view.expiresAt - view.createdAt).toBe(60 * 60_000);
    expect(view.maxExpiresAt - view.createdAt).toBeLessThanOrEqual(8 * 60 * 60_000);
    let locked = false;
    const busy = setInterval(() => {
      locked = !locked;
      void admin.send({ type: 'admin.lock', locked }).catch(() => undefined);
    }, 5_000);
    try {
      await admin.waitFor((f) => f.type === 'closed', (60 * 60_000) / FAST_TIME_SCALE + 20_000);
    } finally {
      clearInterval(busy);
    }
    expect((await admin.frames()).find((f) => f.type === 'closed')).toEqual({
      type: 'closed',
      reason: 'expired',
    });
    expect((await admin.waitClose()).code).toBe(4001);
  });
});
