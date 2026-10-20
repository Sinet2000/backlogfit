/** Helpers that keep backend adapters thin and uniform. */
import { randomToken, secretsOf, verifyHello } from './crypto.ts';
import { project } from './project.ts';
import type { ClientMessage, CloseReason, ServerMessage } from './schemas.ts';
import type { Effect, RoomEvent, RoomState } from './state.ts';

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
