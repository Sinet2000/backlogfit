import { mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { base, start, tempDir } from './helpers.ts';

let server: RunningServer;
let web: ReturnType<typeof tempDir>;
let outside: ReturnType<typeof tempDir>;

beforeAll(async () => {
  outside = tempDir('bf-outside-');
  writeFileSync(join(outside.path, 'secret.txt'), 'TOP SECRET');
  web = tempDir('bf-web-');
  const w = (p: string, body: string) => {
    mkdirSync(join(web.path, p, '..'), { recursive: true });
    writeFileSync(join(web.path, p), body);
  };
  w('index.html', '<h1>home</h1>');
  w('r.html', '<h1>room</h1>');
  w('new/index.html', '<h1>new</h1>');
  w('404.html', '<h1>missing</h1>');
  w('_app/immutable/entry/app.abc123.js', 'export {};');
  w('_app/version.json', '{"version":"1"}');
  w('fonts/inter.woff2', 'font');
  w('_app/immutable/entry/app.abc123.js.map', '{"sources":[]}');
  w('.env', 'SECRET=1');
  w('.well-known/security.txt', 'Contact: x');
  mkdirSync(join(web.path, 'empty-dir'));
  server = await start({ WEB_DIR: web.path });
});

afterAll(async () => {
  await server.close();
  web.cleanup();
  outside.cleanup();
});

async function get(path: string) {
  const res = await fetch(`${base(server)}${path}`);
  return { res, text: await res.text() };
}

/** fetch() normalizes `..`; send the raw request line to test traversal for real. */
function rawGet(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('static web build', () => {
  it('serves index, prerendered routes and assets with types and caching', async () => {
    const home = await get('/');
    expect(home.res.status).toBe(200);
    expect(home.text).toContain('home');
    expect(home.res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(home.res.headers.get('cache-control')).toBe('no-cache');
    expect(home.res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(home.res.headers.get('referrer-policy')).toBe('no-referrer');

    for (const p of ['/r', '/new', '/new/']) {
      const { res, text } = await get(p);
      expect(text, p).toMatch(/room|new/);
      // SEC-006: pages that carry secrets in the fragment are never cached or indexed.
      expect(res.headers.get('cache-control'), p).toBe('no-store');
      expect(res.headers.get('x-robots-tag'), p).toContain('noindex');
    }
    expect(home.res.headers.get('x-robots-tag')).toBeNull();

    const js = await get('/_app/immutable/entry/app.abc123.js');
    expect(js.res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(js.res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const version = await get('/_app/version.json');
    expect(version.res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect((await get('/fonts/inter.woff2')).res.headers.get('content-type')).toBe('font/woff2');
    expect((await get('/.well-known/security.txt')).res.status).toBe(200);
  });

  it('serves source maps only in dev', async () => {
    expect((await get('/_app/immutable/entry/app.abc123.js.map')).res.status).toBe(200);
    const prod = await start({
      WEB_DIR: web.path,
      NODE_ENV: 'production',
      PUBLIC_ORIGIN: 'https://app.test',
    });
    try {
      const res = await fetch(
        `http://127.0.0.1:${prod.port}/_app/immutable/entry/app.abc123.js.map`,
      );
      expect(res.status).toBe(404);
    } finally {
      await prod.close();
    }
  });

  it('enforces trusted types and hides source maps in production on plain http', async () => {
    const prod = await start({
      WEB_DIR: web.path,
      NODE_ENV: 'production',
      PUBLIC_ORIGIN: 'http://intranet.test',
    });
    try {
      const page = await fetch(`http://127.0.0.1:${prod.port}/`);
      const csp = page.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("require-trusted-types-for 'script'");
      expect(csp).not.toContain('upgrade-insecure-requests');
      expect(page.headers.get('strict-transport-security')).toBeNull();
      for (const path of ['app.abc123.js.map', 'app.abc123.js.map/', 'app.abc123.js.MAP']) {
        const map = await fetch(`http://127.0.0.1:${prod.port}/_app/immutable/entry/${path}`);
        expect(map.status, path).toBe(404);
      }
    } finally {
      await prod.close();
    }
  });

  it('answers HEAD without a body', async () => {
    const res = await fetch(`${base(server)}/`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('serves 404.html for unknown paths, dotfiles and directories', async () => {
    for (const p of ['/nope', '/.env', '/empty-dir', '/empty-dir/', '/r/extra']) {
      const { res, text } = await get(p);
      expect(res.status, p).toBe(404);
      expect(text, p).toContain('missing');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    }
  });

  it('is safe against path traversal', async () => {
    for (const p of [
      '/../secret.txt',
      '/..%2fsecret.txt',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/..\\secret.txt',
      '/%2e%2e%5csecret.txt',
      '/foo%00.html',
      '/%E0%A4%A',
    ]) {
      const { status, body } = await rawGet(p);
      expect(body, p).not.toContain('TOP SECRET');
      expect(body, p).not.toContain('root:');
      expect([400, 404], p).toContain(status);
    }
  });
});
