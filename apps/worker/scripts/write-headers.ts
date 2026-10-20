/**
 * Writes the static-assets `_headers` file (security headers on every asset, no-store + noindex
 * for /r and /new, immutable caching for hashed SvelteKit assets) into the asset directory.
 * Run after the web build.
 *   node scripts/write-headers.ts [--dev] [assetDir]
 * --dev omits HSTS and upgrade-insecure-requests (for http://localhost with wrangler dev).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headersFile } from '@backlogfit/security';

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, '../../web/build'));

// headersFile() already carries the per-path blocks (/r, /new, /_app/immutable/*); adding our
// own would make Cloudflare join duplicate Cache-Control values (SEC-011).
const body = headersFile({ dev });

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, '_headers'), body);
console.log(`wrote ${join(dir, '_headers')}${dev ? ' (dev)' : ''}`);
