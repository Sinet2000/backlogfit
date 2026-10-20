/**
 * Post-build step for the strict CSP (`script-src 'self'; style-src 'self'`, no 'unsafe-inline').
 *
 * 1. Moves SvelteKit's inline bootstrap <script> of every prerendered page into an external,
 *    content-hashed module under build/_app/immutable/boot/ and references it with
 *    <script type="module" src="...">.
 * 2. Adds <meta name="robots" content="noindex"> to client-only pages (their <svelte:head> only
 *    exists at runtime).
 * 3. Fails the build if any HTML file still contains an inline script (other than JSON-LD data
 *    blocks), a <style> element, a style="" attribute, an inline event handler or a javascript:
 *    URL.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOOT_DIR = '_app/immutable/boot';
export const ROOT_ID = 'svelte';
/** Client-only pages (ssr = false) that must not be indexed. Paths relative to build/. */
export const NOINDEX_PAGES = ['new.html', 'r.html'];

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const TAG_RE = /<([a-zA-Z][\w:-]*)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?\/?>/g;
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

function attrs(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw) return out;
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = (m[1] ?? '').toLowerCase();
    let value = m[2] ?? '';
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1);
    out.set(name, value);
  }
  return out;
}

const DATA_BLOCK_TYPES = new Set(['application/ld+json']);
/** <link> relations that make the browser fetch something (canonical/alternate do not). */
const LOADING_RELS =
  /\b(?:stylesheet|preload|modulepreload|prefetch|icon|manifest|preconnect|dns-prefetch)\b/i;

/** Rewrite the bootstrap so it works as an external ES module. Throws if Kit's shape changed. */
export function rewriteBootstrap(code: string): string {
  if (!code.includes('document.currentScript.parentElement')) {
    throw new Error('externalize: bootstrap no longer uses document.currentScript.parentElement');
  }
  const global = /^(\s*)(__sveltekit_[A-Za-z0-9_]+)(\s*=)/m;
  if (!global.test(code)) throw new Error('externalize: bootstrap global assignment not found');
  return code
    .replace(
      'document.currentScript.parentElement',
      `document.getElementById(${JSON.stringify(ROOT_ID)})`,
    )
    .replace(global, '$1globalThis.$2$3')
    .replace(/^\t+|^ +/gm, '')
    .trim()
    .concat('\n');
}

export interface ExternalizeResult {
  html: string;
  files: { name: string; code: string }[];
}

/** Replace inline executable scripts with external module scripts. Pure (no I/O). */
export function externalizeHtml(html: string): ExternalizeResult {
  const files: { name: string; code: string }[] = [];
  const out = html.replace(SCRIPT_RE, (whole, rawAttrs: string, body: string) => {
    const a = attrs(rawAttrs);
    if (a.has('src')) return whole;
    if (DATA_BLOCK_TYPES.has((a.get('type') ?? '').toLowerCase())) return whole;
    if (body.trim() === '') return '';
    if (!body.includes('__sveltekit_')) {
      throw new Error('externalize: unexpected inline script that is not the SvelteKit bootstrap');
    }
    const code = rewriteBootstrap(body);
    const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
    const name = `${BOOT_DIR}/${hash}.js`;
    files.push({ name, code });
    return `<script type="module" src="/${name}"></script>`;
  });
  return { html: out, files };
}

/** Insert noindex (and a fallback title) into a client-only page shell. */
export function addNoindex(html: string): string {
  let out = html;
  if (!/<meta\s+name=["']robots["']/i.test(out)) {
    out = out.replace(/<head>/i, '<head>\n    <meta name="robots" content="noindex, nofollow" />');
  }
  if (!/<title>/i.test(out)) {
    out = out.replace(/<\/head>/i, '    <title>Backlogfit</title>\n  </head>');
  }
  return out;
}

/** Everything in an HTML document that the production CSP would block. Empty = compliant. */
export function findCspViolations(html: string): string[] {
  const problems: string[] = [];
  const withoutComments = html.replace(COMMENT_RE, '');
  for (const m of withoutComments.matchAll(SCRIPT_RE)) {
    const a = attrs(m[1]);
    const type = (a.get('type') ?? '').toLowerCase();
    if (a.has('src')) {
      if ((m[2] ?? '').trim() !== '') problems.push('script with src also has inline content');
      if (/^(?:https?:)?\/\//i.test(a.get('src') ?? '')) problems.push('third-party script src');
      continue;
    }
    if (!DATA_BLOCK_TYPES.has(type)) problems.push(`inline <script${m[1] ?? ''}>`);
  }
  // Data blocks may contain anything; scan tags only outside of scripts.
  const markup = withoutComments.replace(SCRIPT_RE, '<script></script>');
  for (const m of markup.matchAll(TAG_RE)) {
    const tag = (m[1] ?? '').toLowerCase();
    if (tag === 'style') problems.push('<style> element');
    const list = attrs(m[2]);
    if (tag === 'link' && LOADING_RELS.test(list.get('rel') ?? '')) {
      if (/^(?:https?:)?\/\//i.test(list.get('href') ?? '')) {
        problems.push(`third-party <link href="${list.get('href')}">`);
      }
    }
    for (const [name, value] of list) {
      if (name === 'style') problems.push(`style attribute on <${tag}>`);
      if (/^on[a-z]+$/.test(name)) problems.push(`inline event handler ${name} on <${tag}>`);
      if (
        (name === 'href' || name === 'src' || name === 'action') &&
        /^\s*javascript:/i.test(value)
      ) {
        problems.push(`javascript: URL on <${tag}>`);
      }
    }
  }
  return problems;
}

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path));
    else if (entry.endsWith('.html')) out.push(path);
  }
  return out;
}

export function run(buildDir: string): { pages: number; scripts: number } {
  const pages = htmlFiles(buildDir);
  if (pages.length === 0) throw new Error(`externalize: no HTML files in ${buildDir}`);
  let scripts = 0;
  const failures: string[] = [];
  for (const file of pages) {
    const rel = relative(buildDir, file);
    const { html, files } = externalizeHtml(readFileSync(file, 'utf8'));
    for (const f of files) {
      const target = join(buildDir, f.name);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, f.code);
      scripts++;
    }
    const final = NOINDEX_PAGES.includes(rel) ? addNoindex(html) : html;
    writeFileSync(file, final);
    for (const p of findCspViolations(final)) failures.push(`${rel}: ${p}`);
  }
  if (failures.length > 0) {
    throw new Error(`CSP check failed:\n  ${failures.join('\n  ')}`);
  }
  return { pages: pages.length, scripts };
}

if (import.meta.main) {
  const buildDir = fileURLToPath(new URL('../build', import.meta.url));
  try {
    const { pages, scripts } = run(buildDir);
    console.log(`externalize: ${pages} pages checked, ${scripts} bootstrap scripts externalized`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
