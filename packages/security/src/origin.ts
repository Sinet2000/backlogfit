/**
 * Canonical serialization of an allowlist entry ("https://example.com", "http://localhost:5173"),
 * or null if it is not an http(s) origin.
 */
export function canonicalOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url.origin;
}

/**
 * Exact origin match (scheme, host, port). A missing Origin header or the opaque origin `null`
 * is rejected.
 *
 * Browsers always send the canonical serialization (lower-case host, punycode, no default port,
 * no path, no userinfo, no trailing slash). Anything else (`https://u@host`, `HTTPS://HOST`,
 * `https://host:443`, `https://host/`, `https://host.`) cannot come from a browser, so the
 * header must already be canonical byte-for-byte, and only then is it compared.
 */
export function isAllowedOrigin(
  origin: string | null | undefined,
  allowed: readonly string[],
): boolean {
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return false;
  if (origin.length > 2048) return false;
  if (canonicalOrigin(origin) !== origin) return false;
  return allowed.some((a) => canonicalOrigin(a) === origin);
}

/**
 * Pre-validated origin checker for a fixed allowlist. Throws at startup on an invalid entry so a
 * typo in PUBLIC_ORIGIN fails fast instead of silently rejecting every client.
 */
export function createOriginChecker(
  allowed: readonly string[],
): (origin: string | null | undefined) => boolean {
  const set = new Set<string>();
  for (const a of allowed) {
    const c = canonicalOrigin(a.trim());
    if (c === null) throw new Error(`invalid allowed origin ${JSON.stringify(a)}`);
    set.add(c);
  }
  return (origin) =>
    typeof origin === 'string' &&
    origin !== 'null' &&
    origin.length <= 2048 &&
    set.has(origin) &&
    canonicalOrigin(origin) === origin;
}
