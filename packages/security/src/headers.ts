export interface HeaderOptions {
  /** Extra origins for connect-src, e.g. a separate WebSocket host. Same-origin is always allowed. */
  connectSrc?: readonly string[];
  /** Development mode: no HSTS, no upgrade-insecure-requests. */
  dev?: boolean;
}

export function contentSecurityPolicy(opts: HeaderOptions = {}): string {
  const connect = ["'self'", ...(opts.connectSrc ?? [])].join(' ');
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src ${connect}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "worker-src 'none'",
  ];
  if (!opts.dev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function securityHeaders(opts: HeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': contentSecurityPolicy(opts),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (!opts.dev) headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains';
  return headers;
}

/** Netlify/Cloudflare-style `_headers` file applying the headers to every path. */
export function headersFile(opts: HeaderOptions = {}): string {
  const lines = Object.entries(securityHeaders(opts)).map(([k, v]) => `  ${k}: ${v}`);
  return `/*\n${lines.join('\n')}\n`;
}
