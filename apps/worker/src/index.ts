/**
 * Worker entry: Hono router for /api and /ws, everything else is served from static assets
 * (see wrangler.jsonc `assets.run_worker_first`). No logging of request data anywhere.
 */
import { parseCreateRoomRequest, randomToken } from '@backlogfit/core';
import { applySecurityHeaders, clientIp, createRateLimiter } from '@backlogfit/security';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { configOf, type Env } from './env.ts';

export { RoomDO } from './room-do.ts';

/** Largest accepted POST /api/rooms body (module-private: entry exports must be handlers). */
const MAX_CREATE_BODY_BYTES = 64 * 1024;
const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Bucket = ReturnType<typeof createRateLimiter<string>>;
/** Used only when a Rate Limiting binding is absent (e.g. some local setups). Per isolate. */
const fallback = new Map<string, Bucket>();

async function allow(
  binding: RateLimit | undefined,
  name: string,
  key: string,
  perMin: number,
): Promise<boolean> {
  if (binding) {
    try {
      return (await binding.limit({ key })).success;
    } catch {
      // binding misbehaving: fall back to the in-memory bucket
    }
  }
  let bucket = fallback.get(name);
  if (!bucket) {
    bucket = createRateLimiter<string>({ rate: perMin / 60, burst: perMin });
    fallback.set(name, bucket);
  }
  return bucket.take(key, Date.now());
}

/** Keyed hash of cf-connecting-ip, held only for this request; never stored or logged. */
function clientKey(headers: Headers): string {
  return clientIp(headers, null, 'cloudflare') ?? 'unknown';
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  await next();
  // A 101 response carries a webSocket and immutable headers; leave it alone.
  if (c.res.status === 101) return;
  // Responses from bindings (ASSETS, Durable Objects) have immutable headers: copy first.
  const res = new Response(c.res.body, c.res);
  applySecurityHeaders(res.headers, c.req.path, { dev: configOf(c.env).dev });
  c.res = res;
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.post(
  '/api/rooms',
  bodyLimit({
    maxSize: MAX_CREATE_BODY_BYTES,
    onError: (c) => c.json({ error: 'too_large' }, 413),
  }),
  async (c) => {
    const config = configOf(c.env);
    const origin = c.req.header('origin');
    if (origin !== undefined && !config.allowedOrigin(origin)) {
      return c.json({ error: 'forbidden' }, 403);
    }
    if (!/^application\/json\s*(;|$)/i.test(c.req.header('content-type') ?? '')) {
      return c.json({ error: 'unsupported_media_type' }, 415);
    }
    const key = clientKey(c.req.raw.headers);
    if (!(await allow(c.env.CREATE_LIMITER, 'create', key, config.limits.roomCreatePerMin))) {
      return c.json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
    }
    let body: unknown;
    try {
      body = JSON.parse(await c.req.text());
    } catch {
      return c.json({ error: 'bad_json' }, 400);
    }
    const parsed = parseCreateRoomRequest(body);
    if (!parsed.ok) return c.json({ error: parsed.code }, 400);
    for (let attempt = 0; attempt < 3; attempt++) {
      const roomId = randomToken(16);
      const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(roomId));
      const created = await stub.create(parsed.msg, roomId);
      if (created) return c.json({ roomId, expiresAt: created.expiresAt }, 201);
    }
    return c.json({ error: 'internal' }, 500);
  },
);

app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

app.get('/ws/:roomId', async (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'upgrade_required' }, 426);
  }
  const roomId = c.req.param('roomId');
  if (!ROOM_ID.test(roomId)) return c.json({ error: 'not_found' }, 404);
  const config = configOf(c.env);
  if (!config.allowedOrigin(c.req.header('origin'))) {
    return c.json({ error: 'forbidden' }, 403);
  }
  // Every upgrade instantiates a Durable Object, so bound them per client (SEC-004).
  const key = clientKey(c.req.raw.headers);
  if (!(await allow(c.env.UPGRADE_LIMITER, 'upgrade', key, config.upgradesPerMin))) {
    return c.json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(roomId));
  return stub.fetch(c.req.raw);
});
app.all('/ws/*', (c) => c.json({ error: 'not_found' }, 404));

// Only reached for paths not handled above when run_worker_first covers them.
app.all('*', async (c) => {
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return c.text('Not Found', 404);
});

app.onError((_e, c) => c.json({ error: 'internal' }, 500));

export default app satisfies ExportedHandler<Env>;
