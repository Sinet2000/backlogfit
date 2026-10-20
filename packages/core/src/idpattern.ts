/**
 * Ticket-ID patterns without a regex engine (SEC-001).
 *
 * Admin-supplied patterns run on the server for every pasted line, so they are never handed to
 * RegExp. A pattern is a flat sequence of atoms, each optionally quantified:
 *
 *   atom       literal character, `.`, `\d`, `\w`, `\` + punctuation, or `[...]` class
 *              (ranges `a-z`, negation `[^...]`, escapes `\d \w \] \\ \-` inside)
 *   quantifier `?` `*` `+` `{n}` `{n,}` `{n,m}` (n ≤ m ≤ 64; unbounded means 64)
 *
 * No groups, alternation, anchors (matching is always whole-token), lookaround or backrefs.
 * Matching is a set-of-positions simulation: O(atoms × len²) with len ≤ 64, independent of how
 * quantifiers overlap. On top, a pattern has at most ID_PATTERN_MAX_ATOMS atoms and at most
 * ID_PATTERN_MAX_QUANTIFIED quantified ones, so even the budget is tiny.
 */

export const ID_PATTERN_MAX_LENGTH = 100;
export const ID_PATTERN_MAX_ATOMS = 24;
export const ID_PATTERN_MAX_QUANTIFIED = 6;
/** Longest token an ID pattern is ever matched against. */
export const ID_MATCH_MAX_INPUT = 64;

type Range = readonly [number, number];

interface Atom {
  ranges: Range[];
  negated: boolean;
  any: boolean;
  min: number;
  max: number;
}

export interface IdMatcher {
  readonly source: string;
  readonly ignoreCase: boolean;
  /** Whole-token match. Tokens longer than ID_MATCH_MAX_INPUT never match. */
  test(token: string): boolean;
}

const DIGIT: Range = [0x30, 0x39];
const WORD: Range[] = [DIGIT, [0x41, 0x5a], [0x61, 0x7a], [0x5f, 0x5f]];
const META = new Set([...'()|^$*+?{}[]\\.']);
const ESCAPABLE = /^[!-/:-@[-`{-~]$/;

function cp(c: string): number {
  return c.codePointAt(0) ?? 0;
}

/** Parse a pattern into atoms, or null if it is outside the language or over budget. */
function parse(pattern: string): Atom[] | null {
  if (pattern.length < 1 || pattern.length > ID_PATTERN_MAX_LENGTH) return null;
  const s = [...pattern];
  const atoms: Atom[] = [];
  let i = 0;

  const escaped = (c: string | undefined): Range[] | null => {
    if (c === 'd') return [DIGIT];
    if (c === 'w') return [...WORD];
    if (c !== undefined && ESCAPABLE.test(c)) return [[cp(c), cp(c)]];
    return null;
  };

  while (i < s.length) {
    const c = s[i] as string;
    let atom: Atom;
    if (c === '[') {
      i++;
      const negated = s[i] === '^';
      if (negated) i++;
      const ranges: Range[] = [];
      let closed = false;
      while (i < s.length) {
        let ch = s[i] as string;
        if (ch === ']' && ranges.length > 0) {
          closed = true;
          i++;
          break;
        }
        let lo: number;
        if (ch === '\\') {
          const e = escaped(s[i + 1]);
          if (e === null) return null;
          i += 2;
          if (e.length !== 1 || e[0]?.[0] !== e[0]?.[1]) {
            ranges.push(...e);
            continue;
          }
          lo = e[0]?.[0] ?? 0;
        } else {
          if (ch === '[' || ch === ']') return null;
          lo = cp(ch);
          i++;
        }
        if (s[i] === '-' && s[i + 1] !== undefined && s[i + 1] !== ']') {
          ch = s[i + 1] as string;
          if (ch === '\\' || ch === '[') return null;
          const hi = cp(ch);
          if (hi < lo) return null;
          ranges.push([lo, hi]);
          i += 2;
        } else {
          ranges.push([lo, lo]);
        }
      }
      if (!closed) return null;
      atom = { ranges, negated, any: false, min: 1, max: 1 };
    } else if (c === '\\') {
      const e = escaped(s[i + 1]);
      if (e === null) return null;
      atom = { ranges: e, negated: false, any: false, min: 1, max: 1 };
      i += 2;
    } else if (c === '.') {
      atom = { ranges: [], negated: false, any: true, min: 1, max: 1 };
      i++;
    } else if (META.has(c) || cp(c) < 0x20 || /\s/u.test(c)) {
      return null;
    } else {
      atom = { ranges: [[cp(c), cp(c)]], negated: false, any: false, min: 1, max: 1 };
      i++;
    }

    const q = s[i];
    if (q === '?' || q === '*' || q === '+') {
      atom.min = q === '+' ? 1 : 0;
      atom.max = q === '?' ? 1 : ID_MATCH_MAX_INPUT;
      i++;
    } else if (q === '{') {
      const close = s.indexOf('}', i);
      if (close === -1) return null;
      const m = /^(\d{1,2})(,(\d{0,2}))?$/.exec(s.slice(i + 1, close).join(''));
      if (!m) return null;
      const min = Number(m[1]);
      const max = m[2] === undefined ? min : m[3] === '' ? ID_MATCH_MAX_INPUT : Number(m[3]);
      if (min > max || max > ID_MATCH_MAX_INPUT || max === 0) return null;
      atom.min = min;
      atom.max = max;
      i = close + 1;
    }
    const next = s[i];
    if (next === '?' || next === '*' || next === '+' || next === '{') return null;
    atoms.push(atom);
  }

  if (atoms.length > ID_PATTERN_MAX_ATOMS) return null;
  if (atoms.filter((a) => a.min !== 1 || a.max !== 1).length > ID_PATTERN_MAX_QUANTIFIED) {
    return null;
  }
  return atoms;
}

function inRanges(c: number, ranges: readonly Range[]): boolean {
  return ranges.some(([lo, hi]) => c >= lo && c <= hi);
}

function accepts(atom: Atom, ch: string, ignoreCase: boolean): boolean {
  if (atom.any) return true;
  let hit = inRanges(cp(ch), atom.ranges);
  if (!hit && ignoreCase) {
    hit =
      inRanges(cp(ch.toLowerCase()), atom.ranges) || inRanges(cp(ch.toUpperCase()), atom.ranges);
  }
  return hit !== atom.negated;
}

function matches(atoms: readonly Atom[], token: string, ignoreCase: boolean): boolean {
  if (token.length > ID_MATCH_MAX_INPUT) return false;
  const chars = [...token];
  const n = chars.length;
  // reach[i] = the first `k` atoms can consume exactly chars[0..i).
  let reach = new Uint8Array(n + 1);
  reach[0] = 1;
  for (const atom of atoms) {
    const next = new Uint8Array(n + 1);
    for (let i = 0; i <= n; i++) {
      if (!reach[i]) continue;
      for (let k = 0; k <= atom.max && i + k <= n; k++) {
        if (k >= atom.min) next[i + k] = 1;
        if (k === atom.max || i + k === n || !accepts(atom, chars[i + k] as string, ignoreCase)) {
          break;
        }
      }
    }
    reach = next;
  }
  return reach[n] === 1;
}

/** Compile a pattern; null if it is not in the supported language. */
export function compileIdMatcher(pattern: string, ignoreCase = false): IdMatcher | null {
  const atoms = parse(pattern);
  if (atoms === null) return null;
  return {
    source: pattern,
    ignoreCase,
    test: (token) => matches(atoms, token, ignoreCase),
  };
}

export function isValidIdPattern(pattern: string): boolean {
  return parse(pattern) !== null;
}
