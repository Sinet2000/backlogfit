/**
 * Export builders. They take a projected RoomView, so they can only ever contain what the viewer
 * was allowed to see: unrevealed rounds have no values and anonymous rounds have no names.
 */
import type { RoomView, RoundView, TaskView } from './schemas.ts';
import type { Stats } from './stats.ts';

export interface ExportOptions {
  generatedAt?: string;
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** RFC 4180 quoting plus spreadsheet formula-injection neutralization. */
export function csvCell(value: string | number | null): string {
  let s = value === null ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function revealedRounds(task: TaskView): RoundView[] {
  return task.rounds.filter((r) => r.revealed);
}

function lastRevealed(task: TaskView): RoundView | null {
  const rs = revealedRounds(task);
  return rs[rs.length - 1] ?? null;
}

function fmt(n: number | null): string {
  if (n === null) return '';
  return String(Math.round(n * 100) / 100);
}

function taskLabel(task: TaskView): string {
  return [task.key, task.title].filter((x) => x !== null && x !== '').join(' ') || 'Untitled task';
}

function voteSummary(round: RoundView): string {
  const counts = new Map<string, number>();
  for (const v of round.votes ?? []) counts.set(v.value, (counts.get(v.value) ?? 0) + 1);
  return [...counts].map(([value, n]) => `${n}×${value}`).join(', ');
}

function statLabel(stats: Stats | null, basis: 'median' | 'average'): string {
  if (!stats) return '';
  const n = stats[basis];
  if (stats.basis === 'ordinal') {
    if (n === null) return '';
    return stats.distribution[Math.round(n)]?.value ?? '';
  }
  return fmt(n);
}

/** One row per revealed vote (long format), plus one row for tasks without revealed votes. */
export function toCsv(view: RoomView): string {
  const header = [
    'task_key',
    'task_title',
    'task_url',
    'final',
    'round',
    'participant',
    'vote',
    'median',
    'average',
    'consensus',
  ];
  const rows: (string | number | null)[][] = [header];
  for (const task of view.tasks) {
    const head = [task.key, task.title, task.url, task.final];
    const rounds = revealedRounds(task);
    if (rounds.length === 0) rows.push([...head, null, null, null, null, null, null]);
    for (const r of rounds) {
      const tail = [
        statLabel(r.stats, 'median'),
        statLabel(r.stats, 'average'),
        r.stats?.consensus ?? null,
      ];
      const votes = r.votes ?? [];
      if (votes.length === 0) rows.push([...head, r.n, null, null, ...tail]);
      for (const v of votes)
        rows.push([...head, r.n, r.anonymous ? null : v.name, v.value, ...tail]);
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export interface JsonExport {
  format: 'backlogfit-export';
  v: 1;
  generatedAt: string | null;
  scale: { value: string; label: string }[];
  tasks: {
    key: string | null;
    title: string | null;
    url: string | null;
    final: string | null;
    rounds: {
      n: number;
      anonymous: boolean;
      votes: { name: string | null; value: string }[];
      stats: Stats | null;
    }[];
  }[];
}

export function toJson(view: RoomView, opts: ExportOptions = {}): string {
  const data: JsonExport = {
    format: 'backlogfit-export',
    v: 1,
    generatedAt: opts.generatedAt ?? null,
    scale: view.config.scale.map((c) => ({ value: c.value, label: c.label })),
    tasks: view.tasks.map((t) => ({
      key: t.key,
      title: t.title,
      url: t.url,
      final: t.final,
      rounds: revealedRounds(t).map((r) => ({
        n: r.n,
        anonymous: r.anonymous,
        votes: (r.votes ?? []).map((v) => ({ name: r.anonymous ? null : v.name, value: v.value })),
        stats: r.stats,
      })),
    })),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Escape text for a Markdown table cell (no links, emphasis, HTML or row breaks survive). */
export function mdCell(s: string | null): string {
  if (s === null || s === '') return '';
  return s.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, (c) => `\\${c}`);
}

export function toMarkdown(view: RoomView): string {
  const lines = [
    '| Task | Title | Final | Rounds | Votes | Median | Consensus |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const t of view.tasks) {
    const r = lastRevealed(t);
    lines.push(
      `| ${[
        mdCell(t.key),
        mdCell(t.title),
        mdCell(t.final),
        String(revealedRounds(t).length),
        mdCell(r ? voteSummary(r) : null),
        mdCell(r ? statLabel(r.stats, 'median') : null),
        r?.stats?.consensus ?? '',
      ].join(' | ')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Plain text for pasting into a ticket comment. Pass a taskId for a single task. */
export function toSummary(view: RoomView, taskId?: string): string {
  const tasks = taskId === undefined ? view.tasks : view.tasks.filter((t) => t.id === taskId);
  return tasks
    .map((t) => {
      const parts = [taskLabel(t)];
      if (t.final !== null) parts.push(`Final estimate: ${t.final}`);
      const r = lastRevealed(t);
      if (r) {
        const s = r.stats;
        parts.push(`Round ${r.n}: ${voteSummary(r) || 'no votes'}`);
        if (s && s.median !== null) {
          parts.push(
            `Median ${statLabel(s, 'median')}, range ${s.min}–${s.max}, consensus ${s.consensus}`,
          );
        }
        const special = s?.special.filter((x) => x.count > 0) ?? [];
        if (special.length > 0)
          parts.push(`Other: ${special.map((x) => `${x.count}×${x.value}`).join(', ')}`);
        if (!r.anonymous) {
          parts.push(`Votes: ${(r.votes ?? []).map((v) => `${v.name} ${v.value}`).join(', ')}`);
        }
      }
      if (t.url) parts.push(t.url);
      return parts.join('\n');
    })
    .join('\n\n');
}
