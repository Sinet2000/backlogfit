import { DurableObject } from 'cloudflare:workers';
import {
  type CreateRoomRequest,
  parseCreateRoomRequest,
  type RoomState,
  randomToken,
} from '@backlogfit/core';
import {
  type ConnInfo,
  type HostOptions,
  type HostPorts,
  type HostSocket,
  hostOptions,
  RoomHost,
  readStoredState,
  systemClock,
  type Wakeup,
} from '@backlogfit/host';
import { configOf, type Env } from './env.ts';

const CREATE_TABLE =
  'CREATE TABLE IF NOT EXISTS room (k INTEGER PRIMARY KEY CHECK (k = 1), state TEXT NOT NULL)';
const DECOY_ID = 'decoy';

function attachmentOf(ws: WebSocket): ConnInfo | null {
  const a = ws.deserializeAttachment() as Partial<ConnInfo> | null;
  if (!a || typeof a.conn !== 'string' || typeof a.helloBy !== 'number') return null;
  return { conn: a.conn, helloBy: a.helloBy, lastSeen: a.lastSeen ?? Date.now() };
}

function reportError(e: unknown): void {
  // Only our own error names and messages are logged, never request content.
  const what = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
  console.error(`backlogfit: internal error (${what})`);
}

/**
 * One Durable Object per roomId, a thin adapter over RoomHost: WebSocket Hibernation sockets,
 * one SQLite row and the storage alarm for a real room. Unknown and ended ids get a decoy host
 * that writes no storage at all (SEC-010), with an in-memory timer instead of the alarm.
 */
export class RoomDO extends DurableObject<Env> {
  readonly #options: HostOptions;
  #host: RoomHost | null = null;
  #tableReady = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#options = hostOptions(configOf(env).limits);
    ctx.blockConcurrencyWhile(async () => {
      // A read-only probe: creating the table here would store something for every probed id.
      this.#tableReady =
        ctx.storage.sql
          .exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'room'")
          .toArray().length > 0;
      const state = this.#tableReady ? await this.#load() : null;
      if (state) await this.#bind(state, await ctx.storage.getAlarm());
      else if (ctx.getWebSockets().length > 0) await this.#bind(null, null);
    });
  }

  /** RPC from the router: become room `roomId`. Returns null if this object already is a room. */
  async create(req: CreateRoomRequest, roomId: string): Promise<{ expiresAt: number } | null> {
    const parsed = parseCreateRoomRequest(req);
    if (!parsed.ok) throw new Error('invalid create request');
    if (this.#host && !this.#host.isDecoy && !this.#host.ended) return null;
    await this.#host?.stop();
    const host = await RoomHost.create(parsed.msg, roomId, this.#ports(true), this.#options);
    this.#host = host;
    return { expiresAt: host.state.expiresAt };
  }

  /** WebSocket upgrade, already checked by the router (origin, room id, upgrade budget). */
  override async fetch(): Promise<Response> {
    if (!this.#host || this.#host.ended) await this.#bind(null, null);
    const host = this.#host as RoomHost;
    const pair = new WebSocketPair();
    const conn = randomToken(12);
    this.ctx.acceptWebSocket(pair[1], [conn]);
    host.open(this.#peer(pair[1]), conn);
    await host.idle();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const conn = attachmentOf(ws)?.conn;
    if (conn) await this.#host?.receive(conn, raw);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.#gone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.#gone(ws);
  }

  override async alarm(): Promise<void> {
    await this.#host?.wake();
  }

  async #gone(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000);
    } catch {
      /* already closed */
    }
    const conn = attachmentOf(ws)?.conn;
    if (conn) await this.#host?.disconnected(conn);
  }

  /**
   * Hibernation restore: builds the host for the stored room (or a decoy) and adopts every
   * socket that is still open, using the connection info kept in its attachment.
   */
  async #bind(state: RoomState | null, armedAt: number | null): Promise<void> {
    const host = state
      ? new RoomHost(state, this.#ports(true), this.#options)
      : RoomHost.decoy(DECOY_ID, this.#ports(false), this.#options);
    for (const ws of this.ctx.getWebSockets()) {
      const info = attachmentOf(ws);
      if (info && ws.readyState === WebSocket.OPEN) host.adopt(this.#peer(ws), info);
    }
    this.#host = host;
    await host.restore(armedAt);
  }

  #peer(ws: WebSocket): HostSocket {
    return {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      close: (code, reason) => ws.close(code, reason),
      remember: (info) => ws.serializeAttachment(info),
    };
  }

  #ports(real: boolean): HostPorts {
    const base = {
      clock: systemClock(),
      randomId: () => randomToken(12),
      onError: reportError,
    };
    if (!real) return { ...base, wakeup: this.#memoryWakeup() };
    const { storage } = this.ctx;
    return {
      ...base,
      wakeup: {
        set: (at) => (at === null ? storage.deleteAlarm() : storage.setAlarm(at)),
      },
      storage: {
        save: (s) => this.#save(s),
        wipe: async () => {
          this.#tableReady = false;
          await storage.deleteAlarm();
          await storage.deleteAll();
        },
      },
      onEnd: () => {
        this.#host = null;
      },
    };
  }

  #memoryWakeup(): Wakeup {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
      set: (at) => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (at === null) return;
        timer = setTimeout(() => void this.#host?.wake(), Math.max(0, at - Date.now()));
      },
    };
  }

  async #load(): Promise<RoomState | null> {
    const row = this.ctx.storage.sql.exec<{ state: string }>('SELECT state FROM room').toArray()[0];
    const state = row ? readStoredState(row.state) : null;
    if (!state) {
      this.#tableReady = false;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    }
    return state;
  }

  #save(state: RoomState): void {
    if (!this.#tableReady) {
      this.ctx.storage.sql.exec(CREATE_TABLE);
      this.#tableReady = true;
    }
    this.ctx.storage.sql.exec(
      'INSERT INTO room (k, state) VALUES (1, ?) ON CONFLICT(k) DO UPDATE SET state = excluded.state',
      JSON.stringify(state),
    );
  }
}
