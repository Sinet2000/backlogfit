/**
 * HTTP-level checks on the served app (headers, inline code, cookies) and a browsed session that
 * the guard fixture checks for third-party requests and CSP violations.
 */
import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { addTasks, id, vote } from '../fixtures/ui.ts';

const PAGES = ['/', '/guide', '/new', '/r'];

for (const path of PAGES) {
  test(`security headers and no inline code on ${path} @smoke`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h['content-type']).toMatch(/text\/html/);

    const csp = h['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).toMatch(/style-src 'self'(;|$)/);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['permissions-policy']).toBeTruthy();
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['set-cookie']).toBeUndefined();
    expect(h.server ?? '').not.toMatch(/\d/); // no version banner
    expect(h['x-powered-by']).toBeUndefined();

    const html = await res.text();
    // No executable inline script (JSON-LD data blocks are allowed: CSP does not run them).
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
      ([, attrs, body]) =>
        !/\bsrc\s*=/.test(attrs ?? '') &&
        !/type\s*=\s*["']?application\/ld\+json/i.test(attrs ?? '') &&
        (body ?? '').trim() !== '',
    );
    expect(inline.map((m) => m[0].slice(0, 120))).toEqual([]);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    // No third-party resources in markup (plain <a href> navigation links are fine).
    const srcs = [...html.matchAll(/\b(?:src|srcset|poster|data)\s*=\s*["']([^"']+)["']/gi)].map(
      (m) => m[1] ?? '',
    );
    const loaded = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) =>
        /\brel\s*=\s*["']?[^"'>]*(stylesheet|preload|modulepreload|icon|manifest|prefetch|preconnect|dns-prefetch)/i.test(
          tag,
        ),
      )
      .map((tag) => tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '');
    const external = [...srcs, ...loaded].filter((u) => /^(https?:)?\/\//i.test(u));
    expect(external).toEqual([]);
  });
}

test('static assets carry security headers too', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const asset = html.match(/<script[^>]+src=["']([^"']+)["']/i)?.[1];
  expect(asset, 'an external script exists').toBeTruthy();
  const res = await request.get(asset ?? '/');
  expect(res.status()).toBe(200);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['set-cookie']).toBeUndefined();
});

test('API rejects cross-origin room creation and junk bodies', async ({ request, baseURL }) => {
  const evil = await request.post('/api/rooms', {
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    data: '{}',
  });
  expect([400, 403]).toContain(evil.status());
  const junk = await request.post('/api/rooms', {
    headers: { origin: new URL(baseURL ?? '').origin, 'content-type': 'application/json' },
    data: '{"v":1,"config":{"scale":[]},"__proto__":{"x":1}}',
  });
  expect(junk.status()).toBe(400);
  expect(await junk.text()).not.toContain('scale');
});

test('a whole session: no cookies, no third-party requests, no CSP violations @smoke', async ({
  page,
  context,
  people,
  guard,
}) => {
  await page.goto('/');
  await page.goto('/guide');
  await page.goto('/new');
  const room = await createRoomApi({ autoReveal: true });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  const alice = await people.join(room.joinLink, 'Alice');
  await addTasks(page, ['SCP-200']);
  await id(page, 'btn-next').click();
  await vote(alice.page, '3');
  await expect(id(alice.page, 'reveal-results')).toBeVisible();

  expect(await context.cookies()).toEqual([]);
  expect(await alice.context.cookies()).toEqual([]);
  // localStorage may hold UI preferences only, never secrets.
  for (const p of [page, alice.page]) {
    const stored = await p.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain(room.joinSecret);
    expect(stored).not.toContain(room.adminSecret);
  }
  // The guard fixture asserts at teardown; check early here for a clearer failure.
  expect(guard.external).toEqual([]);
  expect(guard.csp).toEqual([]);
});

test('static pages render without CSP violations or third-party requests @smoke', async ({
  page,
  guard,
}) => {
  for (const path of ['/', '/guide', '/new', '/r']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  // Client-side navigation too (SvelteKit renders its route announcer then).
  await page.goto('/');
  const guideLink = page.locator('a[href="/guide"]').first();
  if ((await guideLink.count()) > 0) {
    await guideLink.click();
    await page.waitForURL('**/guide');
  }
  expect(guard.csp).toEqual([]);
  expect(guard.external).toEqual([]);
});
