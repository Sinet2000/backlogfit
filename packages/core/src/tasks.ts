import { cleanText, hasUnsafeChars } from './text.ts';

export type TaskPolicy = 'ids' | 'links' | 'allowlist';

export const TASK_TITLE_MAX = 200;
export const TASK_KEY_MAX = 64;
export const URL_MAX = 2048;
export const TASK_LINE_MAX = 2400;
export const ID_PATTERN_MAX = 100;
export const ALLOWLIST_MAX = 50;

/** Jira-style keys (PROJ-123). Matched case-insensitively; the key is upper-cased. */
export const DEFAULT_ID_PATTERN = '[A-Z][A-Z0-9_]{0,15}-[0-9]{1,9}';

export interface TaskParseOptions {
  policy: TaskPolicy;
  /** Normalized hostnames (see normalizeAllowlistEntry). Subdomains are allowed. */
  allowlist?: readonly string[];
  idPattern?: string | null;
  /** e.g. https://tracker.example/browse/{id} */
  linkTemplate?: string | null;
}

export interface ParsedTask {
  key: string | null;
  title: string | null;
  url: string | null;
}

export type TaskLineError =
  | 'empty'
  | 'too_long'
  | 'unsafe_chars'
  | 'invalid_url'
  | 'url_not_allowed'
  | 'links_disabled'
  | 'title_too_long'
  | 'url_in_title';

export type TaskLineResult = { ok: true; task: ParsedTask } | { ok: false; error: TaskLineError };

/**
 * Admin-supplied ID patterns run on the server, so they are restricted to a subset that cannot
 * backtrack catastrophically: no lookaround, no backreferences, no quantified groups. Inputs
 * tested against them are also capped at TASK_KEY_MAX characters.
 */
