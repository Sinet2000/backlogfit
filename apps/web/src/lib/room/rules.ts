import type { ParticipantView, TaskView } from '@backlogfit/core';

export type Authority = 'admin' | 'coadmin' | 'none';

export interface Actor {
  id: string | null;
  authority: Authority;
}

export type RoomAction =
  | 'facilitate'
  | 'lock'
  | 'settings'
  | 'extend'
  | 'close'
  | 'kick'
  | 'promote'
  | 'demote';

type Target = Pick<ParticipantView, 'id' | 'authority'>;

/** Mirrors the server's rules so the UI only offers what the server will accept. */
export function can(actor: Actor, action: RoomAction, target?: Target): boolean {
  const facilitator = actor.authority === 'admin' || actor.authority === 'coadmin';
  const host = actor.authority === 'admin';
  switch (action) {
    case 'facilitate':
    case 'lock':
      return facilitator;
    case 'settings':
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
  }
}

/** The task Next opens: the first unestimated one after the current task, wrapping around. */
export function nextTaskId(tasks: readonly TaskView[], currentId: string | null): string | null {
  const start = tasks.findIndex((t) => t.id === currentId);
  const ordered = [...tasks.slice(start + 1), ...tasks.slice(0, Math.max(start, 0))];
  return ordered.find((t) => t.final === null)?.id ?? null;
}
