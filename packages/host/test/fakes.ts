import {
  hashSecret,
  parseCreateRoomRequest,
  parseServerMessage,
  presetScale,
  type RoomState,
  randomToken,
  type ServerMessage,
} from '@backlogfit/core';
import { readLimits } from '@backlogfit/security';
import {
  type ConnInfo,
  type HostOptions,
  type HostPorts,
  type HostSocket,
  hostOptions,
  RoomHost,
} from '../src/index.ts';
import { CONTRACT_ENV, type WireClient, type WireHarness, type WireRoom } from './contract.ts';

export const T0 = 1_700_000_000_000;

export class FakeClock {
  wall = T0;
  now = () => this.wall;
  clock = { now: this.now, roomNow: this.now, wallAt: (at: number) => at };
}

export class FakeWakeup {
  at: number | null = null;
  calls: (number | null)[] = [];
  set(at: number | null): void {
    this.at = at;
    this.calls.push(at);
  }
}

export class FakeStorage {
  saved: RoomState[] = [];
  wipes = 0;
  failNext = false;
  save(state: RoomState): void {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('disk full');
    }
    this.saved.push(state);
  }
  wipe(): void {
    this.wipes += 1;
  }
}

export class FakeSocket implements HostSocket {
  readonly frames: string[] = [];
  readonly messages: ServerMessage[] = [];
  readonly closed: Promise<number>;
  code: number | null = null;
  remembered: ConnInfo[] = [];
  conn = '';
  host: RoomHost | null = null;
  #resolve: (code: number) => void = () => undefined;
  #seen = 0;

  constructor() {
    this.closed = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  send(data: string): void {
    if (this.code !== null) throw new Error('send after close');
    this.frames.push(data);
    const parsed = parseServerMessage(data);
    if (!parsed.ok) throw new Error(`invalid server message ${data}`);
    this.messages.push(parsed.msg);
  }

  close(code: number): void {
    if (this.code !== null) return;
    this.code = code;
    this.#resolve(code);
    void this.host?.disconnected(this.conn);
  }

  hangUp(): void {
    if (this.code !== null) return;
    this.code = 1000;
    this.#resolve(1000);
    void this.host?.disconnected(this.conn);
  }

  client(): WireClient {
    return {
      frames: this.frames,
      messages: this.messages,
      closed: this.closed,
      send: (msg) => void this.write(msg),
      next: (type, pred) => this.next(type, pred),
      close: () => this.hangUp(),
    };
  }

  remember(info: ConnInfo): void {
    this.remembered.push(info);
  }

  write(msg: Record<string, unknown> | string): Promise<void> {
    const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
    return this.host?.receive(this.conn, raw) ?? Promise.resolve();
  }

  async next<T extends ServerMessage['type']>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    for (let spin = 0; spin < 200; spin++) {
      for (let i = this.#seen; i < this.messages.length; i++) {
        const m = this.messages[i] as ServerMessage;
        if (m.type === type && pred(m as Extract<ServerMessage, { type: T }>)) {
          this.#seen = i + 1;
          return m as Extract<ServerMessage, { type: T }>;
        }
      }
      await this.host?.idle();
      await new Promise((r) => setTimeout(r, 0));
    }
    throw new Error(`timeout waiting for ${type}`);
  }
}

export interface Rig {
  host: RoomHost;
  clock: FakeClock;
  wakeup: FakeWakeup;
  storage: FakeStorage;
  errors: unknown[];
  ended: number;
  connect(): FakeSocket;
  fire(): Promise<void>;
  advance(ms: number): Promise<void>;
}

export const OPTIONS: HostOptions = hostOptions(readLimits(CONTRACT_ENV));

export function ports(
  clock: FakeClock,
  wakeup: FakeWakeup,
  storage: FakeStorage | null,
  rig?: { errors: unknown[]; ended: number },
): HostPorts {
  return {
    clock: clock.clock,
    randomId: () => randomToken(12),
    wakeup,
    ...(storage ? { storage } : {}),
    onEnd: () => {
      if (rig) rig.ended += 1;
    },
    onError: (e) => rig?.errors.push(e),
  };
}

