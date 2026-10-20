/**
 * Room time source. With scale > 1 (test-only, see TEST_TIME_SCALE) room time runs faster than
 * wall time so idle and hard expiry can be exercised in seconds.
 */
export interface Clock {
  now(): number;
  /** Real milliseconds until room time `at` (never negative). */
  delayUntil(at: number): number;
}

export function createClock(scale = 1, wall: () => number = Date.now): Clock {
  const base = wall();
  const now = () => (scale === 1 ? wall() : Math.floor(base + (wall() - base) * scale));
  return {
    now,
    delayUntil(at) {
      return Math.max(0, Math.ceil((at - now()) / scale));
    },
  };
}
