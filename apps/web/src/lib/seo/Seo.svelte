<script lang="ts">
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_ORIGIN, serializeJsonLd } from './site.ts';

interface Props {
  /** Page title without the site name (it is appended), or the full title for the home page. */
  title: string;
  description: string;
  /** Site path, e.g. "/guide". Used for the canonical URL and og:url. */
  path: string;
  noindex?: boolean;
  /** One JSON-LD object or a list of them. Rendered as a non-executable data block. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Site-relative or absolute image URL (1200×630). */
  ogImage?: string;
  type?: 'website' | 'article';
}

let {
  title,
  description,
  path,
  noindex = false,
  jsonLd,
  ogImage,
  type = 'website',
}: Props = $props();

const fullTitle = $derived(title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`);
const url = $derived(canonicalUrl(path));
const image = $derived.by(() => {
  const src = ogImage ?? DEFAULT_OG_IMAGE;
  return /^https?:\/\//.test(src) ? src : `${SITE_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`;
});
const ld = $derived(
  jsonLd === undefined ? null : serializeJsonLd(Array.isArray(jsonLd) ? jsonLd : [jsonLd]),
);
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:type" content={type} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={image} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
  {#if ld !== null}
    <svelte:element this={'script'} type="application/ld+json">{ld}</svelte:element>
  {/if}
</svelte:head>