export function isSafeIdPattern(pattern: string): boolean {
  if (pattern.length < 1 || pattern.length > ID_PATTERN_MAX) return false;
  if (/\(\?[=!<]/.test(pattern)) return false;
  if (/\\[1-9k]/.test(pattern)) return false;
  if (/\)[*+?{]/.test(pattern)) return false;
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

/** Anchored matcher for an ID pattern, or null if the pattern is unsafe/invalid. */
export function compileIdPattern(pattern: string | null | undefined): RegExp | null {
  if (pattern == null || pattern === '') return new RegExp(`^(?:${DEFAULT_ID_PATTERN})$`, 'iu');
  if (!isSafeIdPattern(pattern)) return null;
  return new RegExp(`^(?:${pattern})$`, 'u');
}

function matchKey(re: RegExp, token: string, isDefault: boolean): string | null {
  if (token.length > TASK_KEY_MAX || !re.test(token)) return null;
  return isDefault ? token.toUpperCase() : token;
}

/** Lower-case punycode hostname for an allowlist entry like "Jira.Example.com", or null. */
export function normalizeAllowlistEntry(entry: string): string | null {
  const e = entry.trim().replace(/\.$/, '');
  if (e.length < 1 || e.length > 253 || /[/:@?#\\\s*]/.test(e)) return null;
  try {
    const host = new URL(`https://${e}`).hostname;
    return host.includes('.') || host === 'localhost' ? host : null;
  } catch {
    return null;
  }
}

export function hostAllowed(hostname: string, allowlist: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowlist.some((d) => host === d || host.endsWith(`.${d}`));
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: TaskLineError };

/** http(s) only, no credentials, no IDN hosts unless explicitly allowlisted. */
export function checkUrl(raw: string, policy: TaskPolicy, allowlist: readonly string[]): UrlCheck {
  if (raw.length > URL_MAX) return { ok: false, error: 'too_long' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return { ok: false, error: 'invalid_url' };
  if (url.username !== '' || url.password !== '' || url.hostname === '') {
    return { ok: false, error: 'invalid_url' };
  }
  if (url.href.length > URL_MAX) return { ok: false, error: 'too_long' };
  if (policy === 'ids') return { ok: false, error: 'links_disabled' };
  if (policy === 'allowlist') {
    if (!hostAllowed(url.hostname, allowlist)) return { ok: false, error: 'url_not_allowed' };
  } else if (url.hostname.split('.').some((label) => label.startsWith('xn--'))) {
    // Open link policy: refuse internationalized hosts (homograph lookalikes).
    return { ok: false, error: 'url_not_allowed' };
  }
  return { ok: true, url };
}

/** A link template must contain {id} exactly once and resolve to an acceptable URL. */
export function validateLinkTemplate(
  template: string,
  policy: TaskPolicy,
  allowlist: readonly string[],
): boolean {
  if (template.length > URL_MAX || template.split('{id}').length !== 2) return false;
  const probe = checkUrl(
    template.replace('{id}', 'X-1'),
    policy === 'ids' ? 'links' : policy,
    allowlist,
  );
  return probe.ok;
}

export function linkFor(template: string, key: string): string {
  return template.replace('{id}', encodeURIComponent(key));
}

const URLISH = /^[a-z][a-z0-9+.-]*:\/\//i;
const DANGEROUS_SCHEME = /^(javascript|data|vbscript|file|blob|about):/i;

function cleanTitle(
  raw: string,
): { ok: true; title: string | null } | { ok: false; error: TaskLineError } {
  const title = raw.trim();
  if (title === '') return { ok: true, title: null };
  if (title.length > TASK_TITLE_MAX) return { ok: false, error: 'title_too_long' };
  if (title.includes('://')) return { ok: false, error: 'url_in_title' };
  return { ok: true, title };
}

function keyFromUrl(url: URL, re: RegExp, isDefault: boolean): string | null {
  const segments = url.pathname.split('/').filter((s) => s !== '');
  const last = segments[segments.length - 1];
  if (last === undefined) return null;
  try {
    return matchKey(re, decodeURIComponent(last), isDefault);
  } catch {
    return null;
  }
}

/**
 * Parse one pasted backlog line: "SCP-3655", "SCP-3655 Fix login", "https://…", "https://… title",
 * or a plain title.
 *
 * Under the 'ids' policy a URL is never stored. If its last path segment is clearly an ID
 * (matches the ID pattern) the key is kept and, with a link template, the URL is re-derived from
 * the template; otherwise the line is rejected with 'links_disabled'.
 */
export function parseTaskLine(line: string, opts: TaskParseOptions): TaskLineResult {
  if (line.length > TASK_LINE_MAX) return { ok: false, error: 'too_long' };
  const text = cleanText(line);
  if (text === '') return { ok: false, error: 'empty' };
  if (hasUnsafeChars(text)) return { ok: false, error: 'unsafe_chars' };

  const isDefault = opts.idPattern == null || opts.idPattern === '';
  const re = compileIdPattern(opts.idPattern);
  const allowlist = opts.allowlist ?? [];
  const template = opts.linkTemplate ?? null;
  const space = text.search(/\s/);
  const first = space === -1 ? text : text.slice(0, space);
  const rest = space === -1 ? '' : text.slice(space + 1);

  if (DANGEROUS_SCHEME.test(first)) return { ok: false, error: 'invalid_url' };

  if (URLISH.test(first)) {
    const t = cleanTitle(rest);
    if (!t.ok) return t;
    const checked = checkUrl(first, opts.policy, allowlist);
    if (!checked.ok) {
      if (checked.error !== 'links_disabled' || re === null) return checked;
      let parsed: URL;
      try {
        parsed = new URL(first);
      } catch {
        return { ok: false, error: 'invalid_url' };
      }
      const key = keyFromUrl(parsed, re, isDefault);
      if (key === null) return checked;
      return {
        ok: true,
        task: { key, title: t.title, url: template ? linkFor(template, key) : null },
      };
    }
    const key = re ? keyFromUrl(checked.url, re, isDefault) : null;
    return { ok: true, task: { key, title: t.title, url: checked.url.href } };
  }

  const key = re ? matchKey(re, first, isDefault) : null;
  if (key !== null) {
    const t = cleanTitle(rest);
    if (!t.ok) return t;
    return {
      ok: true,
      task: { key, title: t.title, url: template ? linkFor(template, key) : null },
    };
  }

  const t = cleanTitle(text);
  if (!t.ok) return t;
  return { ok: true, task: { key: null, title: t.title, url: null } };
}
