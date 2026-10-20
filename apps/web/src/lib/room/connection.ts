// Client side of the room protocol: hello/welcome, lobby, state snapshots, errors, close
// reasons, keep-alive with a liveness deadline, and reconnect with backoff using the resume
// token. Framework-free so it can be unit-tested with fake timers and a fake transport.
import {
  type ClientMessageInput,
  type CloseReason,
  type ErrorCode,
  parseServerMessage,
  type RoomView,
  type ServerMessage,
} from '@backlogfit/core';
import type { RoomLink } from './link.ts';
import type { RoomSessionStore } from './storage.ts';
import type { Transport, TransportFactory } from './transport.ts';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'joined'
  | 'reconnecting'
  | 'ended';

export type EndReason = CloseReason | 'unreachable' | 'left';

export interface You {
  participantId: string;
  role: 'voter' | 'spectator';
  authority: 'admin' | 'coadmin' | 'none';
  isAdmin: boolean;
}

export interface JoinRequest {
  name: string;
  role: 'voter' | 'spectator';
  passcode?: string;
  /** Team hint from the invite link; the server ignores unknown ids. */
  team?: string | null;
}

export interface QueuedVote {
  taskId: string;
  round: number;
  value: string | null;
}

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  view: RoomView | null;
  you: You | null;
  ended: EndReason | null;
  joinError: ErrorCode | null;
  attempt: number;
  clockOffset: number;
  queuedVote: QueuedVote | null;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  now(): number;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

export interface ConnectionOptions {
  link: RoomLink;
  transport: TransportFactory;
  session: RoomSessionStore;
  timers?: Timers;
  random?: () => number;
  onChange: (snapshot: ConnectionSnapshot) => void;
  onServerError?: (code: ErrorCode, ref: string | undefined) => void;
  onTasksAdded?: (requestId: string | undefined, taskIds: string[]) => void;
  pingIntervalMs?: number;
  maxInitialAttempts?: number;
}

export const BACKOFF_BASE_MS = 500;
export const BACKOFF_MAX_MS = 30_000;

/** Exponential backoff with jitter: base·2^attempt, capped, scaled into [50%, 100%]. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(ceiling * (0.5 + random() * 0.5));
}

/** Clock offset from a server timestamp, assuming it was taken halfway through the round trip. */
export function clockOffset(serverTime: number, sentAt: number | null, receivedAt: number): number {
  const rtt = sentAt === null ? 0 : Math.max(0, receivedAt - sentAt);
  return Math.round(serverTime + rtt / 2 - receivedAt);
}

const JOIN_ERRORS: ReadonlySet<ErrorCode> = new Set([
  'room_locked',
  'room_full',
  'spectators_disabled',
  'bad_passcode',
  'passcode_locked',
  'unauthorized',
]);

const RETRYABLE_JOIN_ERRORS: ReadonlySet<ErrorCode> = new Set([
  'bad_passcode',
  'spectators_disabled',
  'room_full',
]);

const CLOSE_CODE_REASONS: Record<number, CloseReason> = {
  4001: 'expired',
  4002: 'idle',
  4003: 'closed',
  4004: 'kicked',
  4005: 'denied',
  4006: 'replaced',
  4007: 'left',
  4008: 'rejected',
  4404: 'not_found',
};

type ResolvedOptions = ConnectionOptions &
  Required<Pick<ConnectionOptions, 'timers' | 'random' | 'pingIntervalMs' | 'maxInitialAttempts'>>;

