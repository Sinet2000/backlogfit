export interface HeaderOptions {
  /**
   * Extra origins for connect-src, e.g. a separate WebSocket host (`wss://ws.example.com`).
   * Same-origin http(s) and ws(s) are always allowed via 'self'. Each entry must be a bare origin
   * (scheme://host[:port]); anything else throws, so a misconfiguration cannot inject directives.
   */
  connectSrc?: readonly string[];
  /** Development mode: no HSTS, no upgrade-insecure-requests, no Trusted Types enforcement. */
  dev?: boolean;
  /**
   * Enforce Trusted Types (`require-trusted-types-for 'script'`). Default: on outside dev.
   * Svelte 5 registers its own `svelte-trusted-html` policy for template cloning; a raw string
   * assigned to innerHTML (e.g. `{@html}`) throws, which is intended.
   */
  trustedTypes?: boolean;
  /** Add `preload` to HSTS. Only for a domain actually submitted to the preload list. */
  hstsPreload?: boolean;
}

/** Trusted Types policy names the app may create (Svelte 5 runtime). */
export const TRUSTED_TYPES_POLICIES: readonly string[] = Object.freeze(['svelte-trusted-html']);

/** Response headers that leak implementation details and should be removed if present. */
export const REMOVE_HEADERS: readonly string[] = Object.freeze([
  'X-Powered-By',
  'Server',
  'X-AspNet-Version',
  'X-AspNetMvc-Version',
]);

/**
 * Powerful features the app does not use, denied for all origins (including itself). Only
 * features current Chromium recognizes are listed (unknown names log console errors).
 * `clipboard-write` stays at its default (self) for the copy-link buttons and `web-share` is
 * allowed for self only, for sharing the join link on mobile.
 */
export const PERMISSIONS_POLICY_FEATURES: readonly string[] = Object.freeze([
  'accelerometer',
  'ambient-light-sensor',
  'attribution-reporting',
  'autoplay',
  'bluetooth',
  'browsing-topics',
  'camera',
  'compute-pressure',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'gamepad',
  'geolocation',
  'gyroscope',
  'hid',
  'identity-credentials-get',
  'idle-detection',
  'join-ad-interest-group',
  'keyboard-map',
  'local-fonts',
  'magnetometer',
  'microphone',
  'midi',
  'otp-credentials',
  'payment',
  'picture-in-picture',
  'private-state-token-issuance',
  'private-state-token-redemption',
  'publickey-credentials-create',
  'publickey-credentials-get',
  'run-ad-auction',
  'screen-wake-lock',
  'serial',
  'storage-access',
  'usb',
  'window-management',
  'xr-spatial-tracking',
]);

const ORIGIN_RE = /^(?:https|wss|http|ws):\/\/(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?$/;

function checkedConnectSources(sources: readonly string[]): string[] {
  for (const s of sources) {
    if (!ORIGIN_RE.test(s)) {
      throw new Error(
        `connectSrc entries must be bare lower-case origins, got ${JSON.stringify(s)}`,
      );
    }
  }
  return [...sources];
}

export function contentSecurityPolicy(opts: HeaderOptions = {}): string {
  const connect = ["'self'", ...checkedConnectSources(opts.connectSrc ?? [])].join(' ');
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src ${connect}`,
    "manifest-src 'self'",
    "media-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (opts.trustedTypes ?? !opts.dev) {
    directives.push("require-trusted-types-for 'script'");
    directives.push(`trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`);
  }
  if (!opts.dev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function permissionsPolicy(): string {
  return [...PERMISSIONS_POLICY_FEATURES.map((f) => `${f}=()`), 'web-share=(self)'].join(', ');
}

export function securityHeaders(opts: HeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': contentSecurityPolicy(opts),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': permissionsPolicy(),
    'Cross-Origin-Opener-Policy': 'same-origin',
    // All resources are same-origin, so require-corp costs nothing and gives cross-origin isolation.
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    // Legacy browsers that predate frame-ancestors.
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-DNS-Prefetch-Control': 'off',
  };
  if (!opts.dev) {
    headers['Strict-Transport-Security'] =
      `max-age=63072000; includeSubDomains${opts.hstsPreload ? '; preload' : ''}`;
  }
  return headers;
}

/** Long-lived, content-hashed build output (SvelteKit `_app/immutable`). */
export const IMMUTABLE_PREFIX = '/_app/immutable/';

/** Routes that only make sense with a secret in the fragment: never cached, never indexed. */
export const PRIVATE_ROUTES: readonly string[] = Object.freeze(['/r', '/new']);

function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTES.some(
    (r) => pathname === r || pathname === `${r}/` || pathname.startsWith(`${r}/`),
  );
}

/**
 * Headers that depend on the path: Cache-Control for every response plus X-Robots-Tag for the
 * private routes. API responses and the room/configurator pages are `no-store`; hashed assets
 * are immutable; everything else is revalidated.
 */
export function pathHeaders(pathname: string): Record<string, string> {
  if (pathname.startsWith('/api/') || pathname.startsWith('/ws/')) {
    return { 'Cache-Control': 'no-store' };
  }
  if (isPrivateRoute(pathname)) {
    return { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
  }
  if (pathname.startsWith(IMMUTABLE_PREFIX)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  return { 'Cache-Control': 'no-cache' };
}

export interface MutableHeaders {
  set(name: string, value: string): void;
  delete(name: string): void;
  has(name: string): boolean;
}

/**
 * Apply security + path headers to a response and strip implementation-revealing headers.
 * Existing Cache-Control set by a handler is kept.
 */
export function applySecurityHeaders(
  target: MutableHeaders,
  pathname: string,
  opts: HeaderOptions = {},
): void {
  for (const name of REMOVE_HEADERS) target.delete(name);
  for (const [k, v] of Object.entries(securityHeaders(opts))) target.set(k, v);
  for (const [k, v] of Object.entries(pathHeaders(pathname))) {
    if (k === 'Cache-Control' && target.has(k)) continue;
    target.set(k, v);
  }
}

/**
 * Netlify/Cloudflare-style `_headers` file. The `/*` block carries the security headers; the
 * Cache-Control and X-Robots-Tag rules live in their own blocks because these hosts join values
 * of a header that matches several rules.
 */
export function headersFile(opts: HeaderOptions = {}): string {
  const block = (pattern: string, headers: Record<string, string>) =>
    `${pattern}\n${Object.entries(headers)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')}\n`;
  const blocks = [block('/*', securityHeaders(opts))];
  for (const r of PRIVATE_ROUTES) {
    blocks.push(block(r, pathHeaders(r)));
    blocks.push(block(`${r}/*`, pathHeaders(r)));
  }
  blocks.push(block(`${IMMUTABLE_PREFIX}*`, pathHeaders(IMMUTABLE_PREFIX)));
  return blocks.join('\n');
}
