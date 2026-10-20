import { describe, expect, it } from 'vitest';
import {
  addNoindex,
  externalizeHtml,
  findCspViolations,
  rewriteBootstrap,
} from '../scripts/externalize.ts';

const BOOT = `
  {
    __sveltekit_abc123 = {
      base: "",
      version: "1"
    };

    const element = document.currentScript.parentElement;

    import("/_app/immutable/entry/start.X.js").then(async (kit) => {
      kit.init(__sveltekit_abc123);
      const app = await import("/_app/immutable/entry/app.Y.js");
      kit.start(app, element);
    });
  }
`;

const page = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body><div id="svelte">${body}<script>${BOOT}</script></div></body></html>`;

describe('rewriteBootstrap', () => {
  it('makes the bootstrap work as a module script', () => {
    const code = rewriteBootstrap(BOOT);
    expect(code).toContain('globalThis.__sveltekit_abc123 =');
    expect(code).toContain('document.getElementById("svelte")');
    expect(code).not.toContain('currentScript');
    expect(code).toContain('kit.init(__sveltekit_abc123)');
  });

  it('fails loudly when SvelteKit changes the bootstrap shape', () => {
    expect(() => rewriteBootstrap('console.log(1)')).toThrow();
    expect(() => rewriteBootstrap('document.currentScript.parentElement')).toThrow();
  });
});

describe('externalizeHtml', () => {
  it('moves the inline bootstrap to a hashed external module', () => {
    const { html, files } = externalizeHtml(page('<p>hi</p>'));
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toMatch(/^_app\/immutable\/boot\/[0-9a-f]{16}\.js$/);
    expect(html).toContain(`<script type="module" src="/${files[0]?.name}"></script>`);
    expect(findCspViolations(html)).toEqual([]);
  });

  it('is deterministic (same content, same name)', () => {
    expect(externalizeHtml(page('a')).files[0]?.name).toBe(
      externalizeHtml(page('b')).files[0]?.name,
    );
  });

  it('keeps JSON-LD data blocks and external scripts', () => {
    const head =
      '<script src="/theme.js"></script><script type="application/ld+json">{"a":"\\u003c"}</script>';
    const { html } = externalizeHtml(page('', head));
    expect(html).toContain('<script src="/theme.js"></script>');
    expect(html).toContain('application/ld+json');
    expect(findCspViolations(html)).toEqual([]);
  });

  it('refuses unknown inline scripts', () => {
    expect(() => externalizeHtml('<script>alert(1)</script>')).toThrow();
  });
});

describe('findCspViolations', () => {
  it('flags everything the strict CSP would block', () => {
    const bad = [
      '<script>x()</script>',
      '<script type="module">x()</script>',
      '<style>p{}</style>',
      '<p style="color:red">x</p>',
      "<div class='a' style='x'></div>",
      '<button onclick="x()">b</button>',
      '<a href="javascript:alert(1)">x</a>',
      '<script src="https://cdn.example.com/x.js"></script>',
      '<link rel="stylesheet" href="https://fonts.example.com/a.css">',
    ];
    for (const html of bad) expect(findCspViolations(html), html).not.toEqual([]);
  });

  it('accepts compliant markup', () => {
    const ok = [
      '<link rel="canonical" href="https://backlogfit.com/">',
      '<link rel="stylesheet" href="/_app/a.css">',
      '<script type="module" src="/_app/boot.js"></script>',
      '<p data-style="x">style="not an attribute"</p>',
      '<!-- <style> in a comment -->',
      '<script type="application/ld+json">{"style":"<p style=x>"}</script>',
      '<meta name="description" content="onclick=fine">',
    ];
    for (const html of ok) expect(findCspViolations(html), html).toEqual([]);
  });
});

describe('addNoindex', () => {
  it('adds robots noindex and a fallback title once', () => {
    const out = addNoindex('<html><head></head><body></body></html>');
    expect(out).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(out).toContain('<title>Backlogfit</title>');
    expect(addNoindex(out)).toBe(out);
  });
});
