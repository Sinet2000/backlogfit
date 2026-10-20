/**
 * One Durable Object per room. Thin adapter: WebSocket Hibernation transport, SQLite storage of
 * the reducer state, a single storage alarm. All room behaviour lives in @backlogfit/core.
 */

import { DurableObject } from 'cloudflare:workers';
import {
  type CreateRoomRequest,
  createRoom,
  type Effect,
  expandEffects,
  parseClientMessage,
  parseCreateRoomRequest,
  presetScale,
  type ReduceResult,
  type RoomEvent,
  type RoomState,
  randomSalt,
  randomToken,
  reconcileConnections,
  reduce,
  type ServerMessage,
  toCoreLimits,
  toEvent,
} from '@backlogfit/core';
import {
  createRateLimiter,
  createStrikeCounter,
  frameTooLarge,
  WS_CLOSE_MESSAGE_TOO_BIG,
  WS_CLOSE_POLICY_VIOLATION,
} from '@backlogfit/security';
import { configOf, type Env, type WorkerConfig } from './env.ts';

/** Persisted RoomState.v this build reads; other versions are wiped on load. */
export const STATE_VERSION = 1;
export const CLOSE_POLICY = WS_CLOSE_POLICY_VIOLATION;
export const CLOSE_TOO_BIG = WS_CLOSE_MESSAGE_TOO_BIG;
/** Invalid or rate-limited frames tolerated per connection before closing with 1008. */
export const MAX_STRIKES = 10;
/** The per-room bucket allows this many times the per-connection rate and burst (ADR-0007). */
export const ROOM_RATE_FACTOR = 5;

/** Survives hibernation via serializeAttachment. */
export interface Attachment {
  conn: string;
  helloBy: number;
}

const CREATE_TABLE =
  'CREATE TABLE IF NOT EXISTS room (k INTEGER PRIMARY KEY CHECK (k = 1), state TEXT NOT NULL)';

function newId(): string {
  return randomToken(12);
}

