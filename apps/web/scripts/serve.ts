/**
 * Serve build/ with the production security headers (CSP from @backlogfit/security) to check
 * the static output under the real policy: `pnpm --filter @backlogfit/web serve:csp`, then open
 * http://localhost:4173 and watch the console for CSP violations. No dependencies.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from '@backlogfit/security';

const root = fileURLToPath(new URL('../build', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function resolve(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0] ?? '/')).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  const candidates = [clean, `${clean}.html`, join(clean, 'index.html')];
  for (const c of candidates) {
    const file = join(root, c);
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  // Production policy (incl. Trusted Types), minus HSTS/upgrade-insecure-requests for http://localhost.
  const headers = securityHeaders({ dev: true, trustedTypes: true });
  const file = resolve(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
}).listen(port, () =>
  console.log(`serving ${root} with production CSP on http://localhost:${port}`),
);
