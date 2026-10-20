export const SITE_ORIGIN = 'https://backlogfit.com';
export const SITE_NAME = 'Backlogfit';
export const TAGLINE = 'Fit the backlog. Estimate together.';
export const REPO_URL = 'https://github.com/Sinet2000/backlogfit';
export const DEFAULT_OG_IMAGE = '/og/default.png';

/** Absolute canonical URL for a site path ("/", "/guide", "/faq"). */
export function canonicalUrl(path: string): string {
  const clean = `/${path.replace(/^\/+/, '')}`;
  return `${SITE_ORIGIN}${clean === '/' ? '/' : clean.replace(/\/+$/, '')}`;
}

/**
 * Serialize JSON-LD so it is safe inside a <script type="application/ld+json"> data block:
 * characters that could end the element or would be HTML-escaped are written as \u escapes,
 * which JSON parsers read back unchanged.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
