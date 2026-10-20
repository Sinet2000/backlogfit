import type { RoomState } from '@backlogfit/core';

/** The socket operations the host needs. Adapters wrap `ws` or a Workers WebSocket. */
export interface HostSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
  /** Keep this for `RoomHost.adopt` when sockets outlive the process (hibernation). */
  remember?(info: { conn: string; helloBy: number; lastSeen: number }): void;
}

/** Persistence for one room. Decoys get none, so they can never write anything. */
export interface RoomStorage {
  save(state: RoomState): void | Promise<void>;
  /** Delete everything stored for the room, including any platform alarm. */
  wipe(): void | Promise<void>;
}

/** One wake-up per room, in wall-clock ms; `null` cancels it. Calls replace the previous one. */
export interface Wakeup {
  set(at: number | null): void | Promise<void>;
}

/**
 * Wall time drives sockets and rate limits; room time drives the reducer. They differ only when
 * a test build accelerates room time.
 */
export interface HostClock {
  now(): number;
  roomNow(): number;
  /** The wall-clock instant at which room time reaches `roomAt`. */
  wallAt(roomAt: number): number;
}

export interface HostPorts {
  clock: HostClock;
  /** Connection and reducer ids. Must come from a CSPRNG. */
  randomId(): string;
  wakeup: Wakeup;
  storage?: RoomStorage;
  /** Called once after the room ended and its storage was wiped. */
  onEnd?(): void;
  /** Internal errors only; implementations must not log request content. */
  onError?(error: unknown): void;
}
