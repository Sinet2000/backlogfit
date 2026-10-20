/**
 * In-process room actors. Each room serializes its events through a promise queue: hello
 * authentication is awaited first, then the event is reduced against the *current* state.
 * All room behaviour lives in @backlogfit/core; this file only moves bytes, rows and timers.
 */
import {
  type CloseReason,
  type CreateRoomRequest,
  createRoom,
  expandEffects,
  type Outbound,
  parseClientMessage,
  parseCreateRoomRequest,
  presetScale,
  type ReduceResult,
  type RoomEvent,
  type Limits as RoomLimits,
  type RoomState,
  randomSalt,
  randomToken,
  reconcileConnections,
  reduce,
  type ServerMessage,
  toEvent,
} from '@backlogfit/core';
import { createRateLimiter, type RateLimiter } from '@backlogfit/security';
import type { Clock } from './clock.ts';
import type { RoomStore } from './store.ts';

/** Minimal socket surface the room needs (satisfied by `ws` and by test fakes). */
export interface RoomSocket {
  send(data: string): void;
  close(code: number, reason?: string): void;
}

export interface RoomHostOptions {
  store: RoomStore;
  clock: Clock;
  roomLimits: RoomLimits;
  maxRooms: number;
  maxMessageBytes: number;
  rateMsgsPerSec: number;
  rateBurst: number;
  helloTimeoutMs: number;
  /** Invalid or rate-limited frames tolerated per connection before closing with 1008. */
  maxStrikes?: number;
}

/** The per-room bucket (ADR-0007) allows this many times the per-connection rate and burst. */
export const ROOM_RATE_FACTOR = 5;

/** Close code for policy violations (invalid frame flood, hello timeout). */
export const CLOSE_POLICY = 1008;
/** Close code used on server shutdown. */
export const CLOSE_GOING_AWAY = 1001;

const DEFAULT_MAX_STRIKES = 10;

interface Conn {
  socket: RoomSocket;
  strikes: number;
  closed: boolean;
  helloTimer: NodeJS.Timeout | null;
}

function newId(): string {
  return randomToken(12);
}

function reportError(e: unknown): void {
  // Error names/messages from our own code carry no user data; never log request content.
  const what = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
  console.error(`backlogfit: internal error (${what})`);
}

export class Room {
  #state: RoomState;
  readonly #host: RoomRegistry;
  readonly #conns = new Map<string, Conn>();
  #queue: Promise<void> = Promise.resolve();
  #timer: NodeJS.Timeout | null = null;
  #ended = false;
  #stopped = false;
  /** Bounds the total fan-out work of one room across all of its sockets. */
  readonly #roomBucket: RateLimiter<0>;
  /**
   * A decoy for an unknown roomId: same pipeline, never persisted, impossible join hash, so it
   * answers exactly like a real room answers a wrong join secret (PROTOCOL §4, finding R2).
   */
  readonly #ephemeral: boolean;

