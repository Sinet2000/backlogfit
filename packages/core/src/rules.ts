/**
 * Who may do what, as plain functions over ids and authorities, so the reducer and every client
 * share one definition. Clients use them to offer only what the server accepts.
 */
import type { Authority } from './state.ts';

export interface Actor {
  id: string | null;
  authority: Authority;
}

export interface ActionTarget {
  id: string;
  authority: Authority;
}

export type RoomAction =
  | 'facilitate'
  | 'lock'
  | 'settings'
  | 'teams'
  | 'extend'
  | 'close'
  | 'kick'
  | 'promote'
  | 'demote'
  | 'manage';

export function can(actor: Actor, action: RoomAction, target?: ActionTarget): boolean {
  const facilitator = actor.authority === 'admin' || actor.authority === 'coadmin';
  const host = actor.authority === 'admin';
  switch (action) {
    case 'facilitate':
    case 'lock':
      return facilitator;
    case 'settings':
    case 'teams':
    case 'extend':
    case 'close':
      return host;
    case 'kick':
      if (!target || target.id === actor.id || target.authority === 'admin') return false;
      return host || (facilitator && target.authority === 'none');
    case 'promote':
      return host && !!target && target.id !== actor.id && target.authority === 'none';
    case 'demote':
      return host && !!target && target.id !== actor.id && target.authority === 'coadmin';
    case 'manage':
      if (!target) return false;
      if (host) return true;
      return facilitator && (target.id === actor.id || target.authority === 'none');
  }
}

/**
 * The task `admin.next` opens: the first one without a final estimate after the current task,
 * wrapping around. Works on RoomState and RoomView alike.
 */
export function nextTaskId(room: {
  tasks: readonly { id: string; final: string | null }[];
  currentTaskId: string | null;
}): string | null {
  const { tasks } = room;
  const start = tasks.findIndex((t) => t.id === room.currentTaskId);
  const ordered = [...tasks.slice(start + 1), ...tasks.slice(0, Math.max(start, 0))];
  return ordered.find((t) => t.final === null)?.id ?? null;
}
