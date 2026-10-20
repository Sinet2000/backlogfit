/**
 * The task list ("agenda") a host prepares before a session. It is parsed with the same rules
 * the server applies, handed to the room through sessionStorage (this tab only, never saved in
 * presets) and added by the host's own connection when the room is still empty.
 */
import {
  LINES_PER_ADD_MAX,
  type ParsedTask,
  parseTaskLine,
  type TaskLineError,
  type TaskParseOptions,
} from '@backlogfit/core';
import type { KeyValueStore } from './storage.ts';

export const AGENDA_MAX = 500;

export interface AgendaItem {
  line: string;
  task: ParsedTask | null;
  error: TaskLineError | null;
}

const ERROR_TEXT: Record<TaskLineError, string> = {
  empty: 'Empty line.',
  too_long: 'This line is too long.',
  unsafe_chars: 'Contains characters that are not allowed.',
  invalid_url: 'Not a valid http(s) link.',
  url_not_allowed: 'Links to this domain are not allowed.',
  links_disabled: 'Links are off for this session. Use the task ID instead.',
  title_too_long: 'The title is too long.',
  url_in_title: 'Put the link first, then the title.',
};

export const agendaErrorText = (e: TaskLineError): string => ERROR_TEXT[e];

/** Pasted text → trimmed, non-empty lines. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

export function parseAgenda(lines: readonly string[], opts: TaskParseOptions): AgendaItem[] {
  return lines.map((line) => {
    const r = parseTaskLine(line, opts);
    return r.ok ? { line, task: r.task, error: null } : { line, task: null, error: r.error };
  });
}

/** Moves one entry; out-of-range targets are clamped. Returns a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1) as [T];
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

/** Splits lines into protocol-sized `admin.tasks.add` batches. */
export function batches(lines: readonly string[], size = LINES_PER_ADD_MAX): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

const key = (roomId: string) => `bf:agenda:${roomId}`;

export function savePrepared(store: KeyValueStore, roomId: string, lines: readonly string[]): void {
  if (lines.length === 0) return;
  store.setItem(key(roomId), JSON.stringify(lines.slice(0, AGENDA_MAX)));
}

/** Returns the prepared lines once, then forgets them. */
export function takePrepared(store: KeyValueStore, roomId: string): string[] | null {
  const raw = store.getItem(key(roomId));
  store.removeItem(key(roomId));
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const lines = v.filter((l): l is string => typeof l === 'string').slice(0, AGENDA_MAX);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}
