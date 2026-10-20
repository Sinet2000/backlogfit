<script lang="ts">
import Seo from '#lib/seo/Seo.svelte';
import { SITE_ORIGIN } from '#lib/seo/site.ts';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Sprint planning with story points',
    description: 'How to use story point estimates and velocity to plan a realistic sprint.',
    url: `${SITE_ORIGIN}/guides/sprint-planning`,
    publisher: { '@type': 'Organization', name: 'Backlogfit', url: `${SITE_ORIGIN}/` },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_ORIGIN}/guides` },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Sprint planning',
        item: `${SITE_ORIGIN}/guides/sprint-planning`,
      },
    ],
  },
];
</script>

<Seo
  title="Sprint planning with story points"
  description="Plan a realistic sprint with story points and velocity: capacity, buffers, estimating new items on the spot, and mistakes to avoid."
  path="/guides/sprint-planning"
  type="article"
  {jsonLd}
/>

<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/guides">Guides</a></li>
    <li aria-current="page">Sprint planning</li>
  </ol>
</nav>

<header>
  <h1>Sprint planning with story points</h1>
  <p>
    In sprint planning the team decides what it can deliver in the coming sprint and how. Story
    points make the "what" quicker: if most items were already estimated during backlog
    refinement, planning becomes a conversation about goals and capacity instead of a long
    estimation meeting.
  </p>
</header>

<section aria-labelledby="velocity">
  <h2 id="velocity">Start from velocity</h2>
  <p>
    Velocity is the number of story points the team actually finished per sprint. Use the
    average of the last three to five sprints, not the best one. A team that finished 21, 26 and
    23 points can plan for about 23.
  </p>
  <ul>
    <li>Count only items that met the definition of done.</li>
    <li>Adjust for capacity: holidays, on-call duty, training, new team members.</li>
    <li>Leave a buffer for support work and surprises, often 10 to 20 percent.</li>
  </ul>
</section>

<section aria-labelledby="steps">
  <h2 id="steps">A simple agenda</h2>
  <ol>
    <li>The product owner proposes a sprint goal and the top items that support it.</li>
    <li>The team checks that each item is estimated and still understood the same way.</li>
    <li>
      New or changed items get a quick estimate in a Backlogfit room, with the same scale the
      team uses in refinement.
    </li>
    <li>The team pulls items until the total reaches its planned capacity.</li>
    <li>The team breaks the first items into tasks and confirms the sprint goal.</li>
  </ol>
</section>

<section aria-labelledby="mistakes">
  <h2 id="mistakes">Mistakes to avoid</h2>
  <ul>
    <li>
      <strong>Treating velocity as a target.</strong> Pushing for more points leads to inflated
      estimates, not more delivered work.
    </li>
    <li>
      <strong>Re-estimating finished work.</strong> Keep the original estimate; the difference
      is part of what the team learns.
    </li>
    <li>
      <strong>Planning to 100 percent.</strong> A sprint without slack fails at the first
      unexpected bug.
    </li>
    <li>
      <strong>Comparing velocity across teams.</strong> Each team's points are relative to its
      own reference items.
    </li>
  </ul>
</section>

<section aria-labelledby="more">
  <h2 id="more">Related</h2>
  <ul>
    <li><a href="/guides/backlog-refinement">Backlog refinement with story points</a></li>
    <li><a href="/guides/fibonacci-vs-t-shirt-sizing">Fibonacci estimation vs T-shirt sizing</a></li>
  </ul>
</section>