export async function request(lobby = false) {
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const parsed = parseCreateRoomRequest({
    v: 1,
    config: { scale: presetScale('fibonacci'), lobby },
    joinHash: await hashSecret(joinSecret),
    adminHash: await hashSecret(adminSecret),
    lifetimeHours: 2,
  });
  if (!parsed.ok) throw new Error(parsed.code);
  return { req: parsed.msg, joinSecret, adminSecret };
}

export function attach(host: RoomHost, socket = new FakeSocket()): FakeSocket {
  socket.host = host;
  socket.conn = host.open(socket).conn;
  return socket;
}

async function settle(host: RoomHost): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await host.idle();
    await new Promise((r) => setTimeout(r, 0));
  }
}

export async function rig(
  options: HostOptions = OPTIONS,
  opts: { lobby?: boolean; decoy?: boolean } = {},
): Promise<Rig & { room: WireRoom }> {
  const clock = new FakeClock();
  const wakeup = new FakeWakeup();
  const storage = new FakeStorage();
  const out = { errors: [] as unknown[], ended: 0 };
  const p = ports(clock, wakeup, opts.decoy ? null : storage, out);
  const { req, joinSecret, adminSecret } = await request(opts.lobby);
  const roomId = randomToken(16);
  const host = opts.decoy
    ? RoomHost.decoy(roomId, p, options)
    : await RoomHost.create(req, roomId, p, options);
  const r: Rig & { room: WireRoom } = {
    host,
    clock,
    wakeup,
    storage,
    get errors() {
      return out.errors;
    },
    get ended() {
      return out.ended;
    },
    room: { roomId, joinSecret, adminSecret },
    connect: () => attach(host),
    fire: async () => {
      await host.wake();
      await settle(host);
    },
    advance: async (ms) => {
      const end = clock.wall + ms;
      while (wakeup.at !== null && wakeup.at <= end) {
        clock.wall = Math.max(clock.wall, wakeup.at);
        wakeup.at = null;
        await host.wake();
        await settle(host);
      }
      clock.wall = end;
      await settle(host);
    },
  };
  return r;
}

export function fakeHarness(): WireHarness {
  const clock = new FakeClock();
  const hosts = new Map<string, { host: RoomHost; wakeup: FakeWakeup }>();

  return {
    async createRoom(opts = {}) {
      const { req, joinSecret, adminSecret } = await request(opts.lobby);
      const roomId = randomToken(16);
      const wakeup = new FakeWakeup();
      const host = await RoomHost.create(
        req,
        roomId,
        ports(clock, wakeup, new FakeStorage()),
        OPTIONS,
      );
      hosts.set(roomId, { host, wakeup });
      return { roomId, joinSecret, adminSecret };
    },
    async open(roomId) {
      let entry = hosts.get(roomId);
      if (!entry || entry.host.ended) {
        const wakeup = new FakeWakeup();
        entry = { host: RoomHost.decoy(roomId, ports(clock, wakeup, null), OPTIONS), wakeup };
        hosts.set(roomId, entry);
      }
      return attach(entry.host).client();
    },
    async elapse(ms) {
      const end = clock.wall + ms;
      for (;;) {
        const due = [...hosts.values()].filter((e) => e.wakeup.at !== null && e.wakeup.at <= end);
        if (due.length === 0) break;
        clock.wall = Math.max(clock.wall, Math.min(...due.map((e) => e.wakeup.at as number)));
        for (const e of due) {
          if (e.wakeup.at !== null && e.wakeup.at <= clock.wall) {
            e.wakeup.at = null;
            await e.host.wake();
          }
        }
      }
      clock.wall = end;
      for (const e of hosts.values()) await settle(e.host);
    },
  };
}
