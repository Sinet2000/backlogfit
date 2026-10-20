import { canonicalUrl } from '#lib/seo/site.ts';

export const prerender = true;

const PAGES = [
  '/',
  '/guide',
  '/planning-poker-alternative',
  '/how-story-point-estimation-works',
  '/compare',
  '/faq',
  '/guides',
  '/guides/backlog-refinement',
  '/guides/sprint-planning',
  '/guides/fibonacci-vs-t-shirt-sizing',
  '/security',
  '/privacy',
  '/self-hosting',
] as const;

export function GET(): Response {
  const urls = PAGES.map((p) => `  <url><loc>${canonicalUrl(p)}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