  constructor(state: RoomState, host: RoomRegistry, ephemeral = false) {
    this.#state = state;
    this.#host = host;
    this.#ephemeral = ephemeral;
    this.#roomBucket = createRateLimiter<0>({
      rate: host.opts.rateMsgsPerSec * ROOM_RATE_FACTOR,
      burst: host.opts.rateBurst * ROOM_RATE_FACTOR,
      maxKeys: 1,
    });
  }

  get id(): string {
    return this.#state.roomId;
  }

  get ended(): boolean {
    return this.#ended;
  }

  get connectionCount(): number {
    return this.#conns.size;
  }

  /** Wait until every queued event has been handled (tests). */
  idle(): Promise<void> {
    return this.#queue;
  }

  /** Raw state, for tests only. Never send this anywhere. */
  get state(): RoomState {
    return this.#state;
  }

  /** Arm the alarm for a freshly created room. */
  armFromEffects(out: readonly Outbound[]): void {
    for (const o of out) if (o.type === 'scheduleAlarm') this.#arm(o.at);
  }

  /**
   * After a restart: let the reducer expire an overdue room, then tell it that every socket
   * it remembers is gone (connections do not survive a restart).
   */
  restore(): Promise<void> {
    return this.#enqueue(() => {
      const prev = this.#state;
      this.#apply(prev, reconcileConnections(prev, [], this.#ctx()));
    });
  }

  attach(socket: RoomSocket): string {
    const id = newId();
    const conn: Conn = { socket, strikes: 0, closed: false, helloTimer: null };
    this.#conns.set(id, conn);
    conn.helloTimer = setTimeout(() => {
      conn.helloTimer = null;
      if (conn.closed || this.#ended) return;
      if (!this.#state.participants.some((p) => p.conn === id)) this.#closeConn(conn, CLOSE_POLICY);
    }, this.#host.opts.helloTimeoutMs);
    conn.helloTimer.unref();
    this.#enqueue(() => this.#dispatch({ type: 'connect', conn: id }));
    return id;
  }

  receive(id: string, raw: string | Uint8Array): void {
    const conn = this.#conns.get(id);
    if (!conn || conn.closed || this.#ended || this.#stopped) return;
    const { opts, limiter } = this.#host;
    const now = Date.now();
    if (!limiter.take(id, now)) {
      this.#strike(conn, 'rate_limited');
      return;
    }
    if (!this.#roomBucket.take(0, now)) {
      // The room as a whole is saturated; not this socket's fault, so no strike.
      this.#sendTo(conn, { type: 'error', code: 'rate_limited' });
      return;
    }
    const parsed = parseClientMessage(raw, opts.maxMessageBytes);
    if (!parsed.ok) {
      this.#strike(conn, parsed.code);
      return;
    }
    const msg = parsed.msg;
    this.#enqueue(async () => {
      if (conn.closed || this.#ended) return;
      const event = await toEvent(this.#state, id, msg);
      if (conn.closed || this.#ended) return;
      this.#dispatch(event);
    });
  }

  detach(id: string): void {
    const conn = this.#conns.get(id);
    if (!conn) return;
    this.#conns.delete(id);
    conn.closed = true;
    if (conn.helloTimer) clearTimeout(conn.helloTimer);
    this.#host.limiter.delete(id);
    if (this.#ended || this.#stopped) return;
    this.#enqueue(() => this.#dispatch({ type: 'disconnect', conn: id }));
  }

  /** Server shutdown: state is already persisted after every change; just close sockets. */
  stop(): void {
    this.#stopped = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    for (const conn of this.#conns.values()) this.#closeConn(conn, CLOSE_GOING_AWAY);
  }

  #strike(conn: Conn, code: Extract<ServerMessage, { type: 'error' }>['code']): void {
    conn.strikes += 1;
    if (conn.strikes >= (this.#host.opts.maxStrikes ?? DEFAULT_MAX_STRIKES)) {
      this.#closeConn(conn, CLOSE_POLICY);
      return;
    }
    this.#sendTo(conn, { type: 'error', code });
  }

  #enqueue(job: () => void | Promise<void>): Promise<void> {
    const run = this.#queue.then(() => (this.#stopped ? undefined : job()));
    this.#queue = run.catch(reportError);
    return this.#queue;
  }

  #ctx() {
    return { now: this.#host.opts.clock.now(), randomId: newId };
  }

  #dispatch(event: RoomEvent): void {
    if (this.#ended) return;
    const prev = this.#state;
    this.#apply(prev, reduce(prev, event, this.#ctx()));
  }

  #apply(prev: RoomState, { state, effects }: ReduceResult): void {
    const out = expandEffects(state, effects);
    this.#state = state;
    const end = out.find((o) => o.type === 'deleteAll');
    if (!end && state !== prev && !this.#ephemeral) this.#host.opts.store.put(state);
    for (const o of out) {
      switch (o.type) {
        case 'send': {
          const conn = this.#conns.get(o.to);
          if (conn) this.#sendTo(conn, o.msg);
          break;
        }
        case 'close': {
          const conn = this.#conns.get(o.to);
          if (conn) this.#closeConn(conn, o.code);
          break;
        }
        case 'scheduleAlarm':
          if (!end) this.#arm(o.at);
          break;
        case 'deleteAll':
          break;
      }
    }
    if (end) this.#end(end.reason, end.code);
  }

  #end(reason: CloseReason, code: number): void {
    this.#ended = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (!this.#ephemeral) this.#host.opts.store.delete(this.id);
    for (const conn of this.#conns.values()) {
      if (conn.closed) continue;
      this.#sendTo(conn, { type: 'closed', reason });
      this.#closeConn(conn, code);
    }
    this.#host.forget(this);
  }

  #arm(at: number | null): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (at === null || this.#ended || this.#stopped || this.#ephemeral) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#enqueue(() => this.#dispatch({ type: 'tick' }));
    }, this.#host.opts.clock.delayUntil(at));
    this.#timer.unref();
  }

  #sendTo(conn: Conn, msg: ServerMessage): void {
    if (conn.closed) return;
    try {
      conn.socket.send(JSON.stringify(msg));
    } catch {
      this.#closeConn(conn, CLOSE_GOING_AWAY);
    }
  }

  #closeConn(conn: Conn, code: number): void {
    if (conn.closed) return;
    conn.closed = true;
    if (conn.helloTimer) clearTimeout(conn.helloTimer);
    conn.helloTimer = null;
    try {
      conn.socket.close(code);
    } catch {
      // socket already gone
    }
  }
}

