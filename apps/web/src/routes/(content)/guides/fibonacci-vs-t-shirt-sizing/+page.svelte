<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Fibonacci estimation vs T-shirt sizing',
      description:
        'When to use Fibonacci story points and when to use T-shirt sizes for agile estimation.',
      url: `${SITE_ORIGIN}/guides/fibonacci-vs-t-shirt-sizing`,
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
          name: 'Fibonacci vs T-shirt sizing',
          item: `${SITE_ORIGIN}/guides/fibonacci-vs-t-shirt-sizing`,
        },
      ],
    },
  ];
</script>

<Seo
  title="Fibonacci estimation vs T-shirt sizing"
  description="Fibonacci story points or T-shirt sizes? When each scale works best for agile estimation, how they map, and which special cards help."
  path="/guides/fibonacci-vs-t-shirt-sizing"
  type="article"
  {jsonLd}
/>

<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/guides">Guides</a></li>
    <li aria-current="page">Fibonacci vs T-shirt sizing</li>
  </ol>
</nav>

<header>
  <h1>Fibonacci estimation vs T-shirt sizing</h1>
  <p>
    Both scales are relative: they compare items with each other instead of predicting hours.
    The difference is precision. Fibonacci numbers can be added up for planning; T-shirt sizes
    are faster and better for rough sizing when little is known.
  </p>
</header>

<section aria-labelledby="fibonacci">
  <h2 id="fibonacci">Fibonacci estimation</h2>
  <p>
    The classic deck is 0, 1, 2, 3, 5, 8, 13, 21. Each step is roughly the sum of the previous
    two, so the gaps widen as items get bigger. That mirrors reality: the bigger an item, the
    less precisely anyone can size it, so arguing about 14 versus 15 makes no sense.
  </p>
  <ul>
    <li><strong>Best for:</strong> sprint-level backlog items, velocity, sprint planning.</li>
    <li>
      <strong>Variant:</strong> modified Fibonacci (0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100) adds a
      half point for tiny items and rounder numbers for large ones.
    </li>
    <li><strong>Watch out:</strong> numbers invite conversion to hours. Resist it.</li>
  </ul>
</section>

<section aria-labelledby="tshirt">
  <h2 id="tshirt">T-shirt sizing</h2>
  <p>
    Sizes XS, S, M, L, XL and XXL. There are no numbers to add up, which keeps the discussion on
    relative size and away from hours or deadlines.
  </p>
  <ul>
    <li>
      <strong>Best for:</strong> epics, roadmap items, early discovery, or teams new to
      estimation.
    </li>
    <li>
      <strong>Watch out:</strong> sizes cannot be summed directly. If you need a forecast,
      agree on a rough mapping (for example S ≈ 3 points) and treat it as approximate.
    </li>
  </ul>
</section>

<section aria-labelledby="table">
  <h2 id="table">At a glance</h2>
  <table>
    <caption>Fibonacci estimation compared with T-shirt sizing</caption>
    <thead>
      <tr>
        <th scope="col">Question</th>
        <th scope="col">Fibonacci</th>
        <th scope="col">T-shirt sizes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Can you add estimates up?</th>
        <td>Yes</td>
        <td>Not directly</td>
      </tr>
      <tr>
        <th scope="row">Typical level</th>
        <td>Stories and tasks for the next sprints</td>
        <td>Epics and roadmap items</td>
      </tr>
      <tr>
        <th scope="row">Speed</th>
        <td>Fast</td>
        <td>Very fast</td>
      </tr>
      <tr>
        <th scope="row">Risk</th>
        <td>Mistaken for hours</td>
        <td>Too coarse for sprint planning</td>
      </tr>
    </tbody>
  </table>
</section>

<section aria-labelledby="special">
  <h2 id="special">Special cards</h2>
  <ul>
    <li><strong>?</strong> means "I can't estimate this yet"; clarify before re-voting.</li>
    <li><strong>∞</strong> means "too big"; split the item.</li>
    <li><strong>Coffee</strong> means "I need a break".</li>
  </ul>
  <p>
    Backlogfit's statistics ignore special cards and count them separately, so a single ? does
    not distort the median.
  </p>
</section>

<section aria-labelledby="choose">
  <h2 id="choose">How to choose</h2>
  <p>
    Use T-shirt sizing when you are sizing the roadmap or many items quickly, and Fibonacci
    estimation once items are ready for a sprint. Many teams use both: T-shirt sizes in quarterly
    planning, Fibonacci story points in <a href="/guides/backlog-refinement">backlog refinement</a>.
    Backlogfit supports both, plus powers of two, a linear scale and custom decks;
    <a href="/new">start a session</a> to try them.
  </p>
</section>
