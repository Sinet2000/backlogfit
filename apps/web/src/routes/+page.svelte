<script lang="ts">
import Seo from '#lib/seo/Seo.svelte';
import { SITE_NAME, SITE_ORIGIN, TAGLINE } from '#lib/seo/site.ts';
</script>

<Seo
  title={`${SITE_NAME}: story point estimation for agile teams`}
  description="Privacy-first story point estimation for agile teams. No sign-up, no tracking, open source and self-hostable."
  path="/"
  jsonLd={{
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_ORIGIN,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }}
/>

<section class="container">
  <h1>{TAGLINE}</h1>
  <p><a href="/new">Start a session</a> · <a href="/guide">How it works</a></p>
</section>
