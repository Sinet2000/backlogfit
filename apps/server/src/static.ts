/**
 * Static serving for the prerendered web build. No directory listings, no dotfiles (except
 * /.well-known), traversal-safe, prerendered fallbacks for client-only routes like /r and /new.
 */
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

export interface StaticFile {
  status: 200 | 404;
  body: Buffer;
  headers: Record<string, string>;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function contentType(path: string): string {
  return TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

function cacheControl(urlPath: string, file: string): string {
  if (urlPath.startsWith('/_app/immutable/')) return 'public, max-age=31536000, immutable';
  if (file.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

/** Decoded, normalized URL path segments, or null when the path is unsafe. */
function safeSegments(urlPath: string): string[] | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter((s) => s !== '');
  for (const [i, s] of segments.entries()) {
    if (s === '.' || s === '..') return null;
    if (s.startsWith('.') && !(i === 0 && s === '.well-known')) return null;
  }
  return segments;
}

export function createStaticHandler(webDir: string) {
  const root = normalize(webDir);
  const inside = (p: string) => p.startsWith(root + sep);

  async function load(path: string, urlPath: string, status: 200 | 404): Promise<StaticFile> {
    const body = await readFile(path);
    return {
      status,
      body,
      headers: {
        'Content-Type': contentType(path),
        'Cache-Control': status === 404 ? 'no-store' : cacheControl(urlPath, path),
      },
    };
  }

  return async function serve(urlPath: string): Promise<StaticFile | null> {
    const segments = safeSegments(urlPath);
    if (segments !== null) {
      const base = join(root, ...segments);
      if (base === root || inside(base)) {
        const candidates =
          segments.length === 0
            ? [join(root, 'index.html')]
            : [base, `${base}.html`, join(base, 'index.html')];
        for (const c of candidates) {
          if (inside(c) && (await isFile(c))) return load(c, urlPath, 200);
        }
      }
    }
    const notFound = join(root, '404.html');
    if (await isFile(notFound)) return load(notFound, urlPath, 404);
    return null;
  };
}
