export interface Limits {
  defaultLifetimeHours: number;
  maxLifetimeHours: number;
  idleTimeoutMinutes: number;
  maxParticipants: number;
  maxTasks: number;
  maxMessageBytes: number;
  maxRooms: number;
  rateMsgsPerSec: number;
  rateBurst: number;
  roomCreatePerMin: number;
  passcodeMaxAttempts: number;
}

export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({
  defaultLifetimeHours: 2,
  maxLifetimeHours: 8,
  idleTimeoutMinutes: 30,
  maxParticipants: 50,
  maxTasks: 500,
  maxMessageBytes: 16_384,
  maxRooms: 1000,
  rateMsgsPerSec: 20,
  rateBurst: 40,
  roomCreatePerMin: 10,
  passcodeMaxAttempts: 5,
});

const ENV: Record<keyof Limits, [name: string, min: number, max: number]> = {
  defaultLifetimeHours: ['DEFAULT_LIFETIME_HOURS', 1, 24],
  maxLifetimeHours: ['MAX_LIFETIME_HOURS', 1, 24],
  idleTimeoutMinutes: ['IDLE_TIMEOUT_MINUTES', 1, 1440],
  maxParticipants: ['MAX_PARTICIPANTS', 2, 500],
  maxTasks: ['MAX_TASKS', 1, 5000],
  maxMessageBytes: ['MAX_MESSAGE_BYTES', 1024, 262_144],
  maxRooms: ['MAX_ROOMS', 1, 1_000_000],
  rateMsgsPerSec: ['RATE_MSGS_PER_SEC', 1, 1000],
  rateBurst: ['RATE_BURST', 1, 10_000],
  roomCreatePerMin: ['ROOM_CREATE_PER_MIN', 1, 10_000],
  passcodeMaxAttempts: ['PASSCODE_MAX_ATTEMPTS', 1, 100],
};

const DECIMAL_INT = /^(?:0|[1-9][0-9]{0,8})$/;

/**
 * Reads limits from env vars. Invalid or out-of-range values throw so misconfiguration fails fast.
 * Only plain decimal integers are accepted: no sign, exponent, hex, fraction, separators or
 * surrounding whitespace (`Number()` would accept "1e3", "0x10", " 20 " and "20.0").
 */
export function readLimits(env: Readonly<Record<string, string | undefined>>): Limits {
  const out = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(ENV) as (keyof Limits)[]) {
    const [name, min, max] = ENV[key];
    const raw = env[name];
    if (raw === undefined || raw === '') continue;
    const n = DECIMAL_INT.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
    out[key] = n;
  }
  if (out.defaultLifetimeHours > out.maxLifetimeHours) {
    throw new Error('DEFAULT_LIFETIME_HOURS must not exceed MAX_LIFETIME_HOURS');
  }
  return out;
}
