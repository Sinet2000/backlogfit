import {
  type CloseReason,
  type CreateRoomRequest,
  createRoom,
  type ErrorCode,
  expandEffects,
  idleAt,
  parseClientMessage,
  parseCreateRoomRequest,
  presetScale,
  type ReduceResult,
  type RoomEvent,
  type RoomState,
  randomSalt,
  reconcileConnections,
  reduce,
  type ServerMessage,
  toEvent,
} from '@backlogfit/core';
import {
  createRateLimiter,
  createStrikeCounter,
  frameTooLarge,
  WS_CLOSE_GOING_AWAY,
  WS_CLOSE_MESSAGE_TOO_BIG,
  WS_CLOSE_POLICY_VIOLATION,
} from '@backlogfit/security';
import { type HostOptions, ROOM_RATE_FACTOR, STRIKE_WINDOW_MS } from './options.ts';
import type { HostPorts, HostSocket } from './ports.ts';

export type Frame = string | Uint8Array | ArrayBuffer;

/** What an adapter must remember about a socket to adopt it again after a restart. */
export interface ConnInfo {
  conn: string;
  helloBy: number;
  lastSeen: number;
}

interface Conn {
  socket: HostSocket;
  helloBy: number;
  lastSeen: number;
  remembered: number;
  closed: boolean;
}

const CLOSE_TEXT: Record<number, string> = {
  [WS_CLOSE_GOING_AWAY]: 'going away',
  [WS_CLOSE_POLICY_VIOLATION]: 'policy',
  [WS_CLOSE_MESSAGE_TOO_BIG]: 'too big',
};

function decoyState(roomId: string, now: number, options: HostOptions): RoomState {
  const parsed = parseCreateRoomRequest({
    v: 1,
    config: { scale: presetScale('fibonacci') },
    joinHash: randomSalt() + randomSalt(),
    adminHash: randomSalt() + randomSalt(),
    lifetimeHours: 1,
  });
  if (!parsed.ok) throw new Error('decoy room request rejected');
  return createRoom(parsed.msg, roomId, { now, randomId: () => '' }, options.roomLimits).state;
}

/**
 * Runs one room for any transport: frame checks, rate limits and strikes, the serial event
 * queue, hello authentication, reduce against the current state, effect expansion, storage,
 * hello and dead-socket deadlines, and the room alarm. See docs/adr/0011-shared-room-host.md.
 *
 * A decoy host stands in for an unknown or ended roomId. It runs the same pipeline with an
 * impossible join hash and no storage, so it answers exactly like a real room answers a wrong
 * join secret, and nothing about the probe is ever written.
 */
export class RoomHost {
  readonly #ports: HostPorts;
  readonly #options: HostOptions;
  readonly #decoy: boolean;
  readonly #conns = new Map<string, Conn>();
  readonly #connBucket;
  readonly #roomBucket;
  readonly #strikes;
  #state: RoomState;
  #queue: Promise<void> = Promise.resolve();
  #armedAt: number | null = null;
  #ended = false;
  #stopped = false;

