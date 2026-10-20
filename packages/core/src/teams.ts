import { type Card, indexScale } from './scales.ts';
import { computeStats, type Stats } from './stats.ts';

export const TEAMS_MAX = 6;
export const TEAM_NAME_MAX = 24;
export const TEAM_ID_MAX = 24;
export const TEAM_ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/;

export interface Team {
  id: string;
  name: string;
}

export interface TeamGroup {
  /** null = people without a team. */
  team: string | null;
  count: number;
  /** Display value of the group's median: a number for numeric decks, a card for t-shirt decks. */
  median: string | null;
}

export interface TeamBreakdown {
  /** True when the breakdown is withheld because it would expose a single anonymous vote. */
  hidden: boolean;
  groups: TeamGroup[];
}

/** The `#tag` form of a team name: lower case, without spaces. */
export function teamTag(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

/** A short, URL-safe id derived from a team name, unique among `taken`. */
export function makeTeamId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug =
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16)
      .replace(/-+$/, '') || 'team';
  if (!used.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const id = `${slug}-${n}`;
    if (!used.has(id)) return id;
  }
}

function teamForTag(tag: string, teams: readonly Team[]): Team | undefined {
  const t = tag.toLowerCase();
  return teams.find((x) => teamTag(x.name) === t || x.id.toLowerCase() === t);
}

/**
 * Splits trailing `#team` tags off a pasted task line. Only tags that name one of `teams`
 * count; anything else stays part of the title. Without teams the line is returned unchanged.
 */
export function splitTeamTags(
  line: string,
  teams: readonly Team[],
): { line: string; voters: string[] | null } {
  if (teams.length === 0) return { line, voters: null };
  let rest = line.trimEnd();
  const found: string[] = [];
  for (;;) {
    const m = /(^|\s)#([^\s#]{1,32})$/.exec(rest);
    const team = m ? teamForTag(m[2] ?? '', teams) : undefined;
    if (!m || !team) break;
    found.push(team.id);
    rest = rest.slice(0, m.index).trimEnd();
  }
  if (found.length === 0) return { line, voters: null };
  return { line: rest, voters: teams.flatMap((t) => (found.includes(t.id) ? [t.id] : [])) };
}

/** The line with its team tags replaced by tags for `voters` (null = everyone, no tags). */
export function withTeamTags(
  line: string,
  voters: readonly string[] | null,
  teams: readonly Team[],
): string {
  const base = splitTeamTags(line, teams).line;
  const tags = (voters ?? []).flatMap((id) => {
    const team = teams.find((t) => t.id === id);
    return team ? [`#${teamTag(team.name)}`] : [];
  });
  return tags.length === 0 ? base : `${base} ${tags.join(' ')}`;
}

/** Whether someone may estimate a task: a voter, and in one of its teams if it has any. */
export function canEstimate(
  p: { role: 'voter' | 'spectator'; team?: string | null },
  voters: readonly string[] | null | undefined,
): boolean {
  if (p.role !== 'voter') return false;
  if (voters == null) return true;
  return p.team != null && voters.includes(p.team);
}

/** "Dev, QA" for a voter list; "Everyone" for null. Unknown ids are skipped. */
export function votersLabel(voters: readonly string[] | null, teams: readonly Team[]): string {
  if (voters === null) return 'Everyone';
  const names = voters.flatMap((id) => teams.find((t) => t.id === id)?.name ?? []);
  return names.length === 0 ? 'Everyone' : names.join(', ');
}

export function medianLabel(stats: Stats): string | null {
  const n = stats.median;
  if (n === null) return null;
  if (stats.basis === 'ordinal') return stats.distribution[Math.round(n)]?.value ?? null;
  return String(Math.round(n * 10) / 10);
}

/**
 * Per-team counts and medians of revealed votes, or null when there is nothing to compare
 * (fewer than two groups, or no vote from a team).
 *
 * Privacy: in an anonymous round a group of one would show that person's vote, and with the
 * overall distribution it can also be worked out by subtraction from the other groups. So the
 * whole breakdown is withheld (`hidden`) as soon as any group has a single vote.
 */
export function teamBreakdown(
  votes: readonly { team: string | null; value: string }[],
  teams: readonly Team[],
  scale: readonly Card[],
  anonymous: boolean,
): TeamBreakdown | null {
  const idx = indexScale(scale);
  const known = new Set(teams.map((t) => t.id));
  const byTeam = new Map<string | null, string[]>();
  for (const v of votes) {
    if (!idx.position.has(v.value) && !idx.special.has(v.value)) continue;
    const key = v.team !== null && known.has(v.team) ? v.team : null;
    byTeam.set(key, [...(byTeam.get(key) ?? []), v.value]);
  }
  if (byTeam.size < 2) return null;
  if (anonymous && [...byTeam.values()].some((vs) => vs.length === 1)) {
    return { hidden: true, groups: [] };
  }
  const order = [...teams.map((t) => t.id), null];
  const groups = order.flatMap((team) => {
    const values = byTeam.get(team);
    if (!values) return [];
    return [{ team, count: values.length, median: medianLabel(computeStats(values, scale)) }];
  });
  return { hidden: false, groups };
}
