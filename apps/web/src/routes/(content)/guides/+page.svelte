<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';

  const guides = [
    {
      href: '/guides/backlog-refinement',
      title: 'Backlog refinement with story points',
      summary:
        'Prepare items, run a focused estimation session, and handle split votes and items that are too big.',
    },
    {
      href: '/guides/sprint-planning',
      title: 'Sprint planning with story points',
      summary:
        'Use estimates and velocity to plan a realistic sprint, and what to do with items estimated on the spot.',
    },
    {
      href: '/guides/fibonacci-vs-t-shirt-sizing',
      title: 'Fibonacci estimation vs T-shirt sizing',
      summary:
        'When each scale works best, how to switch between them, and which special cards help.',
    },
    {
      href: '/how-story-point-estimation-works',
      title: 'How story point estimation works',
      summary: 'The basics in plain language, with a complete step-by-step session.',
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: guides.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.title,
        url: `${SITE_ORIGIN}${g.href}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_ORIGIN}/guides` },
      ],
    },
  ];
</script>

<Seo
  title="Agile estimation guides"
  description="Practical guides for agile estimation: backlog refinement, sprint planning, and choosing between Fibonacci estimation and T-shirt sizing."
  path="/guides"
  {jsonLd}
/>

<header>
  <h1>Agile estimation guides</h1>
  <p>
    Short, practical guides for Scrum Masters, team leads and product owners who run estimation
    sessions. For a one-page printable version, see the <a href="/guide">Manager guide</a>.
  </p>
</header>

<section aria-labelledby="all">
  <h2 id="all">All guides</h2>
  <ul>
    {#each guides as guide (guide.href)}
      <li>
        <a href={guide.href}>{guide.title}</a>: {guide.summary}
      </li>
    {/each}
  </ul>
</section>
