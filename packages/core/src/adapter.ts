/** Helpers that keep backend adapters thin and uniform. */
import { randomToken, secretsOf, verifyHello } from './crypto.ts';
import { project } from './project.ts';
import { reduce } from './reduce.ts';
import type { ClientMessage, CloseReason, ServerMessage } from './schemas.ts';
import {
  type Ctx,
  DEFAULT_LIMITS,
  type Effect,
  HOUR_MS,
  type Limits,
  type ReduceResult,
  type RoomEvent,
  type RoomState,
} from './state.ts';

/** Wrap a parsed client message as a reducer event, authenticating it first if it is a hello. */
export async function toEvent(
  state: RoomState,
  conn: string,
  msg: ClientMessage,
  newToken: () => string = randomToken,
): Promise<RoomEvent> {
  if (msg.type !== 'hello') return { type: 'message', conn, msg };
  const auth = await verifyHello(secretsOf(state), msg, newToken);
  return { type: 'message', conn, msg, auth };
}

export type Outbound =
  | { type: 'send'; to: string; msg: ServerMessage }
  /** The `closed` message has already been emitted as a preceding send; just close the socket. */
  | { type: 'close'; to: string; reason: CloseReason; code: number }
  | { type: 'scheduleAlarm'; at: number | null }
  | { type: 'deleteAll'; reason: CloseReason; code: number };

const CLOSE_CODES: Record<CloseReason, number> = {
  expired: 4001,
  idle: 4002,
  closed: 4003,
  kicked: 4004,
  denied: 4005,
  replaced: 4006,
  left: 4007,
  rejected: 4008,
  not_found: 4404,
};

/** WebSocket close code (4000–4999 application range) for a close reason. */
export function closeCodeFor(reason: CloseReason): number {
  return CLOSE_CODES[reason];
}

/**
 * Turn reducer effects into concrete per-socket actions: broadcastState becomes one projected
 * `state` message per active connection, and close becomes `closed{reason}` + close.
 * `state` must be the state returned by the same reduce() call.
 */
export function expandEffects(state: RoomState, effects: readonly Effect[]): Outbound[] {
  const out: Outbound[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'send':
      case 'scheduleAlarm':
        out.push(e);
        break;
      case 'broadcastState':
        for (const p of state.participants) {
          if (p.status !== 'active' || p.conn === null) continue;
          out.push({
            type: 'send',
            to: p.conn,
            msg: { type: 'state', rev: state.rev, room: project(state, p.id) },
          });
        }
        break;
      case 'close':
        out.push({ type: 'send', to: e.to, msg: { type: 'closed', reason: e.reason } });
        out.push({ type: 'close', to: e.to, reason: e.reason, code: closeCodeFor(e.reason) });
        break;
      case 'deleteAll':
        out.push({ type: 'deleteAll', reason: e.reason, code: closeCodeFor(e.reason) });
        break;
    }
  }
  return out;
}

/**
 * Env-style limits (hours/minutes, as read by packages/security `readLimits`) → reducer Limits
 * (milliseconds). Missing fields keep DEFAULT_LIMITS. Both backends should use this instead of
 * converting units themselves.
 */
export interface LimitsInput {
  maxLifetimeHours?: number;
  idleTimeoutMinutes?: number;
  maxParticipants?: number;
  maxTasks?: number;
  passcodeMaxAttempts?: number;
}

export function toCoreLimits(input: LimitsInput = {}): Limits {
  return {
    maxLifetimeMs:
      input.maxLifetimeHours !== undefined
        ? input.maxLifetimeHours * HOUR_MS
        : DEFAULT_LIMITS.maxLifetimeMs,
    idleTimeoutMs:
      input.idleTimeoutMinutes !== undefined
        ? input.idleTimeoutMinutes * 60_000
        : DEFAULT_LIMITS.idleTimeoutMs,
    maxParticipants: input.maxParticipants ?? DEFAULT_LIMITS.maxParticipants,
    maxTasks: input.maxTasks ?? DEFAULT_LIMITS.maxTasks,
    passcodeMaxAttempts: input.passcodeMaxAttempts ?? DEFAULT_LIMITS.passcodeMaxAttempts,
  };
}

/**
 * Bring persisted state in line with the sockets that actually exist, e.g. after a process
 * restart (Node: no sockets survive, pass []) or a Durable Object waking up (pass the
 * connection ids from the surviving sockets' attachments). Every participant whose `conn` is
 * not live gets a `disconnect` event, so presence, capacity and auto-reveal stop counting ghosts.
 * Also runs a `tick`, so an expired room is closed and the alarm is (re)scheduled.
 * Effects are concatenated in order; persist `state` only if it differs from the input.
 */
export function reconcileConnections(
  state: RoomState,
  liveConns: Iterable<string>,
  ctx: Ctx,
): ReduceResult {
  const live = new Set(liveConns);
  const stale = state.participants.flatMap((p) =>
    p.conn !== null && !live.has(p.conn) ? [p.conn] : [],
  );
  let current = state;
  const effects: Effect[] = [];
  for (const conn of stale) {
    const r = reduce(current, { type: 'disconnect', conn }, ctx);
    current = r.state;
    effects.push(...r.effects);
  }
  const r = reduce(current, { type: 'tick' }, ctx);
  effects.push(...r.effects);
  // One broadcast and one alarm at the end are enough (all are projected from the final state).
  const merged: Effect[] = effects.filter(
    (e) => e.type !== 'broadcastState' && e.type !== 'scheduleAlarm',
  );
  if (r.state.closed === null) {
    if (effects.some((e) => e.type === 'broadcastState')) merged.push({ type: 'broadcastState' });
    // Always re-arm: a restarted process has no timer even if the stored alarmAt is unchanged.
    merged.push({ type: 'scheduleAlarm', at: r.state.alarmAt });
  } else if (effects.some((e) => e.type === 'scheduleAlarm')) {
    merged.push({ type: 'scheduleAlarm', at: null });
  }
  return { state: r.state, effects: merged };
}
