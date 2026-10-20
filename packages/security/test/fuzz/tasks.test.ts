import {
  checkUrl,
  createRoom,
  hasUnsafeChars,
  hostAllowed,
  isSafeIdPattern,
  linkFor,
  parseCreateRoomRequest,
  parseTaskLine,
  presetScale,
  project,
  TASK_KEY_MAX,
  TASK_TITLE_MAX,
  type TaskParseOptions,
  type TaskPolicy,
} from '@backlogfit/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nastyChar, nastyString, POLLUTION_KEYS } from './arbitraries.ts';

const ALLOW = ['backlogfit.com'];
const TEMPLATE = 'https://tracker.backlogfit.com/browse/{id}';

const optionsArb: fc.Arbitrary<TaskParseOptions> = fc.record({
  policy: fc.constantFrom<TaskPolicy>('ids', 'links', 'allowlist'),
  allowlist: fc.constant(ALLOW),
  idPattern: fc.constantFrom(null, '', '[0-9]{1,6}', '[A-Z]{2,5}-[0-9]+', '#?[a-z]+'),
  linkTemplate: fc.constantFrom(null, TEMPLATE),
});

const BYPASS_URLS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'javascript://backlogfit.com/%0aalert(1)',
  'java\tscript:alert(1)',
  'java\u0000script:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'DATA:text/html;base64,PHNjcmlwdD4=',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'blob:https://backlogfit.com/uuid',
  'about:blank',
  'ftp://backlogfit.com/x',
  'ws://backlogfit.com/x',
  '//evil.com',
  '//evil.com/backlogfit.com',
  '\\\\evil.com',
  '/\\evil.com',
  'https:evil.com',
  'https:/evil.com',
  'https:\\\\evil.com',
  'https://evil.com/backlogfit.com',
  'https://evil.com?backlogfit.com',
  'https://evil.com#backlogfit.com',
  'https://evil.com#@backlogfit.com',
  'https://evil.com\\@backlogfit.com',
  'https://evil.com%2F@backlogfit.com',
  'https://evil.com%23@backlogfit.com',
  'https://backlogfit.com@evil.com',
  'https://backlogfit.com:pw@evil.com',
  'https://user:pass@backlogfit.com/x',
  'https://backlogfit.com.evil.com',
  'https://backlogfit.com%2eevil.com',
  'https://backlogfit.com。evil.com',
  'https://backlogfit.com．evil.com',
  'https://evilbacklogfit.com',
  'https://evil-backlogfit.com',
  'https://bаcklogfit.com',
  'https://xn--bcklogfit-2nh.com',
  'https://backlogfit.co',
  'https://backlogfit.com\u0000.evil.com',
  'https://backlogfit.com​.evil.com',
  'https://backlogfit.com‮/moc.live',
  'https://[::1]/',
  'https://127.0.0.1/',
  'https://0x7f000001/',
  'https://evil.com:443@backlogfit.com',
  `https://backlogfit.com/${'a'.repeat(3000)}`,
];

function checkTaskInvariants(line: string, opts: TaskParseOptions): void {
  let r: ReturnType<typeof parseTaskLine> | undefined;
  expect(() => {
    r = parseTaskLine(line, opts);
  }).not.toThrow();
  if (!r?.ok) return;
  const { key, title, url } = r.task;
  if (key !== null) {
    expect(key.length).toBeLessThanOrEqual(TASK_KEY_MAX);
    expect(hasUnsafeChars(key)).toBe(false);
    expect(key).not.toMatch(/\s/);
  }
  if (title !== null) {
    expect(title.length).toBeLessThanOrEqual(TASK_TITLE_MAX);
    expect(hasUnsafeChars(title)).toBe(false);
    expect(title).not.toContain('://');
  }
  if (url !== null) {
    const u = new URL(url);
    expect(['https:', 'http:']).toContain(u.protocol);
    expect(u.username).toBe('');
    expect(u.password).toBe('');
    expect(u.hostname).not.toBe('');
    expect(
      [...url].some((ch) => /\s/.test(ch) || (ch.codePointAt(0) ?? 0) < 0x20 || ch === '\x7f'),
    ).toBe(false);
    if (opts.policy === 'ids') {
      expect(opts.linkTemplate).not.toBeNull();
      expect(key).not.toBeNull();
      expect(url).toBe(linkFor(opts.linkTemplate ?? '', key ?? ''));
      expect(url.startsWith('https://tracker.backlogfit.com/browse/')).toBe(true);
    } else if (opts.policy === 'allowlist') {
      expect(hostAllowed(u.hostname, opts.allowlist ?? [])).toBe(true);
      const h = u.hostname.replace(/\.$/, '');
      expect(h === 'backlogfit.com' || h.endsWith('.backlogfit.com')).toBe(true);
    } else {
      expect(u.hostname.split('.').some((l) => l.startsWith('xn--'))).toBe(false);
    }
  }
}