export class RoomDO extends DurableObject<Env> {
  readonly #config: WorkerConfig;
  /** Stored state; null when this object holds no room (unknown or ended). */
  #state: RoomState | null = null;
  /**
   * In-memory stand-in for an unknown room: never persisted, impossible join hash, so it answers
   * exactly like a real room answers a wrong join secret.
   */
  #decoy: RoomState | null = null;
  #queue: Promise<void> = Promise.resolve();
  #armedAt: number | null = null;
  /** The room table exists. Created lazily by #save, so unknown ids never write storage. */
  #tableReady = false;
  readonly #strikes = createStrikeCounter<string>({ max: MAX_STRIKES, windowMs: 60_000 });
  readonly #connLimiter;
  readonly #roomLimiter;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.#config = configOf(env);
    const { rateMsgsPerSec, rateBurst } = this.#config.limits;
    this.#connLimiter = createRateLimiter<string>({ rate: rateMsgsPerSec, burst: rateBurst });
    this.#roomLimiter = createRateLimiter<0>({
      rate: rateMsgsPerSec * ROOM_RATE_FACTOR,
      burst: rateBurst * ROOM_RATE_FACTOR,
      maxKeys: 1,
    });
    ctx.blockConcurrencyWhile(async () => {
      // Read-only probe: a schema write would persist storage for every probed roomId (SEC-010).
      this.#tableReady =
        this.ctx.storage.sql
          .exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'room'")
          .toArray().length > 0;
      this.#state = this.#tableReady ? this.#load() : null;
      this.#armedAt = await this.ctx.storage.getAlarm();
      // Woken from hibernation or restarted: drop participants whose socket is gone.
      if (this.#state) {
        const live = this.ctx.getWebSockets().map((ws) => this.#attachment(ws)?.conn ?? '');
        await this.#apply(reconcileConnections(this.#state, live, this.#ctx()));
      }
      this.#sweepHellos();
    });
  }

  // ---- RPC from the router -----------------------------------------------------------------

  /** Initialise this object as room `roomId`. Returns null if it already holds a room. */
  async create(req: CreateRoomRequest, roomId: string): Promise<{ expiresAt: number } | null> {
    // Re-validate: RPC input crosses an isolate boundary.
    const parsed = parseCreateRoomRequest(req);
    if (!parsed.ok) throw new Error('invalid create request');
    return this.#enqueue(async () => {
      if (this.#state) return null;
      const { state, effects } = createRoom(
        parsed.msg,
        roomId,
        this.#ctx(),
        toCoreLimits(this.#config.limits),
      );
      this.#state = state;
      this.#save(state);
      await this.#effects(state, effects);
      return { expiresAt: state.expiresAt };
    });
  }

  // ---- WebSocket transport -----------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    const roomId = new URL(request.url).pathname.split('/').pop() ?? '';
    // Only sockets that have not completed a hello are bounded here; joined ones are bounded by
    // the reducer (room capacity). When the pre-hello pool is full the *oldest* pre-hello socket
    // is dropped instead of refusing the newcomer, so squatters cannot lock participants out.
    // Real and unknown ids share this code path, so it reveals nothing about existence.
    this.#evictPreHello(this.#config.limits.maxParticipants * 2 + 20 - 1);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const conn = newId();
    this.ctx.acceptWebSocket(server, [conn]);
    const attachment: Attachment = { conn, helloBy: Date.now() + this.#config.helloTimeoutMs };
    server.serializeAttachment(attachment);
    if (!this.#state) this.#refreshDecoy(roomId);
    await this.#enqueue(() => this.#dispatch({ type: 'connect', conn }));
    // Best effort while awake; #sweepHellos also runs on every wake-up and message.
    setTimeout(() => this.#sweepHellos(), this.#config.helloTimeoutMs + 50);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const conn = this.#attachment(ws)?.conn;
    if (!conn || ws.readyState !== WebSocket.OPEN) return;
    this.#sweepHellos();
    const { maxMessageBytes } = this.#config.limits;
    if (frameTooLarge(raw, maxMessageBytes)) {
      ws.close(CLOSE_TOO_BIG, 'message too big');
      return;
    }
    const now = Date.now();
    if (!this.#connLimiter.take(conn, now)) return this.#strike(ws, conn, 'rate_limited');
    if (!this.#roomLimiter.take(0, now)) {
      this.#sendTo(ws, { type: 'error', code: 'rate_limited' });
      return;
    }
    const parsed = parseClientMessage(raw, maxMessageBytes);
    if (!parsed.ok) return this.#strike(ws, conn, parsed.code);
    const msg = parsed.msg;
    await this.#enqueue(async () => {
      const state = this.#current();
      if (!state) return;
      const event = await toEvent(state, conn, msg);
      if (ws.readyState !== WebSocket.OPEN) return;
      await this.#dispatch(event);
    });
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.#gone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.#gone(ws);
  }

  override async alarm(): Promise<void> {
    this.#armedAt = null;
    await this.#enqueue(async () => {
      if (this.#state) await this.#dispatch({ type: 'tick' });
      await this.#syncAlarm();
    });
  }

  // ---- internals ---------------------------------------------------------------------------

  async #gone(ws: WebSocket): Promise<void> {
    const conn = this.#attachment(ws)?.conn;
    try {
      ws.close(1000);
    } catch {
      // already closed
    }
    if (!conn) return;
    this.#strikes.delete(conn);
    this.#connLimiter.delete(conn);
    await this.#enqueue(() => this.#dispatch({ type: 'disconnect', conn }));
  }

  #attachment(ws: WebSocket): Attachment | null {
    const a = ws.deserializeAttachment() as Attachment | null;
    return a && typeof a.conn === 'string' ? a : null;
  }

  #socket(conn: string): WebSocket | undefined {
    return this.ctx.getWebSockets(conn)[0];
  }

  #current(): RoomState | null {
    return this.#state ?? this.#decoy;
  }

  /** A fresh decoy well before its idle deadline, so it never answers `closed{idle}`. */
  #refreshDecoy(roomId: string): void {
    const maxAge = toCoreLimits(this.#config.limits).idleTimeoutMs / 4;
    const d = this.#decoy;
    if (d && d.closed === null && Date.now() - d.createdAt < maxAge) return;
    this.#decoy = this.#makeDecoy(roomId);
  }

  /** Close the oldest pre-hello sockets until at most `keep` remain. */
  #evictPreHello(keep: number): void {
    const state = this.#current();
    const joined = new Set(state?.participants.map((p) => p.conn) ?? []);
    const waiting: { ws: WebSocket; helloBy: number }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.#attachment(ws);
      if (a && !joined.has(a.conn) && ws.readyState === WebSocket.OPEN) {
        waiting.push({ ws, helloBy: a.helloBy });
      }
    }
    if (waiting.length <= keep) return;
    waiting.sort((x, y) => x.helloBy - y.helloBy);
    for (const w of waiting.slice(0, waiting.length - keep)) w.ws.close(CLOSE_POLICY, 'policy');
  }

  #ctx() {
    return { now: Date.now(), randomId: newId };
  }

  #load(): RoomState | null {
    const row = this.ctx.storage.sql.exec<{ state: string }>('SELECT state FROM room').toArray()[0];
    if (!row) return null;
    try {
      const state = JSON.parse(row.state) as RoomState;
      if (state.v === STATE_VERSION && typeof state.expiresAt === 'number') return state;
    } catch {
      // unreadable: fall through and wipe
    }
    this.ctx.storage.sql.exec('DELETE FROM room');
    return null;
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

  #makeDecoy(roomId: string): RoomState {
    const parsed = parseCreateRoomRequest({
      v: 1,
      config: { scale: presetScale('fibonacci') },
      joinHash: randomSalt() + randomSalt(),
      adminHash: randomSalt() + randomSalt(),
      lifetimeHours: 1,
    });
    if (!parsed.ok) throw new Error('decoy room request rejected');
    return createRoom(parsed.msg, roomId, this.#ctx(), toCoreLimits(this.#config.limits)).state;
  }

  #enqueue<T>(job: () => T | Promise<T>): Promise<T> {
    const run = this.#queue.then(job);
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async #dispatch(event: RoomEvent): Promise<void> {
    const state = this.#current();
    if (!state) return;
    await this.#apply(reduce(state, event, this.#ctx()));
  }

  async #apply({ state, effects }: ReduceResult): Promise<void> {
    const decoy = this.#state === null;
    const prev = decoy ? this.#decoy : this.#state;
    const ending = effects.some((e) => e.type === 'deleteAll');
    if (decoy) this.#decoy = state;
    else {
      this.#state = state;
      if (!ending && state !== prev) this.#save(state);
    }
    await this.#effects(state, effects, decoy);
  }

  async #effects(state: RoomState, effects: readonly Effect[], decoy = false): Promise<void> {
    for (const o of expandEffects(state, effects)) {
      switch (o.type) {
        case 'send': {
          const ws = this.#socket(o.to);
          if (ws) this.#sendTo(ws, o.msg);
          break;
        }
        case 'close':
          this.#socket(o.to)?.close(o.code, o.reason);
          break;
        case 'scheduleAlarm':
          break; // derived from state.alarmAt in #syncAlarm
        case 'deleteAll':
          if (decoy) {
            this.#decoy = null;
            break;
          }
          this.#state = null;
          this.#armedAt = null;
          this.#tableReady = false;
          await this.ctx.storage.deleteAlarm();
          await this.ctx.storage.deleteAll();
          for (const ws of this.ctx.getWebSockets()) {
            if (ws.readyState !== WebSocket.OPEN) continue;
            this.#sendTo(ws, { type: 'closed', reason: o.reason });
            ws.close(o.code, o.reason);
          }
          return;
      }
    }
    if (!decoy) await this.#syncAlarm();
  }

  async #syncAlarm(): Promise<void> {
    const at = this.#state?.alarmAt ?? null;
    if (at === this.#armedAt) return;
    this.#armedAt = at;
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }

  #sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket went away; webSocketClose will follow
    }
  }

  #strike(ws: WebSocket, conn: string, code: Extract<ServerMessage, { type: 'error' }>['code']) {
    if (this.#strikes.strike(conn, Date.now())) {
      ws.close(CLOSE_POLICY, 'policy');
      return;
    }
    this.#sendTo(ws, { type: 'error', code });
  }

  /** Close sockets that never completed a hello within the timeout. */
  #sweepHellos(): void {
    const now = Date.now();
    const state = this.#current();
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.#attachment(ws);
      if (!a || a.helloBy > now || ws.readyState !== WebSocket.OPEN) continue;
      if (state?.participants.some((p) => p.conn === a.conn)) continue;
      ws.close(CLOSE_POLICY, 'hello timeout');
    }
  }
}
