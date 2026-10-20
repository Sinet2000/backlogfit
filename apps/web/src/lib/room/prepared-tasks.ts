// Tasks a host prepares in the configurator. They are handed to the room through sessionStorage
// only (this tab, never presets, localStorage or the URL) and added by the host's own
// connection once the room is open.
import {
  LINES_PER_ADD_MAX,
  type ParsedTask,
  parseTaskLine,
  splitTeamTags,
  type TaskLineError,
  type TaskParseOptions,
  type Team,
} from '@backlogfit/core';
import { STORAGE_KEYS } from '../storage-keys.ts';
import type { KeyValueStore } from './storage.ts';

export const PREPARED_MAX = 500;

export interface PreparedItem {
  line: string;
  /** Teams from the line's #tags; null = everyone. */
  voters: string[] | null;
  task: ParsedTask | null;
  error: TaskLineError | null;
  shortened: boolean;
}

const ERROR_TEXT: Record<TaskLineError, string> = {
  empty: 'This line is empty.',
  too_long: 'This line is too long.',
  unsafe_chars: 'This line contains characters that are not allowed.',
  invalid_url: 'This is not a valid http(s) link.',
  url_not_allowed: 'Links to this domain are not allowed. Change the link settings below.',
  links_disabled:
    'Links are off for this session. Use the task ID, or change the link settings below.',
  title_too_long: 'The title is too long. Use at most 200 characters.',
  url_in_title: 'Put the link first, then the title.',
};

export const preparedErrorText = (e: TaskLineError): string => ERROR_TEXT[e];

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

export function uniqueLines(text: string): string[] {
  return [...new Set(splitLines(text))].slice(0, PREPARED_MAX);
}

const URL_START = /^https?:\/\/\S+/i;

function wasShortened(line: string, task: ParsedTask): boolean {
  const first = line.match(URL_START)?.[0];
  if (!first) return false;
  try {
    return task.url !== new URL(first).href;
  } catch {
    return false;
  }
}

export function parsePrepared(
  lines: readonly string[],
  opts: TaskParseOptions,
  teams: readonly Team[] = [],
): PreparedItem[] {
  return lines.map((line) => {
    const { line: text, voters } = splitTeamTags(line, teams);
    const r = parseTaskLine(text, opts);
    return r.ok
      ? { line, voters, task: r.task, error: null, shortened: wasShortened(text, r.task) }
      : { line, voters, task: null, error: r.error, shortened: false };
  });
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1) as [T];
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

export function batches(lines: readonly string[], size = LINES_PER_ADD_MAX): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

export function savePrepared(store: KeyValueStore, roomId: string, lines: readonly string[]): void {
  if (lines.length === 0) return;
  store.setItem(STORAGE_KEYS.preparedTasks(roomId), JSON.stringify(lines.slice(0, PREPARED_MAX)));
}

export function readPrepared(store: KeyValueStore, roomId: string): string[] | null {
  const raw = store.getItem(STORAGE_KEYS.preparedTasks(roomId));
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const lines = v.filter((l): l is string => typeof l === 'string').slice(0, PREPARED_MAX);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

export function clearPrepared(store: KeyValueStore, roomId: string): void {
  store.removeItem(STORAGE_KEYS.preparedTasks(roomId));
}