describe('parseTaskLine fuzz', () => {
  it('never throws and every accepted link is safe, under every policy', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), optionsArb, checkTaskInvariants),
      { numRuns: 3000 },
    );
    fc.assert(fc.property(nastyString(80), optionsArb, checkTaskInvariants), { numRuns: 5000 });
  });

  it('URL-shaped lines built from hostile parts keep the invariants', () => {
    const scheme = fc.constantFrom(
      'https://',
      'http://',
      'HTTPS://',
      'javascript:',
      'data:',
      'vbscript:',
      '//',
      'https:',
      'https:/',
      'https:\\\\',
      ' https://',
      'blob:https://',
    );
    const host = fc.constantFrom(
      'backlogfit.com',
      'jira.backlogfit.com',
      'evil.com',
      'backlogfit.com.evil.com',
      'evil.com/backlogfit.com',
      'evil.com#@backlogfit.com',
      'bаcklogfit.com',
      'backlogfit.com.',
      'BACKLOGFIT.COM',
      'user:pw@backlogfit.com',
      'xn--80ak6aa92e.com',
      '127.0.0.1',
      '[::1]',
    );
    const tail = fc.oneof(
      fc.constantFrom('', '/', '/browse/ABC-12', '/?q=1#x', ':8080/x'),
      nastyString(10),
    );
    const line = fc
      .tuple(
        scheme,
        host,
        tail,
        fc.option(nastyString(20), { nil: undefined }),
        fc.option(nastyChar, { nil: undefined }),
      )
      .map(
        ([s, h, t, title, ch]) =>
          `${s}${h}${t}${ch ?? ''}${title === undefined ? '' : ` ${title}`}`,
      );
    fc.assert(fc.property(line, optionsArb, checkTaskInvariants), { numRuns: 10_000 });
  });

  it('rejects every known bypass under the allowlist policy', () => {
    const opts: TaskParseOptions = { policy: 'allowlist', allowlist: ALLOW };
    for (const raw of BYPASS_URLS) {
      const r = parseTaskLine(raw, opts);
      expect(r.ok && r.task.url !== null, raw).toBe(false);
      checkTaskInvariants(raw, opts);
    }
    expect(parseTaskLine('https://jira.backlogfit.com/browse/ABC-1', opts)).toMatchObject({
      ok: true,
      task: { key: 'ABC-1', url: 'https://jira.backlogfit.com/browse/ABC-1' },
    });
  });

  it('never stores a dangerous scheme as a link under any policy', () => {
    for (const policy of ['ids', 'links', 'allowlist'] as const) {
      for (const raw of BYPASS_URLS) {
        const r = parseTaskLine(raw, { policy, allowlist: ALLOW });
        if (r.ok && r.task.url !== null) {
          expect(r.task.url, raw).toMatch(/^https?:\/\//);
        }
        checkTaskInvariants(raw, { policy, allowlist: ALLOW });
      }
    }
  });

  it('checkUrl agrees with parseTaskLine on accepted links', () => {
    fc.assert(
      fc.property(nastyString(60), (s) => {
        const raw = `https://${s}`;
        const r = parseTaskLine(raw, { policy: 'links' });
        if (r.ok && r.task.url !== null) expect(checkUrl(r.task.url, 'links', []).ok).toBe(true);
      }),
      { numRuns: 3000 },
    );
  });
});

describe('idPattern ReDoS', () => {
  it('rejects classic catastrophic patterns', () => {
    for (const p of ['(a+)+$', '(a|a)*', '(a*)*b', '(?=a)a', '(a)\\1', '([a-z]+)*x']) {
      expect(isSafeIdPattern(p), p).toBe(false);
    }
  });

  it('rejects chains of overlapping quantifiers', () => {
    expect(isSafeIdPattern(`${'a*'.repeat(14)}b`)).toBe(false);
    expect(isSafeIdPattern(`${'[a-z]+'.repeat(10)}!`)).toBe(false);
    expect(isSafeIdPattern(`${'\\w?'.repeat(30)}\\w{30}`)).toBe(false);
  });
});

