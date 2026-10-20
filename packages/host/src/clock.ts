import type { HostClock } from './ports.ts';

/** Room time equals wall time. */
export function systemClock(wall: () => number = Date.now): HostClock {
  return { now: wall, roomNow: wall, wallAt: (at) => at };
}

/**
 * Room time runs `scale` times faster than wall time from the moment of creation. Adapters must
 * only use a scale other than 1 in test builds (TEST_TIME_SCALE with NODE_ENV=test).
 */
export function scaledClock(scale: number, wall: () => number = Date.now): HostClock {
  if (scale === 1) return systemClock(wall);
  const base = wall();
  return {
    now: wall,
    roomNow: () => Math.floor(base + (wall() - base) * scale),
    wallAt: (at) => base + Math.ceil((at - base) / scale),
  };
}
