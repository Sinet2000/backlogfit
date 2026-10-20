import { describe, expect, it } from 'vitest';
import {
  checkUrl,
  compileIdPattern,
  hostAllowed,
  isSafeIdPattern,
  linkFor,
  normalizeAllowlistEntry,
  parseTaskLine,
  type TaskParseOptions,
  validateLinkTemplate,
} from '../src/index.ts';

const ids: TaskParseOptions = { policy: 'ids' };
const links: TaskParseOptions = { policy: 'links' };
const allow: TaskParseOptions = { policy: 'allowlist', allowlist: ['jira.example.com'] };

const ok = (line: string, opts: TaskParseOptions) => {
  const r = parseTaskLine(line, opts);
  if (!r.ok) throw new Error(`${line}: ${r.error}`);
  return r.task;
};
const err = (line: string, opts: TaskParseOptions) => {
  const r = parseTaskLine(line, opts);
  return r.ok ? null : r.error;
};

describe('parseTaskLine', () => {
  it('parses ids, id + title and plain titles', () => {
    expect(ok('SCP-3655', ids)).toEqual({ key: 'SCP-3655', title: null, url: null });
    expect(ok('scp-3655   Fix login ', ids)).toEqual({
      key: 'SCP-3655',
      title: 'Fix login',
      url: null,
    });
    expect(ok('Refactor the thing', ids)).toEqual({
      key: null,
      title: 'Refactor the thing',
      url: null,
    });
    expect(ok('Fix: login', ids).title).toBe('Fix: login');
  });

  it('derives links from a template with the key URL-encoded', () => {
    const t = { ...ids, linkTemplate: 'https://tracker.example/browse/{id}' };
    expect(ok('SCP-1 Title', t).url).toBe('https://tracker.example/browse/SCP-1');
    const custom = { ...t, idPattern: '[A-Z]+#[0-9]+' };
    expect(ok('AB#12', custom)).toEqual({
      key: 'AB#12',
      title: null,
      url: 'https://tracker.example/browse/AB%2312',
    });
    expect(linkFor('https://x/{id}', 'a/b?c')).toBe('https://x/a%2Fb%3Fc');
  });

  it('handles URLs per policy', () => {
    expect(ok('https://anything.example/browse/SCP-9 Title here', links)).toEqual({
      key: 'SCP-9',
      title: 'Title here',
      url: 'https://anything.example/browse/SCP-9',
    });
    expect(ok('https://anything.example/', links)).toEqual({
      key: null,
      title: null,
      url: 'https://anything.example/',
    });
    expect(ok('https://jira.example.com/browse/SCP-9', ids)).toEqual({
      key: 'SCP-9',
      title: null,
      url: null,
    });
    expect(err('https://jira.example.com/wiki/page', ids)).toBe('links_disabled');
    expect(ok('https://sub.jira.example.com/browse/X-1', allow).url).toBe(
      'https://sub.jira.example.com/browse/X-1',
    );
    expect(err('https://jira.example.com.evil.net/x', allow)).toBe('url_not_allowed');
    expect(err('https://evilјira.example.com/x', allow)).toBe('url_not_allowed');
  });

  it('rejects dangerous or malformed input', () => {
    expect(err('javascript:alert(1)', links)).toBe('invalid_url');
    expect(err('JaVaScRiPt:alert(1)', ids)).toBe('invalid_url');
    expect(err('data:text/html,<b>', links)).toBe('invalid_url');
    expect(err('ftp://x.example/', links)).toBe('invalid_url');
    expect(err('https://user:pw@x.example/', links)).toBe('invalid_url');
    expect(err('https://[::1', links)).toBe('invalid_url');
    expect(err('https://раураl.com/', links)).toBe('url_not_allowed');
    expect(err(`https://x.example/${'a'.repeat(2100)}`, links)).toBe('too_long');
    expect(err('x'.repeat(2401), links)).toBe('too_long');
    expect(err('   ', links)).toBe('empty');
    expect(err('Title‮', links)).toBe('unsafe_chars');
    expect(err('a'.repeat(201), links)).toBe('title_too_long');
    expect(err('SCP-1 see https://evil.example', ids)).toBe('url_in_title');
    expect(err('https://x.example/ also https://y.example', links)).toBe('url_in_title');
    expect(err('Look at https://evil.example', ids)).toBe('url_in_title');
  });

  it('with an unsafe custom pattern, ids are not recognized', () => {
    expect(ok('SCP-1', { policy: 'ids', idPattern: '(a+)+' })).toEqual({
      key: null,
      title: 'SCP-1',
      url: null,
    });
    expect(err('https://x.example/SCP-1', { policy: 'ids', idPattern: '(a+)+' })).toBe(
      'links_disabled',
    );
  });
});

describe('helpers', () => {
  it('isSafeIdPattern', () => {
    expect(isSafeIdPattern('[A-Z]+-[0-9]+')).toBe(true);
    for (const p of ['', '(a+)+', '(?=a)', '(a)\\1', '[', 'a'.repeat(101), '(?<n>a)\\k<n>']) {
      expect(isSafeIdPattern(p), p).toBe(false);
    }
    expect(compileIdPattern(null)?.test('abc-1')).toBe(true);
    expect(compileIdPattern('[0-9]+')?.test('12a')).toBe(false);
  });

  it('normalizeAllowlistEntry and hostAllowed', () => {
    expect(normalizeAllowlistEntry(' Jira.Example.COM. ')).toBe('jira.example.com');
    expect(normalizeAllowlistEntry('bücher.example')).toBe('xn--bcher-kva.example');
    expect(normalizeAllowlistEntry('localhost')).toBe('localhost');
    for (const e of ['', 'https://x.y', 'x.y/z', 'a@b.c', 'nodot', '*.x.y']) {
      expect(normalizeAllowlistEntry(e), e).toBeNull();
    }
    expect(hostAllowed('A.jira.example.com.', ['jira.example.com'])).toBe(true);
    expect(hostAllowed('notjira.example.com', ['jira.example.com'])).toBe(false);
  });

  it('checkUrl and validateLinkTemplate', () => {
    expect(checkUrl('https://x.example', 'links', []).ok).toBe(true);
    expect(validateLinkTemplate('https://x.example/{id}', 'ids', [])).toBe(true);
    expect(validateLinkTemplate('https://x.example/', 'ids', [])).toBe(false);
    expect(validateLinkTemplate('https://x.example/{id}', 'allowlist', ['y.example'])).toBe(false);
  });
});
