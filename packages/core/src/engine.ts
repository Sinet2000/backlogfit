/**
 * In-memory room host: the reference adapter. Runs the exact pipeline a backend runs
 * (parse → authenticate → reduce → expand effects) for any number of fake clients.
 * Used by frontend tests, the offline demo, and as a model for the real adapters.
 */
import { expandEffects, toEvent } from './adapter.ts';
import { hashPasscode, hashSecret, randomSalt, randomToken } from './crypto.ts';
import { createRoom, reduce } from './reduce.ts';
import {
  type ClientMessageInput,
  type CloseReason,
  DEFAULT_MAX_MESSAGE_BYTES,
  parseClientMessage,
  parseCreateRoomRequest,
  type RoomConfigInput,
  type ServerMessage,
} from './schemas.ts';
import { DEFAULT_LIMITS, type Limits, type RoomEvent, type RoomState } from './state.ts';

export interface LoopbackOptions {
  /** Clock in epoch ms. Required: core never reads the system clock itself. */
  now: () => number;
  randomId?: () => string;
  newToken?: () => string;
  limits?: Partial<Limits>;
  maxMessageBytes?: number;
}

export interface LoopbackCreateInput {
  config: RoomConfigInput;
  lifetimeHours?: number;
  passcode?: string;
  roomId?: string;
  joinSecret?: string;
  adminSecret?: string;
}

type Listener = (msg: ServerMessage) => void;

export class LoopbackClient {
  readonly id: string;
  readonly messages: ServerMessage[] = [];
  closedReason: CloseReason | null = null;
  #engine: LoopbackEngine;
  #listeners = new Set<Listener>();

  constructor(engine: LoopbackEngine, id: string) {
    this.#engine = engine;
    this.id = id;
  }

  get open(): boolean {
    return this.closedReason === null;
  }

  /** Last received message of a given type. */
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m?.type === type) return m as Extract<ServerMessage, { type: T }>;
    }
    return undefined;
  }

  onMessage(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Send a message object or a raw frame. Resolves once the server has processed it. */
  send(msg: ClientMessageInput | string): Promise<void> {
    return this.#engine.receive(this, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  disconnect(): Promise<void> {
    return this.#engine.drop(this);
  }

  deliver(msg: ServerMessage): void {
    if (!this.open) return;
    this.messages.push(msg);
    for (const l of this.#listeners) l(msg);
  }

  markClosed(reason: CloseReason): void {
    if (this.closedReason === null) this.closedReason = reason;
  }
}

export class LoopbackEngine {
  #state: RoomState;
  #clients = new Map<string, LoopbackClient>();
  #queue: Promise<void> = Promise.resolve();
  #now: () => number;
  #randomId: () => string;
  #newToken: () => string;
  #maxBytes: number;
  #seq = 0;

  private constructor(state: RoomState, opts: LoopbackOptions) {
    this.#state = state;
    this.#now = opts.now;
    this.#randomId = opts.randomId ?? (() => randomToken(12));
    this.#newToken = opts.newToken ?? randomToken;
    this.#maxBytes = opts.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  }

  /** Create a room the way a browser + server would. Secrets are generated unless given. */
  static async create(
    input: LoopbackCreateInput,
    opts: LoopbackOptions,
  ): Promise<{ engine: LoopbackEngine; roomId: string; joinSecret: string; adminSecret: string }> {
    const joinSecret = input.joinSecret ?? randomToken();
    const adminSecret = input.adminSecret ?? randomToken();
    const salt = randomSalt();
    const parsed = parseCreateRoomRequest({
      v: 1,
      config: input.config,
      joinHash: await hashSecret(joinSecret),
      adminHash: await hashSecret(adminSecret),
      lifetimeHours: input.lifetimeHours ?? 2,
      ...(input.passcode !== undefined
        ? { passcode: { salt, hash: await hashPasscode(salt, input.passcode) } }
        : {}),
    });
    if (!parsed.ok) throw new Error(`invalid room request: ${parsed.code}`);
    const roomId = input.roomId ?? randomToken();
    const limits = { ...DEFAULT_LIMITS, ...opts.limits };
    const { state } = createRoom(
      parsed.msg,
      roomId,
      { now: opts.now(), randomId: () => '' },
      limits,
    );
    return { engine: new LoopbackEngine(state, opts), roomId, joinSecret, adminSecret };
  }

  /** Snapshot of the raw server state (tests only; never show this to a user). */
  get state(): RoomState {
    return this.#state;
  }

  get closed(): boolean {
    return this.#state.closed !== null;
  }

  connect(): LoopbackClient {
    const client = new LoopbackClient(this, `c${++this.#seq}`);
    this.#clients.set(client.id, client);
    this.#enqueue(() => this.#dispatch({ type: 'connect', conn: client.id }));
    return client;
  }

  /** Fire the alarm if due (call from a timer in demo mode, or after advancing a fake clock). */
  runAlarms(): Promise<void> {
    return this.#enqueue(() => {
      const at = this.#state.alarmAt;
      if (at !== null && this.#now() >= at) this.#dispatch({ type: 'tick' });
    });
  }

  /** Wait until every queued message has been processed. */
  idle(): Promise<void> {
    return this.#queue;
  }

  receive(client: LoopbackClient, raw: string): Promise<void> {
    return this.#enqueue(async () => {
      if (!client.open) return;
      const parsed = parseClientMessage(raw, this.#maxBytes);
      if (!parsed.ok) {
        client.deliver({ type: 'error', code: parsed.code });
        return;
      }
      const event = await toEvent(this.#state, client.id, parsed.msg, this.#newToken);
      this.#dispatch(event);
    });
  }

  drop(client: LoopbackClient): Promise<void> {
    return this.#enqueue(() => {
      if (!this.#clients.has(client.id)) return;
      this.#clients.delete(client.id);
      client.markClosed('closed');
      this.#dispatch({ type: 'disconnect', conn: client.id });
    });
  }

  #enqueue(job: () => void | Promise<void>): Promise<void> {
    const run = this.#queue.then(job);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  #dispatch(event: RoomEvent): void {
    const { state, effects } = reduce(this.#state, event, {
      now: this.#now(),
      randomId: this.#randomId,
    });
    this.#state = state;
    for (const out of expandEffects(state, effects)) {
      switch (out.type) {
        case 'send':
          this.#clients.get(out.to)?.deliver(out.msg);
          break;
        case 'close': {
          const c = this.#clients.get(out.to);
          c?.markClosed(out.reason);
          this.#clients.delete(out.to);
          break;
        }
        case 'deleteAll':
          for (const c of this.#clients.values()) {
            c.deliver({ type: 'closed', reason: out.reason });
            c.markClosed(out.reason);
          }
          this.#clients.clear();
          break;
        case 'scheduleAlarm':
          break;
      }
    }
  }
}
