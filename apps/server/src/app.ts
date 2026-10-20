import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { parseCreateRoomRequest, toCoreLimits } from '@backlogfit/core';
import {
  applySecurityHeaders,
  clientIp,
  createOriginChecker,
  createRateLimiter,
} from '@backlogfit/security';
import { createAdaptorServer, type HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { type WebSocket, WebSocketServer } from 'ws';
import { createClock } from './clock.ts';
import type { ServerConfig } from './config.ts';
import { RoomRegistry } from './rooms.ts';
import { createStaticHandler } from './static.ts';
import { RoomStore } from './store.ts';

/** Largest accepted POST /api/rooms body. A maximal RoomConfig is well below this. */
export const MAX_CREATE_BODY_BYTES = 64 * 1024;
const ROOM_ID = /^\/ws\/([A-Za-z0-9_-]{1,64})$/;
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  503: 'Service Unavailable',
};

export interface RunningServer {
  port: number;
  registry: RoomRegistry;
  store: RoomStore;
  server: Server;
  close(): Promise<void>;
  /** Open (or handshaking) WebSocket connections, for tests. */
  readonly connections: number;
}

function wsOrigin(origin: string): string {
  return origin.replace(/^http/, 'ws');
}

/** Opaque keyed hash of the client address (never a raw IP); 'unknown' is one shared bucket. */
function clientKey(req: IncomingMessage, config: ServerConfig): string {
  return clientIp(req.headers, req.socket.remoteAddress, config.trustProxy) ?? 'unknown';
}

function rejectUpgrade(socket: Duplex, status: number): void {
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const { limits } = config;
  const clock = createClock(config.timeScale);
  const store = new RoomStore(config.dataDir);
  const registry = new RoomRegistry({
    store,
    clock,
    roomLimits: toCoreLimits(limits),
    maxRooms: limits.maxRooms,
    maxMessageBytes: limits.maxMessageBytes,
    rateMsgsPerSec: limits.rateMsgsPerSec,
    rateBurst: limits.rateBurst,
    helloTimeoutMs: config.helloTimeoutSeconds * 1000,
  });
  await registry.restore();

  const createLimiter = createRateLimiter<string>({
    rate: limits.roomCreatePerMin / 60,
    burst: limits.roomCreatePerMin,
    maxKeys: 100_000,
  });
  const upgradeLimiter = createRateLimiter<string>({
    rate: config.upgradesPerMin / 60,
    burst: config.upgradesPerMin,
    maxKeys: 100_000,
  });
  const allowedOrigin = createOriginChecker(config.origins);
  const headerOpts = {
    dev: config.dev,
    connectSrc: [...new Set(config.origins.map(wsOrigin))],
  };
  const serveStatic = createStaticHandler(config.webDir, { sourceMaps: config.dev });

  const app = new Hono<{ Bindings: HttpBindings }>();

  app.use('*', async (c, next) => {
    await next();
    applySecurityHeaders(c.res.headers, c.req.path, headerOpts);
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.post(
    '/api/rooms',
    bodyLimit({
      maxSize: MAX_CREATE_BODY_BYTES,
      onError: (c) => c.json({ error: 'too_large' }, 413),
    }),
    async (c) => {
      const origin = c.req.header('origin');
      if (origin !== undefined && !allowedOrigin(origin)) {
        return c.json({ error: 'forbidden' }, 403);
      }
      const type = c.req.header('content-type') ?? '';
      if (!/^application\/json\s*(;|$)/i.test(type)) {
        return c.json({ error: 'unsupported_media_type' }, 415);
      }
      if (!createLimiter.take(clientKey(c.env.incoming, config), Date.now())) {
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
      const result = registry.create(parsed.msg);
      if (!result.ok) return c.json({ error: result.code }, 503);
      return c.json({ roomId: result.roomId, expiresAt: result.expiresAt }, 201);
    },
  );

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));
  app.all('/ws/*', (c) => c.json({ error: 'upgrade_required' }, 426));

  // Hono answers HEAD through GET routes and drops the body.
  app.get('*', async (c) => {
    const file = await serveStatic(c.req.path);
    if (!file) return c.text('Not Found', 404, { 'Cache-Control': 'no-store' });
    return c.body(new Uint8Array(file.body), file.status, {
      ...file.headers,
      'Content-Length': String(file.body.byteLength),
    });
  });
  app.all('*', (c) => c.text('Method Not Allowed', 405, { Allow: 'GET, HEAD' }));
  app.onError((_e, c) => c.json({ error: 'internal' }, 500));

  const server = createAdaptorServer({ fetch: app.fetch }) as Server;

  // ---- WebSockets --------------------------------------------------------------------------
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: limits.maxMessageBytes,
    perMessageDeflate: false,
    clientTracking: true,
  });
  const alive = new WeakSet<WebSocket>();
  // Connection accounting (SEC-004). Slots are reserved before the handshake and released when
  // the underlying TCP socket closes, so in-flight handshakes count too. Keys are hashes.
  let openSockets = 0;
  const perClient = new Map<string, number>();

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on('error', () => socket.destroy());
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const match = ROOM_ID.exec(path);
    if (!match?.[1]) return rejectUpgrade(socket, 404);
    if (!allowedOrigin(req.headers.origin)) return rejectUpgrade(socket, 403);
    const key = clientKey(req, config);
    if (openSockets >= config.maxConnections) return rejectUpgrade(socket, 503);
    if ((perClient.get(key) ?? 0) >= config.maxConnectionsPerClient) {
      return rejectUpgrade(socket, 429);
    }
    if (!upgradeLimiter.take(key, Date.now())) return rejectUpgrade(socket, 429);
    openSockets += 1;
    perClient.set(key, (perClient.get(key) ?? 0) + 1);
    socket.once('close', () => {
      openSockets -= 1;
      const n = (perClient.get(key) ?? 1) - 1;
      if (n <= 0) perClient.delete(key);
      else perClient.set(key, n);
    });
    const roomId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      alive.add(ws);
      ws.on('pong', () => alive.add(ws));
      ws.on('error', () => ws.terminate());
      const known = registry.get(roomId);
      // Unknown rooms get a decoy that behaves exactly like a real room refusing a wrong join
      // secret, so a roomId alone does not reveal whether the room exists. Room capacity is
      // enforced by the reducer on hello; pre-hello sockets are bounded per client above.
      const room = known && !known.ended ? known : registry.decoy();
      const id = room.attach(ws);
      ws.on('message', (data, isBinary) => {
        const buf = Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.isBuffer(data)
            ? data
            : Buffer.from(data);
        room.receive(id, isBinary ? new Uint8Array(buf) : buf.toString('utf8'));
      });
      ws.on('close', () => room.detach(id));
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, config.heartbeatSeconds * 1000);
  heartbeat.unref();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const port = (server.address() as AddressInfo).port;

  let closing: Promise<void> | null = null;
  async function close(): Promise<void> {
    closing ??= (async () => {
      clearInterval(heartbeat);
      registry.stopAll();
      for (const ws of wss.clients) ws.close(1001);
      const deadline = Date.now() + 2000;
      while (wss.clients.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      store.close();
    })();
    return closing;
  }

  return {
    port,
    registry,
    store,
    server,
    close,
    get connections() {
      return openSockets;
    },
  };
}