export type CreateResult =
  | { ok: true; roomId: string; expiresAt: number }
  | { ok: false; code: 'room_limit' };

export class RoomRegistry {
  readonly opts: RoomHostOptions;
  readonly limiter: RateLimiter<string>;
  readonly #rooms = new Map<string, Room>();

  constructor(opts: RoomHostOptions) {
    this.opts = opts;
    this.limiter = createRateLimiter<string>({
      rate: opts.rateMsgsPerSec,
      burst: opts.rateBurst,
      maxKeys: 1_000_000,
    });
  }

  get size(): number {
    return this.#rooms.size;
  }

  get(roomId: string): Room | undefined {
    return this.#rooms.get(roomId);
  }

  create(req: CreateRoomRequest): CreateResult {
    if (this.#rooms.size >= this.opts.maxRooms) return { ok: false, code: 'room_limit' };
    let roomId = randomToken(16);
    while (this.#rooms.has(roomId)) roomId = randomToken(16);
    const { state, effects } = createRoom(
      req,
      roomId,
      { now: this.opts.clock.now(), randomId: newId },
      this.opts.roomLimits,
    );
    this.opts.store.put(state);
    const room = new Room(state, this);
    this.#rooms.set(roomId, room);
    room.armFromEffects(expandEffects(state, effects));
    return { ok: true, roomId, expiresAt: state.expiresAt };
  }

  /** A throwaway room standing in for an unknown roomId (see Room#ephemeral). */
  decoy(roomId: string): Room {
    const parsed = parseCreateRoomRequest({
      v: 1,
      config: { scale: presetScale('fibonacci') },
      joinHash: randomSalt() + randomSalt(),
      adminHash: randomSalt() + randomSalt(),
      lifetimeHours: 1,
    });
    if (!parsed.ok) throw new Error('decoy room request rejected');
    const { state } = createRoom(
      parsed.msg,
      roomId,
      { now: this.opts.clock.now(), randomId: newId },
      this.opts.roomLimits,
    );
    return new Room(state, this, true);
  }

  /** Reload persisted rooms; overdue ones expire (and are deleted) immediately. */
  async restore(): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const state of this.opts.store.loadAll()) {
      const room = new Room(state, this);
      this.#rooms.set(state.roomId, room);
      jobs.push(room.restore());
    }
    await Promise.all(jobs);
  }

  /** Called by a room once it has ended and wiped its storage. */
  forget(room: Room): void {
    if (!this.#rooms.has(room.id)) return;
    if (this.#rooms.get(room.id) === room) this.#rooms.delete(room.id);
  }

  stopAll(): void {
    for (const room of this.#rooms.values()) room.stop();
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#rooms.values()].map((r) => r.idle()));
  }
}