describe('parseCreateRoomRequest fuzz', () => {
  const valid = () => ({
    v: 1,
    config: {
      scale: presetScale('fibonacci'),
      taskPolicy: 'allowlist',
      allowlist: ['Jira.Example.com'],
      idPattern: null,
      linkTemplate: 'https://jira.example.com/browse/{id}',
      maxParticipants: 20,
    },
    joinHash: 'a'.repeat(64),
    adminHash: 'b'.repeat(64),
    lifetimeHours: 2,
  });

  const field = fc.constantFrom(
    'v',
    'joinHash',
    'adminHash',
    'lifetimeHours',
    'passcode',
    'config.scale',
    'config.taskPolicy',
    'config.allowlist',
    'config.idPattern',
    'config.linkTemplate',
    'config.maxParticipants',
    'config.timerSeconds',
    'config.theme',
    ...POLLUTION_KEYS.map((k) => `config.${k}`),
    ...POLLUTION_KEYS,
  );
  const value = fc.oneof(
    fc.jsonValue({ maxDepth: 3 }),
    nastyString(30),
    fc.constantFrom(
      'javascript:alert(1)//{id}',
      'https://{id}',
      'https://evil.com/{id}',
      'https://jira.example.com/{id}/{id}',
      'https://u:p@jira.example.com/{id}',
      ['*.example.com'],
      ['example.com/x'],
      ['evil.com#example.com'],
      ['xn--80ak6aa92e.com'],
      '(a+)+',
      `${'a*'.repeat(5)}b`,
      Number.POSITIVE_INFINITY,
      -1,
      25,
      0,
      { salt: 'f'.repeat(32), hash: 'c'.repeat(64) },
    ),
  );

  function setPath(obj: Record<string, unknown>, path: string, v: unknown): void {
    const [head, rest] = path.split('.', 2) as [string, string | undefined];
    if (rest === undefined) {
      Object.defineProperty(obj, head, {
        value: v,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      return;
    }
    setPath(obj[head] as Record<string, unknown>, rest, v);
  }

  it('never throws; accepted requests are internally consistent and safe to build', () => {
    let accepted = 0;
    fc.assert(
      fc.property(fc.array(fc.tuple(field, value), { minLength: 1, maxLength: 3 }), (edits) => {
        const req = valid() as Record<string, unknown>;
        for (const [p, v] of edits) setPath(req, p, v);
        for (const input of [req, JSON.parse(JSON.stringify(req)) as unknown]) {
          let r: ReturnType<typeof parseCreateRoomRequest> | undefined;
          expect(() => {
            r = parseCreateRoomRequest(input);
          }).not.toThrow();
          if (!r?.ok) continue;
          accepted++;
          const c = r.msg.config;
          for (const k of POLLUTION_KEYS) {
            expect(Object.hasOwn(r.msg, k)).toBe(false);
            expect(Object.hasOwn(c, k)).toBe(false);
          }
          expect(c.idPattern === null || isSafeIdPattern(c.idPattern)).toBe(true);
          for (const d of c.allowlist) expect(d).toMatch(/^[a-z0-9.-]+$/);
          if (c.taskPolicy === 'allowlist') expect(c.allowlist.length).toBeGreaterThan(0);
          if (c.linkTemplate !== null) {
            expect(c.linkTemplate.split('{id}').length).toBe(2);
            expect(c.linkTemplate).toMatch(/^https?:\/\//i);
          }
          expect(r.msg.lifetimeHours).toBeGreaterThanOrEqual(1);
          const { state } = createRoom(r.msg, 'room', { now: 0, randomId: () => 'p' });
          const view = JSON.stringify(project(state, null));
          expect(view).not.toContain(r.msg.joinHash);
          expect(view).not.toContain(r.msg.adminHash);
          expect(state.expiresAt - state.createdAt).toBeLessThanOrEqual(state.limits.maxLifetimeMs);
        }
      }),
      { numRuns: 3000 },
    );
    expect(accepted).toBeGreaterThan(0);
  });

  it('rejects non-objects and prototype tricks outright', () => {
    for (const input of [null, undefined, 0, '', [], 'x', true, Object.create(null)]) {
      expect(parseCreateRoomRequest(input).ok).toBe(false);
    }
    const viaJson = JSON.parse(
      `{"v":1,"__proto__":{"admin":true},"config":${JSON.stringify(valid().config)},"joinHash":"${'a'.repeat(64)}","adminHash":"${'b'.repeat(64)}","lifetimeHours":2}`,
    ) as unknown;
    expect(parseCreateRoomRequest(viaJson).ok).toBe(false);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});
