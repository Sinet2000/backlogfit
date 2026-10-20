/**
 * `tsc --noEmit` for the worker, tolerating exactly two known mismatches between
 * @cloudflare/workers-types and packages/core or packages/security (requested fix in coordination/A2.md):
 *   - `globalThis.crypto` (workers-types declares `crypto` as a const, not on globalThis)
 *   - `new TextDecoder('utf-8', { fatal: true })` (workers-types requires `ignoreBOM`)
 * Any other diagnostic, or these outside packages/core and packages/security, fails the check.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const res = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', root], {
  encoding: 'utf8',
});
if (res.error) throw res.error;
const lines = `${res.stdout}${res.stderr}`.split('\n');

const tolerated = (line: string) =>
  /packages\/(?:core|security)\/src\/[\w-]+\.ts\(\d+,\d+\): error TS2339: Property 'crypto' does not exist on type 'typeof globalThis'\./.test(
    line,
  ) ||
  /packages\/core\/src\/[\w-]+\.ts\(\d+,\d+\): error TS2345: Argument of type '\{ fatal: true; \}' is not assignable to parameter of type 'TextDecoderConstructorOptions'\./.test(
    line,
  );

const errors: string[] = [];
let skipped = 0;
let continuation = false;
for (const line of lines) {
  if (line.trim() === '') continue;
  if (/^\s/.test(line)) {
    if (!continuation) errors.push(line);
    continue;
  }
  continuation = tolerated(line);
  if (continuation) skipped += 1;
  else errors.push(line);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`worker typecheck ok (${skipped} known core/workers-types mismatches tolerated)`);
