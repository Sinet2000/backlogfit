<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';
  import { FAQ } from './faq.ts';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.flatMap((g) =>
        g.items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      ),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE_ORIGIN}/faq` },
      ],
    },
  ];
</script>

<Seo
  title="FAQ: story point estimation and privacy"
  description="Answers about Backlogfit: free, open source, no sign-up, how votes stay private, room lifetime, card decks, exports and self-hosting."
  path="/faq"
  ogImage="/og/faq.png"
  {jsonLd}
/>

<header>
  <h1>Frequently asked questions</h1>
  <p>
    Short answers about running agile estimation sessions with Backlogfit, how your data is
    handled, and how to self-host it. Something missing? Ask in the
    <a href="https://github.com/Sinet2000/backlogfit/discussions" rel="noopener noreferrer">GitHub discussions</a>.
  </p>
</header>

<nav aria-label="FAQ sections">
  <ul>
    {#each FAQ as group (group.id)}
      <li><a href={`#${group.id}`}>{group.title}</a></li>
    {/each}
  </ul>
</nav>

{#each FAQ as group (group.id)}
  <section aria-labelledby={group.id}>
    <h2 id={group.id}>{group.title}</h2>
    {#each group.items as item (item.q)}
      <details>
        <summary>{item.q}</summary>
        <p>{item.a}</p>
      </details>
    {/each}
  </section>
{/each}

<section aria-labelledby="more">
  <h2 id="more">More reading</h2>
  <ul>
    <li><a href="/how-story-point-estimation-works">How story point estimation works</a></li>
    <li><a href="/security">Security overview for enterprise teams</a></li>
    <li><a href="/privacy">Privacy</a></li>
    <li><a href="/self-hosting">Self-hosting</a></li>
  </ul>
</section>
