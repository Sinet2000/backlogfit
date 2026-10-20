/**
 * Export builders. They take a projected RoomView, so they can only ever contain what the viewer
 * was allowed to see: unrevealed rounds have no values and anonymous rounds have no names.
 */
import type { RoomView, RoundView, TaskView } from './schemas.ts';
import type { Stats } from './stats.ts';
import { type TeamBreakdown, votersLabel } from './teams.ts';

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

type Teams = RoomView['config']['teams'];

function teamName(id: string | null, teams: Teams): string {
  if (id === null) return 'No team';
  return teams.find((t) => t.id === id)?.name ?? 'No team';
}

/** "Dev 5 (4 votes) · QA 3 (2 votes)", or a note when the breakdown is withheld. */
export function teamBreakdownText(breakdown: TeamBreakdown | null, teams: Teams): string {
  if (breakdown === null) return '';
  if (breakdown.hidden) return 'hidden to keep votes anonymous';
  return breakdown.groups
    .map(
      (g) =>
        `${teamName(g.team, teams)} ${g.median ?? '–'} (${g.count} ${g.count === 1 ? 'vote' : 'votes'})`,
    )
    .join(' · ');
}

/**
 * One row per revealed vote (long format), plus one row for tasks without revealed votes.
 * Rooms with teams get three more columns: who estimates the task, the voter's team (empty in
 * anonymous rounds) and the per-team summary.
 */
export function toCsv(view: RoomView): string {
  const teams = view.config.teams;
  const withTeams = teams.length > 0;
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
    ...(withTeams ? ['estimated_by', 'participant_team', 'team_summary'] : []),
  ];
  const rows: (string | number | null)[][] = [header];
  for (const task of view.tasks) {
    const head = [task.key, task.title, task.url, task.final];
    const by = votersLabel(task.voters, teams);
    const rounds = revealedRounds(task);
    if (rounds.length === 0) {
      rows.push([
        ...head,
        null,
        null,
        null,
        null,
        null,
        null,
        ...(withTeams ? [by, null, null] : []),
      ]);
    }
    for (const r of rounds) {
      const tail = [
        statLabel(r.stats, 'median'),
        statLabel(r.stats, 'average'),
        r.stats?.consensus ?? null,
      ];
      const summary = teamBreakdownText(r.teams, teams) || null;
      const extra = (team: string | null) => (withTeams ? [by, team, summary] : []);
      const votes = r.votes ?? [];
      if (votes.length === 0) rows.push([...head, r.n, null, null, ...tail, ...extra(null)]);
      for (const v of votes) {
        const team = r.anonymous || v.team === null ? null : teamName(v.team, teams);
        rows.push([...head, r.n, r.anonymous ? null : v.name, v.value, ...tail, ...extra(team)]);
      }
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export interface JsonExport {
  format: 'backlogfit-export';
  v: 1;
  generatedAt: string | null;
  scale: { value: string; label: string }[];
  /** Present only for rooms with teams. */
  teams?: { id: string; name: string }[];
  tasks: {
    key: string | null;
    title: string | null;
    url: string | null;
    final: string | null;
    /** Team ids; null = everyone. Present only for rooms with teams. */
    voters?: string[] | null;
    rounds: {
      n: number;
      anonymous: boolean;
      votes: { name: string | null; team?: string | null; value: string }[];
      stats: Stats | null;
      teams?: TeamBreakdown | null;
    }[];
  }[];
}

export function toJson(view: RoomView, opts: ExportOptions = {}): string {
  const withTeams = view.config.teams.length > 0;
  const data: JsonExport = {
    format: 'backlogfit-export',
    v: 1,
    generatedAt: opts.generatedAt ?? null,
    scale: view.config.scale.map((c) => ({ value: c.value, label: c.label })),
    ...(withTeams ? { teams: view.config.teams.map((t) => ({ id: t.id, name: t.name })) } : {}),
    tasks: view.tasks.map((t) => ({
      key: t.key,
      title: t.title,
      url: t.url,
      final: t.final,
      ...(withTeams ? { voters: t.voters } : {}),
      rounds: revealedRounds(t).map((r) => ({
        n: r.n,
        anonymous: r.anonymous,
        votes: (r.votes ?? []).map((v) => ({
          name: r.anonymous ? null : v.name,
          ...(withTeams ? { team: r.anonymous ? null : v.team } : {}),
          value: v.value,
        })),
        stats: r.stats,
        ...(withTeams ? { teams: r.teams } : {}),
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
  const teams = view.config.teams;
  const withTeams = teams.length > 0;
  const lines = withTeams
    ? [
        '| Task | Title | Estimated by | Final | Rounds | Votes | Median | Consensus | By team |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ]
    : [
        '| Task | Title | Final | Rounds | Votes | Median | Consensus |',
        '| --- | --- | --- | --- | --- | --- | --- |',
      ];
  for (const t of view.tasks) {
    const r = lastRevealed(t);
    const cells = [
      mdCell(t.key),
      mdCell(t.title),
      ...(withTeams ? [mdCell(votersLabel(t.voters, teams))] : []),
      mdCell(t.final),
      String(revealedRounds(t).length),
      mdCell(r ? voteSummary(r) : null),
      mdCell(r ? statLabel(r.stats, 'median') : null),
      r?.stats?.consensus ?? '',
      ...(withTeams ? [mdCell(r ? teamBreakdownText(r.teams, teams) : null)] : []),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** Plain text for pasting into a ticket comment. Pass a taskId for a single task. */
export function toSummary(view: RoomView, taskId?: string): string {
  const tasks = taskId === undefined ? view.tasks : view.tasks.filter((t) => t.id === taskId);
  return tasks
    .map((t) => {
      const parts = [taskLabel(t)];
      if (t.voters !== null)
        parts.push(`Estimated by: ${votersLabel(t.voters, view.config.teams)}`);
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
        const byTeam = teamBreakdownText(r.teams, view.config.teams);
        if (byTeam !== '') parts.push(`By team: ${byTeam}`);
        if (!r.anonymous) {
          parts.push(`Votes: ${(r.votes ?? []).map((v) => `${v.name} ${v.value}`).join(', ')}`);
        }
      }
      if (t.url) parts.push(t.url);
      return parts.join('\n');
    })
    .join('\n\n');
}
