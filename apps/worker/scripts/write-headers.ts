/**
 * Writes the security headers for static assets to `_headers`, after the web build.
 * `--dev` omits HSTS and upgrade-insecure-requests for http://localhost.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headersFile } from '@backlogfit/security';

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, '../../web/build'));

// headersFile() already has the per-path blocks; adding more would duplicate Cache-Control (SEC-011).
const body = headersFile({ dev });

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, '_headers'), body);
console.log(`wrote ${join(dir, '_headers')}${dev ? ' (dev)' : ''}`);
