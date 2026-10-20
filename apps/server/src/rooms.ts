import { type CreateRoomRequest, randomToken } from '@backlogfit/core';
import {
  type HostClock,
  type HostOptions,
  type HostPorts,
  RoomHost,
  type RoomStorage,
  type Wakeup,
} from '@backlogfit/host';
import type { RoomStore } from './store.ts';

export interface RegistryOptions {
  store: RoomStore;
  clock: HostClock;
  host: HostOptions;
  maxRooms: number;
}

export type CreateResult =
  | { ok: true; roomId: string; expiresAt: number }
  | { ok: false; code: 'room_limit' };

function reportError(e: unknown): void {
  // Only our own error names and messages are logged, never request content.
  const what = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
  console.error(`backlogfit: internal error (${what})`);
}

class TimerWakeup implements Wakeup {
  host: RoomHost | null = null;
  #timer: NodeJS.Timeout | null = null;

  set(at: number | null): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (at === null) return;
    this.#timer = setTimeout(
      () => {
        this.#timer = null;
        void this.host?.wake();
      },
      Math.max(0, at - Date.now()),
    );
    this.#timer.unref();
  }
}

/**
 * Node adapter state: one RoomHost per live room plus one decoy host per unknown roomId that has
 * sockets attached. Decoys are dropped with their last socket and never touch the store.
 */
export class RoomRegistry {
  readonly #opts: RegistryOptions;
  readonly #rooms = new Map<string, RoomHost>();
  readonly #decoys = new Map<string, RoomHost>();

  constructor(opts: RegistryOptions) {
    this.#opts = opts;
  }

  get size(): number {
    return this.#rooms.size;
  }

  get decoyCount(): number {
    return this.#decoys.size;
  }

  get(roomId: string): RoomHost | undefined {
    return this.#rooms.get(roomId);
  }

  async create(req: CreateRoomRequest): Promise<CreateResult> {
    if (this.#rooms.size >= this.#opts.maxRooms) return { ok: false, code: 'room_limit' };
    let roomId = randomToken(16);
    while (this.#rooms.has(roomId) || this.#decoys.has(roomId)) roomId = randomToken(16);
    const { ports, wakeup } = this.#ports(roomId);
    const host = await RoomHost.create(req, roomId, ports, this.#opts.host);
    wakeup.host = host;
    this.#rooms.set(roomId, host);
    return { ok: true, roomId, expiresAt: host.state.expiresAt };
  }

  /** The host a new socket for `roomId` attaches to: the room, or that id's decoy. */
  route(roomId: string): RoomHost {
    const room = this.#rooms.get(roomId);
    if (room && !room.ended) return room;
    let decoy = this.#decoys.get(roomId);
    if (!decoy) {
      const wakeup = new TimerWakeup();
      decoy = RoomHost.decoy(roomId, this.#basePorts(wakeup), this.#opts.host);
      wakeup.host = decoy;
      this.#decoys.set(roomId, decoy);
    }
    return decoy;
  }

  release(host: RoomHost): void {
    if (!host.isDecoy || host.connectionCount > 0) return;
    if (this.#decoys.get(host.roomId) === host) this.#decoys.delete(host.roomId);
    void host.stop();
  }

  /** Reload stored rooms; overdue ones expire and are deleted at once. */
  async restore(): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const state of this.#opts.store.loadAll()) {
      const { ports, wakeup } = this.#ports(state.roomId);
      const host = new RoomHost(state, ports, this.#opts.host);
      wakeup.host = host;
      this.#rooms.set(state.roomId, host);
      jobs.push(host.restore());
    }
    await Promise.all(jobs);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.#rooms.values(), ...this.#decoys.values()].map((h) => h.stop()));
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#rooms.values()].map((h) => h.idle()));
  }

  #basePorts(wakeup: Wakeup): HostPorts {
    return {
      clock: this.#opts.clock,
      randomId: () => randomToken(12),
      wakeup,
      onError: reportError,
    };
  }

  #ports(roomId: string): { ports: HostPorts; wakeup: TimerWakeup } {
    const { store } = this.#opts;
    const storage: RoomStorage = {
      save: (state) => store.put(state),
      wipe: () => store.delete(roomId),
    };
    const wakeup = new TimerWakeup();
    const ports: HostPorts = {
      ...this.#basePorts(wakeup),
      storage,
      onEnd: () => {
        if (this.#rooms.get(roomId)?.ended) this.#rooms.delete(roomId);
      },
    };
    return { ports, wakeup };
  }
}