  constructor(state: RoomState, ports: HostPorts, options: HostOptions, decoy = false) {
    this.#state = state;
    this.#ports = ports;
    this.#options = options;
    this.#decoy = decoy || ports.storage === undefined;
    this.#connBucket = createRateLimiter<string>({
      rate: options.rateMsgsPerSec,
      burst: options.rateBurst,
    });
    this.#roomBucket = createRateLimiter<0>({
      rate: options.rateMsgsPerSec * ROOM_RATE_FACTOR,
      burst: options.rateBurst * ROOM_RATE_FACTOR,
      maxKeys: 1,
    });
    this.#strikes = createStrikeCounter<string>({
      max: options.maxStrikes,
      windowMs: STRIKE_WINDOW_MS,
    });
  }

  /** Create and persist a new room from a validated request. */
  static async create(
    req: CreateRoomRequest,
    roomId: string,
    ports: HostPorts,
    options: HostOptions,
  ): Promise<RoomHost> {
    if (!ports.storage) throw new Error('a real room needs storage');
    const ctx = { now: ports.clock.roomNow(), randomId: ports.randomId };
    const { state } = createRoom(req, roomId, ctx, options.roomLimits);
    await ports.storage.save(state);
    const host = new RoomHost(state, ports, options);
    await host.#schedule();
    return host;
  }

  /** A host for an unknown or ended roomId. Pass ports without storage. */
  static decoy(roomId: string, ports: HostPorts, options: HostOptions): RoomHost {
    const state = decoyState(roomId, ports.clock.roomNow(), options);
    return new RoomHost(state, ports, options, true);
  }

  get roomId(): string {
    return this.#state.roomId;
  }

  get isDecoy(): boolean {
    return this.#decoy;
  }

  get ended(): boolean {
    return this.#ended;
  }

  get connectionCount(): number {
    return this.#conns.size;
  }

  /** Raw state for tests. Never send it anywhere: only project() output leaves a server. */
  get state(): RoomState {
    return this.#state;
  }

  /** Resolves once every queued event has been handled. */
  idle(): Promise<void> {
    return this.#queue;
  }

  /**
   * A new socket was accepted. Closes the oldest pending socket when too many have not said
   * hello yet, so squatters cannot keep participants out, then queues a `connect` event.
   */
  open(socket: HostSocket, conn: string = this.#ports.randomId()): ConnInfo {
    this.#evictPending(this.#options.maxPending - 1);
    const now = this.#ports.clock.now();
    const info = { conn, helloBy: now + this.#options.helloTimeoutMs, lastSeen: now };
    this.#conns.set(conn, { socket, ...info, remembered: now, closed: false });
    socket.remember?.(info);
    this.#enqueue(() => this.#dispatch({ type: 'connect', conn }));
    this.#enqueue(() => this.#schedule());
    return info;
  }

  /** A socket that survived hibernation or a restart. Call `restore()` once all are adopted. */
  adopt(socket: HostSocket, info: ConnInfo): void {
    const { conn, helloBy, lastSeen } = info;
    this.#conns.set(conn, { socket, helloBy, lastSeen, remembered: lastSeen, closed: false });
  }

  /**
   * After loading stored state: participants whose socket was not adopted are disconnected, an
   * overdue room expires, overdue sockets are closed and the wake-up is armed again.
   * `armedAt` is the wake-up the platform still holds, if any.
   */
  restore(armedAt: number | null = null): Promise<void> {
    return this.#enqueue(async () => {
      this.#armedAt = armedAt;
      if (!this.#decoy) {
        const live = [...this.#conns.keys()];
        await this.#apply(reconcileConnections(this.#state, live, this.#ctx()));
      }
      if (this.#ended) return;
      this.#sweep();
      await this.#schedule();
    });
  }

  /** One inbound frame. Every frame, even a rejected one, proves the socket is alive. */
  receive(conn: string, raw: Frame): Promise<void> {
    const c = this.#conns.get(conn);
    if (!c || c.closed || this.#ended || this.#stopped) return this.#queue;
    const now = this.#ports.clock.now();
    c.lastSeen = now;
    if (now - c.remembered >= this.#options.socketTimeoutMs / 3) {
      c.remembered = now;
      c.socket.remember?.({ conn, helloBy: c.helloBy, lastSeen: now });
    }
    this.#sweep();
    if (c.closed) return this.#queue;
    if (frameTooLarge(raw, this.#options.maxMessageBytes)) {
      this.#close(conn, WS_CLOSE_MESSAGE_TOO_BIG);
      return this.#queue;
    }
    if (!this.#connBucket.take(conn, now)) return this.#strike(conn, 'rate_limited');
    if (!this.#roomBucket.take(0, now)) {
      this.#send(conn, { type: 'error', code: 'rate_limited' });
      return this.#queue;
    }
    const parsed = parseClientMessage(raw, this.#options.maxMessageBytes);
    if (!parsed.ok) return this.#strike(conn, parsed.code);
    const msg = parsed.msg;
    return this.#enqueue(async () => {
      if (c.closed || this.#ended) return;
      const event = await toEvent(this.#state, conn, msg);
      if (c.closed || this.#ended) return;
      await this.#dispatch(event);
    });
  }

  /** The transport reports that a socket is gone. */
  disconnected(conn: string): Promise<void> {
    const c = this.#conns.get(conn);
    if (!c) return this.#queue;
    c.closed = true;
    this.#forget(conn);
    if (this.#ended || this.#stopped) return this.#queue;
    return this.#enqueue(() => this.#dispatch({ type: 'disconnect', conn }));
  }

  /** The wake-up fired: close overdue sockets and run a due room alarm. */
  wake(): Promise<void> {
    this.#armedAt = null;
    return this.#enqueue(async () => {
      if (this.#ended) return;
      this.#sweep();
      const at = this.#state.alarmAt;
      if (!this.#decoy && at !== null && this.#ports.clock.roomNow() >= at) {
        await this.#dispatch({ type: 'tick' });
      }
      await this.#schedule();
    });
  }

  /** Process shutdown: stored state is already current, so only close the sockets. */
  async stop(): Promise<void> {
    this.#stopped = true;
    for (const conn of [...this.#conns.keys()]) this.#close(conn, WS_CLOSE_GOING_AWAY);
    await this.#ports.wakeup.set(null);
  }

  #ctx() {
    return { now: this.#ports.clock.roomNow(), randomId: this.#ports.randomId };
  }

  #enqueue(job: () => void | Promise<void>): Promise<void> {
    const run = this.#queue.then(() => (this.#stopped ? undefined : job()));
    this.#queue = run.catch((e: unknown) => this.#ports.onError?.(e));
    return this.#queue;
  }

  async #dispatch(event: RoomEvent): Promise<void> {
    if (this.#ended) return;
    if (this.#decoy) this.#renewDecoy();
    await this.#apply(reduce(this.#state, event, this.#ctx()));
  }

  /** Replaces the decoy state well before its idle or hard deadline, so it never answers either. */
  #renewDecoy(): void {
    const s = this.#state;
    const life = Math.min(idleAt(s), s.expiresAt) - s.createdAt;
    if (this.#ports.clock.roomNow() - s.createdAt < life / 4) return;
    this.#state = decoyState(s.roomId, this.#ports.clock.roomNow(), this.#options);
  }

  /** Effect expansion: storage first, then sockets; `deleteAll` wipes and closes everything. */
  async #apply({ state, effects }: ReduceResult): Promise<void> {
    const prev = this.#state;
    this.#state = state;
    const out = expandEffects(state, effects);
    const end = out.find((o) => o.type === 'deleteAll');
    if (!end && state !== prev && !this.#decoy) await this.#ports.storage?.save(state);
    for (const o of out) {
      if (o.type === 'send') this.#send(o.to, o.msg);
      else if (o.type === 'close') this.#close(o.to, o.code, o.reason);
    }
    if (end?.type === 'deleteAll') await this.#end(end.reason, end.code);
    else await this.#schedule();
  }

  /** Privacy invariant: an ended room leaves no storage and no open socket behind. */
  async #end(reason: CloseReason, code: number): Promise<void> {
    this.#armedAt = null;
    if (this.#decoy) {
      this.#state = decoyState(this.#state.roomId, this.#ports.clock.roomNow(), this.#options);
    } else {
      this.#ended = true;
      await this.#ports.wakeup.set(null);
      await this.#ports.storage?.wipe();
    }
    for (const conn of [...this.#conns.keys()]) {
      this.#send(conn, { type: 'closed', reason });
      this.#close(conn, code, reason);
    }
    if (!this.#decoy) this.#ports.onEnd?.();
  }

  /** Arms the earliest of the room alarm and every socket deadline. Later ones wait. */
  async #schedule(): Promise<void> {
    if (this.#ended || this.#stopped) return;
    let next = Number.POSITIVE_INFINITY;
    const at = this.#state.alarmAt;
    if (!this.#decoy && at !== null) next = this.#ports.clock.wallAt(at);
    const joined = this.#joined();
    for (const [conn, c] of this.#conns) {
      if (c.closed) continue;
      const due = joined.has(conn) ? c.lastSeen + this.#options.socketTimeoutMs : c.helloBy;
      if (due < next) next = due;
    }
    if (next === Number.POSITIVE_INFINITY) return;
    if (this.#armedAt !== null && this.#armedAt <= next) return;
    this.#armedAt = next;
    await this.#ports.wakeup.set(next);
  }

  /** Hello timeout and dead-socket cleanup. */
  #sweep(): void {
    const now = this.#ports.clock.now();
    const joined = this.#joined();
    for (const [conn, c] of this.#conns) {
      if (c.closed) continue;
      if (joined.has(conn)) {
        if (c.lastSeen + this.#options.socketTimeoutMs <= now)
          this.#close(conn, WS_CLOSE_GOING_AWAY);
      } else if (c.helloBy <= now) {
        this.#close(conn, WS_CLOSE_POLICY_VIOLATION);
      }
    }
  }

  #joined(): Set<string> {
    const out = new Set<string>();
    for (const p of this.#state.participants) if (p.conn !== null) out.add(p.conn);
    return out;
  }

  #evictPending(keep: number): void {
    const joined = this.#joined();
    const pending = [...this.#conns].filter(([conn, c]) => !c.closed && !joined.has(conn));
    if (pending.length <= keep) return;
    pending.sort((a, b) => a[1].helloBy - b[1].helloBy);
    for (const [conn] of pending.slice(0, pending.length - keep)) {
      this.#close(conn, WS_CLOSE_POLICY_VIOLATION);
    }
  }

  #strike(conn: string, code: ErrorCode): Promise<void> {
    if (this.#strikes.strike(conn, this.#ports.clock.now())) {
      this.#close(conn, WS_CLOSE_POLICY_VIOLATION);
    } else {
      this.#send(conn, { type: 'error', code });
    }
    return this.#queue;
  }

  #send(conn: string, msg: ServerMessage): void {
    const c = this.#conns.get(conn);
    if (!c || c.closed) return;
    try {
      c.socket.send(JSON.stringify(msg));
    } catch {
      this.#close(conn, WS_CLOSE_GOING_AWAY);
    }
  }

  /** Closes a socket from the server side and tells the reducer it is gone. */
  #close(conn: string, code: number, reason: string = CLOSE_TEXT[code] ?? ''): void {
    const c = this.#conns.get(conn);
    if (!c || c.closed) return;
    c.closed = true;
    try {
      c.socket.close(code, reason);
    } catch {}
    this.#forget(conn);
    if (this.#ended || this.#stopped) return;
    this.#enqueue(() => this.#dispatch({ type: 'disconnect', conn }));
  }

  #forget(conn: string): void {
    this.#conns.delete(conn);
    this.#connBucket.delete(conn);
    this.#strikes.delete(conn);
  }
}
