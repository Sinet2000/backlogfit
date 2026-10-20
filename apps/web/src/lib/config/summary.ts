import type { Draft } from './draft.ts';
import { hoursLabel, timerLabel } from './rules.ts';

export const POLICY_NAMES: Record<Draft['taskPolicy'], string> = {
  ids: 'IDs only',
  links: 'Links allowed',
  allowlist: 'Only these domains',
};

export const POLICY_HINTS: Record<Draft['taskPolicy'], string> = {
  ids: 'Only task IDs like SCP-3655 are stored. Pasted links are shortened to their ID.',
  links: 'People can add full links to any website. Links open in a new tab.',
  allowlist: 'Links are allowed only to the domains you list, for example your company tracker.',
};

export function linksSummary(d: Draft): string {
  const policy =
    d.taskPolicy === 'allowlist' ? `Only ${d.allowlist.join(', ')}` : POLICY_NAMES[d.taskPolicy];
  return d.linkTemplate ? `${policy}, IDs link to ${d.linkTemplate}` : policy;
}

export function teamsSummary(d: Pick<Draft, 'teams'>): string {
  if (d.teams.length === 0) return 'No teams. Everyone estimates every task.';
  return `${d.teams.map((t) => t.name).join(', ')}, each with its own join link`;
}

export function lengthSummary(d: Draft): string {
  return `${hoursLabel(d.lifetimeHours)}, then everything is deleted`;
}

export function revealSummary(d: Draft): string {
  const when = d.autoReveal ? 'Automatically when everyone has voted' : 'When you press Reveal';
  return `${when}, ${d.anonymousAfterReveal ? 'without names' : 'with names'}`;
}

export function accessSummary(
  d: Pick<Draft, 'lobby' | 'passcode' | 'allowSpectators' | 'maxParticipants'>,
): string {
  return [
    d.lobby ? 'You approve each person' : 'Anyone with the link',
    d.passcode ? 'passcode required' : null,
    d.allowSpectators ? 'spectators allowed' : 'no spectators',
    `up to ${d.maxParticipants}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function timerSummary(d: Draft): string {
  return timerLabel(d.timerSeconds);
}

export function tasksSummary(valid: number, skipped: number): string {
  if (valid === 0) return 'None prepared. You can add tasks in the room.';
  const base = `${valid} prepared, added when you open the room in this tab`;
  return skipped > 0 ? `${base} (${skipped} ${skipped === 1 ? 'line' : 'lines'} skipped)` : base;
}
