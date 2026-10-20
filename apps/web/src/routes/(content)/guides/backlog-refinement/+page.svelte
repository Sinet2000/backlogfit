<script lang="ts">
import Seo from '#lib/seo/Seo.svelte';
import { SITE_ORIGIN } from '#lib/seo/site.ts';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Backlog refinement with story points',
    description:
      'How to prepare and facilitate a backlog refinement session with story point estimation.',
    url: `${SITE_ORIGIN}/guides/backlog-refinement`,
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
        name: 'Backlog refinement',
        item: `${SITE_ORIGIN}/guides/backlog-refinement`,
      },
    ],
  },
];
</script>

<Seo
  title="Backlog refinement with story points"
  description="Run a focused backlog refinement session: prepare items, estimate with story points, handle split votes and split items that are too big."
  path="/guides/backlog-refinement"
  type="article"
  {jsonLd}
/>

<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/guides">Guides</a></li>
    <li aria-current="page">Backlog refinement</li>
  </ol>
</nav>

<header>
  <h1>Backlog refinement with story points</h1>
  <p>
    Backlog refinement is the regular meeting where the team clarifies upcoming work and sizes
    it, so that sprint planning can focus on commitments instead of discovery. Estimating with
    story points is usually the last step for each item, and the most useful one: disagreement
    in the votes shows exactly where understanding differs.
  </p>
</header>

<section aria-labelledby="before">
  <h2 id="before">Before the session</h2>
  <ul>
    <li>
      <strong>Pick the right items.</strong> Choose the next 5 to 15 items by priority. Each
      should have a short goal and draft acceptance criteria.
    </li>
    <li>
      <strong>Share them early.</strong> Send the list a day ahead so people can read and ask
      questions asynchronously.
    </li>
    <li>
      <strong>Agree on reference items.</strong> Keep two or three finished items with known
      sizes, for example "the export button was a 2", so new items have something to be compared
      against.
    </li>
    <li>
      <strong>Prepare the room.</strong> Create a Backlogfit room, choose the deck and paste the
      item IDs or links. For confidential work, use the IDs-only link policy.
    </li>
  </ul>
</section>

<section aria-labelledby="during">
  <h2 id="during">During the session</h2>
  <ol>
    <li>The product owner presents an item in about two minutes.</li>
    <li>The team asks questions. Nobody mentions numbers yet, to avoid anchoring.</li>
    <li>Everyone votes privately; the facilitator reveals when all votes are in.</li>
    <li>
      If the votes agree or sit on adjacent values, take the most common value (or the higher one)
      and move on.
    </li>
    <li>
      If they are far apart, the highest and lowest voters explain their reasoning. Then re-vote
      once.
    </li>
    <li>Record the final estimate and go to the next item.</li>
  </ol>
  <p>
    Timebox each item to roughly five minutes. The room's timer helps keep the pace without the
    facilitator having to interrupt.
  </p>
</section>

<section aria-labelledby="special">
  <h2 id="special">Handling special cases</h2>
  <h3>Votes stay split after a re-vote</h3>
  <p>
    Take the higher estimate, or park the item and write down the open question. A second round
    of discussion rarely adds much; a short spike or a conversation with the right person does.
  </p>
  <h3>The ? card</h3>
  <p>
    Someone does not understand the item well enough to estimate. That is useful information:
    clarify, or send the item back for more refinement.
  </p>
  <h3>The ∞ card or very large votes</h3>
  <p>
    An ∞, or a vote of 13 or more, usually means the item is too big to finish in a sprint.
    Split it during the session, for example by workflow step, by business rule, by data type or
    by happy path versus edge cases, and estimate the parts.
  </p>
  <h3>The coffee card</h3>
  <p>Someone needs a break. Take five minutes; tired teams estimate poorly.</p>
</section>

<section aria-labelledby="after">
  <h2 id="after">After the session</h2>
  <p>
    Export the results as CSV, JSON or Markdown and copy the estimates into your tracker. Close
    the room; all its data is deleted. Next, use the estimates in
    <a href="/guides/sprint-planning">sprint planning</a>.
  </p>
</section>
