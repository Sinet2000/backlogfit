import { type Limits as RoomLimits, toCoreLimits } from '@backlogfit/core';
import type { Limits } from '@backlogfit/security';

export interface HostOptions {
  /** Reducer limits for new rooms and decoys. */
  roomLimits: RoomLimits;
  maxMessageBytes: number;
  rateMsgsPerSec: number;
  rateBurst: number;
  helloTimeoutMs: number;
  socketTimeoutMs: number;
  maxStrikes: number;
  /** Sockets per room that have not completed a hello; the oldest is closed beyond this. */
  maxPending: number;
}

/** The per-room bucket allows this many times the per-connection rate and burst (ADR-0007). */
export const ROOM_RATE_FACTOR = 5;
/** Invalid or rate-limited frames per connection and minute before closing with 1008. */
export const MAX_STRIKES = 10;
export const STRIKE_WINDOW_MS = 60_000;

/** Host options from the env limits both backends read with `readLimits`. */
export function hostOptions(limits: Limits): HostOptions {
  return {
    roomLimits: toCoreLimits(limits),
    maxMessageBytes: limits.maxMessageBytes,
    rateMsgsPerSec: limits.rateMsgsPerSec,
    rateBurst: limits.rateBurst,
    helloTimeoutMs: limits.helloTimeoutSeconds * 1000,
    socketTimeoutMs: limits.socketTimeoutSeconds * 1000,
    maxStrikes: MAX_STRIKES,
    maxPending: limits.maxParticipants * 2 + 20,
  };
}