export class RoomConnection {
  readonly #o: ResolvedOptions;
  #snap: ConnectionSnapshot = {
    status: 'idle',
    view: null,
    you: null,
    ended: null,
    joinError: null,
    attempt: 0,
    clockOffset: 0,
    queuedVote: null,
  };
  #transport: Transport | null = null;
  #request: JoinRequest | null = null;
  #everJoined = false;
  #closedReason: CloseReason | null = null;
  #lastJoinError: ErrorCode | null = null;
  #retryTimer: unknown = null;
  #pingTimer: unknown = null;
  #generation = 0;
  #lastSeen = 0;
  #sentAt: number | null = null;

  constructor(opts: ConnectionOptions) {
    this.#o = {
      pingIntervalMs: 25_000,
      maxInitialAttempts: 4,
      timers: realTimers,
      random: Math.random,
      ...opts,
    };
  }

  get snapshot(): ConnectionSnapshot {
    return this.#snap;
  }

  /** Starts, or restarts after a refused join, with the given identity. */
  join(req: JoinRequest): void {
    this.#request = req;
    this.#o.session.identity = { name: req.name, role: req.role };
    this.#update({ joinError: null, ended: null, attempt: 0 });
    this.#open();
  }

  /** Reconnects after a terminal state such as `replaced` or `unreachable`. */
  retry(): void {
    if (!this.#request) return;
    this.#update({ ended: null, attempt: 0 });
    this.#open();
  }

  /** Skips the backoff wait, e.g. when the browser comes back online. */
  nudge(): void {
    if (this.#snap.status === 'reconnecting' && this.#retryTimer !== null) {
      this.#o.timers.clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
      this.#open();
    }
  }

  send(msg: ClientMessageInput): boolean {
    if (this.#snap.status !== 'joined' || !this.#transport) return false;
    this.#transport.send(JSON.stringify(msg));
    return true;
  }

  /**
   * Casts (or withdraws, with `null`) a vote. While reconnecting the latest choice is kept and
   * sent after the resume if the same round is still open.
   */
  vote(taskId: string, round: number, value: string | null): 'sent' | 'queued' | 'dropped' {
    const msg: ClientMessageInput =
      value === null ? { type: 'unvote', taskId, round } : { type: 'vote', taskId, round, value };
    if (this.send(msg)) return 'sent';
    if (this.#snap.status !== 'reconnecting') return 'dropped';
    this.#update({ queuedVote: { taskId, round, value } });
    return 'queued';
  }

  /** Leaves voluntarily: tells the server, closes the socket and forgets the resume token. */
  leave(): void {
    if (this.#snap.status === 'joined' || this.#snap.status === 'lobby') {
      this.#transport?.send(JSON.stringify({ type: 'leave' }));
    }
    this.#teardown();
    this.#o.session.clear();
    this.#update({ status: 'ended', ended: 'left', queuedVote: null });
  }

  dispose(): void {
    this.#teardown();
  }

  #update(patch: Partial<ConnectionSnapshot>): void {
    this.#snap = { ...this.#snap, ...patch };
    this.#o.onChange(this.#snap);
  }

  #teardown(): void {
    this.#generation++;
    if (this.#retryTimer !== null) this.#o.timers.clearTimeout(this.#retryTimer);
    if (this.#pingTimer !== null) this.#o.timers.clearInterval(this.#pingTimer);
    this.#retryTimer = null;
    this.#pingTimer = null;
    const t = this.#transport;
    this.#transport = null;
    t?.close();
  }

  #open(): void {
    this.#teardown();
    const gen = this.#generation;
    this.#closedReason = null;
    this.#lastJoinError = null;
    if (this.#snap.status !== 'reconnecting') this.#update({ status: 'connecting' });
    this.#transport = this.#o.transport(this.#o.link.roomId, {
      onOpen: () => gen === this.#generation && this.#hello(),
      onMessage: (data) => gen === this.#generation && this.#receive(data),
      onClose: (code) => gen === this.#generation && this.#dropped(code),
    });
  }

  #hello(): void {
    const req = this.#request;
    if (!req || !this.#transport) return;
    const { link, session } = this.#o;
    const resumeToken = session.resumeToken;
    const hello: ClientMessageInput = {
      type: 'hello',
      v: 1,
      joinSecret: link.joinSecret,
      name: req.name,
      role: req.role,
      ...(req.passcode ? { passcode: req.passcode } : {}),
      ...(req.team ? { team: req.team } : {}),
      ...(link.adminSecret ? { adminSecret: link.adminSecret } : {}),
      ...(resumeToken ? { resumeToken } : {}),
    };
    this.#sentAt = this.#o.timers.now();
    this.#transport.send(JSON.stringify(hello));
  }

  #receive(data: string): void {
    const parsed = parseServerMessage(data);
    if (!parsed.ok) return;
    this.#lastSeen = this.#o.timers.now();
    this.#handle(parsed.msg);
  }

  #handle(msg: ServerMessage): void {
    const now = this.#o.timers.now();
    switch (msg.type) {
      case 'welcome': {
        if (msg.you.resumeToken) this.#o.session.resumeToken = msg.you.resumeToken;
        this.#everJoined = true;
        this.#startPing();
        // A passcode is only needed once; the resume token covers later reconnects.
        if (this.#request?.passcode) this.#request = { ...this.#request, passcode: '' };
        this.#update({
          status: 'joined',
          view: msg.room,
          you: {
            participantId: msg.you.participantId,
            role: msg.you.role,
            authority: msg.you.authority,
            isAdmin: msg.you.isAdmin,
          },
          joinError: null,
          attempt: 0,
          clockOffset: clockOffset(msg.serverTime, this.#sentAt, now),
        });
        this.#flushQueuedVote(msg.room);
        break;
      }
      case 'state': {
        const me = msg.room.me;
        const you = this.#snap.you;
        this.#update({
          view: msg.room,
          you:
            me && you
              ? {
                  ...you,
                  role: me.role,
                  authority: me.authority,
                  isAdmin: me.authority === 'admin',
                }
              : you,
        });
        break;
      }
      case 'lobby': {
        if (msg.resumeToken) this.#o.session.resumeToken = msg.resumeToken;
        if (msg.status === 'waiting') {
          this.#everJoined = true;
          this.#startPing();
          this.#update({ status: 'lobby', attempt: 0, joinError: null });
        }
        break;
      }
      case 'error': {
        if (JOIN_ERRORS.has(msg.code) && this.#snap.status !== 'joined') {
          this.#lastJoinError = msg.code;
        } else {
          this.#o.onServerError?.(msg.code, msg.ref);
        }
        break;
      }
      case 'closed':
        this.#closedReason = msg.reason;
        break;
      case 'tasks.added':
        this.#o.onTasksAdded?.(msg.requestId, msg.taskIds);
        break;
      case 'pong':
        this.#update({ clockOffset: clockOffset(msg.serverTime, this.#sentAt, now) });
        this.#sentAt = null;
        break;
    }
  }

  #flushQueuedVote(room: RoomView): void {
    const q = this.#snap.queuedVote;
    if (!q) return;
    this.#update({ queuedVote: null });
    if (room.phase !== 'voting' || room.currentTaskId !== q.taskId || room.round !== q.round)
      return;
    this.vote(q.taskId, q.round, q.value);
  }

  // Pings keep proxies from closing an idle socket. A socket that stays silent for two ping
  // intervals is treated as dropped, so half-open connections reconnect instead of hanging.
  #startPing(): void {
    if (this.#pingTimer !== null) return;
    this.#lastSeen = this.#o.timers.now();
    this.#pingTimer = this.#o.timers.setInterval(() => {
      const now = this.#o.timers.now();
      if (now - this.#lastSeen > this.#o.pingIntervalMs * 2) {
        this.#dropped(1006);
        return;
      }
      this.#sentAt = now;
      this.#transport?.send(JSON.stringify({ type: 'ping' }));
    }, this.#o.pingIntervalMs);
  }

  #dropped(code: number): void {
    const reason = this.#closedReason ?? CLOSE_CODE_REASONS[code] ?? null;
    const joinError = this.#lastJoinError;
    this.#teardown();

    if (reason === 'rejected' && joinError && RETRYABLE_JOIN_ERRORS.has(joinError)) {
      this.#update({ status: 'idle', joinError });
      return;
    }
    if (reason !== null) {
      if (
        reason === 'kicked' ||
        reason === 'denied' ||
        reason === 'not_found' ||
        reason === 'left'
      ) {
        this.#o.session.clear();
      }
      if (reason === 'expired' || reason === 'idle' || reason === 'closed') {
        this.#o.session.clear(true);
      }
      this.#update({ status: 'ended', ended: reason, joinError, queuedVote: null });
      return;
    }

    const attempt = this.#snap.attempt + 1;
    if (!this.#everJoined && attempt >= this.#o.maxInitialAttempts) {
      this.#update({ status: 'ended', ended: 'unreachable', attempt });
      return;
    }
    this.#update({ status: this.#everJoined ? 'reconnecting' : 'connecting', attempt });
    const gen = this.#generation;
    this.#retryTimer = this.#o.timers.setTimeout(
      () => {
        if (gen !== this.#generation) return;
        this.#retryTimer = null;
        this.#open();
      },
      backoffDelay(attempt - 1, this.#o.random),
    );
  }
}
