<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';

  const steps = [
    {
      name: 'Prepare a short list of refined backlog items',
      text: 'Pick the items the team will estimate and make sure each has a clear goal and acceptance criteria. Copy their IDs or links, one per line.',
    },
    {
      name: 'Create a room and choose a scale',
      text: 'Open Backlogfit, choose New room, pick a deck such as Fibonacci or T-shirt sizes, and paste the task list.',
    },
    {
      name: 'Share the join link',
      text: 'Send the join link or show the QR code. Participants type a display name and join as voters or spectators. No sign-up is needed.',
    },
    {
      name: 'Explain the item',
      text: 'The product owner presents the first item in a couple of minutes and answers questions. Nobody mentions numbers yet.',
    },
    {
      name: 'Vote privately',
      text: 'Everyone picks a card. The room shows who has voted, but not what, until the reveal.',
    },
    {
      name: 'Reveal all votes at once',
      text: 'The facilitator reveals the cards. Backlogfit shows the distribution, median and whether the team has reached consensus.',
    },
    {
      name: 'Discuss outliers and re-vote',
      text: 'If the votes are far apart, the highest and lowest voters explain their thinking. Then the team votes again; earlier rounds stay in the history.',
    },
    {
      name: 'Record the final estimate',
      text: 'The facilitator sets the final story points, moves to the next item and exports the results at the end of the session.',
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to estimate backlog items with story points',
      description:
        'A step-by-step story point estimation session using simultaneous card voting (the planning poker technique).',
      totalTime: 'PT45M',
      tool: [{ '@type': 'HowToTool', name: 'Backlogfit (free, open source, runs in the browser)' }],
      step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
        url: `${SITE_ORIGIN}/how-story-point-estimation-works#step-${i + 1}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'How story point estimation works',
          item: `${SITE_ORIGIN}/how-story-point-estimation-works`,
        },
      ],
    },
  ];
</script>

<Seo
  title="How story point estimation works"
  description="Story points in plain language: what they measure, why teams vote with cards, and a step-by-step agile estimation session you can run today."
  path="/how-story-point-estimation-works"
  ogImage="/og/how-story-point-estimation-works.png"
  type="article"
  {jsonLd}
/>

<header>
  <h1>How story point estimation works</h1>
  <p>
    Story point estimation is how many agile teams size their backlog: instead of guessing
    hours, the team compares items with each other and agrees on a relative number. This page
    explains the idea in plain language and walks through a complete session.
  </p>
</header>

<section aria-labelledby="what">
  <h2 id="what">What a story point measures</h2>
  <p>
    A story point is a relative measure of the effort needed to finish a backlog item. It
    combines three things that hours tend to hide:
  </p>
  <ul>
    <li><strong>Amount of work</strong>: how much there is to build, test and release.</li>
    <li><strong>Complexity</strong>: how hard the problem is to solve.</li>
    <li><strong>Uncertainty</strong>: how much the team does not know yet.</li>
  </ul>
  <p>
    The numbers only mean something in comparison. If a small text change is a 1, an item that
    feels twice as big is a 2, and something much larger might be an 8. Over a few sprints the
    team learns how many points it usually finishes (its velocity), which makes sprint planning
    and forecasts more reliable than hour estimates.
  </p>
</section>

<section aria-labelledby="why-cards">
  <h2 id="why-cards">Why teams vote with cards</h2>
  <p>
    The most common technique is often called planning poker or scrum poker. Each person
    chooses an estimate privately, and everyone reveals at the same moment. This matters for
    two reasons:
  </p>
  <ul>
    <li>
      <strong>No anchoring.</strong> When the first person says "about a 3", others drift towards
      that number. Simultaneous reveal keeps each estimate independent.
    </li>
    <li>
      <strong>Hidden disagreements surface.</strong> A 2 next to a 13 usually means two people
      imagine different work. The conversation that follows is where the real value of
      estimation lies: it uncovers risks, missing requirements and simpler solutions.
    </li>
  </ul>
</section>

<section aria-labelledby="scales">
  <h2 id="scales">Choosing a scale</h2>
  <p>
    Most teams use Fibonacci estimation (1, 2, 3, 5, 8, 13, 21): the gaps grow with size, which
    reflects how uncertainty grows with larger items. T-shirt sizing (XS to XXL) works well for
    rough, early sizing of epics or roadmap items. Backlogfit supports both, plus modified
    Fibonacci, powers of two, a linear scale and custom decks. Read
    <a href="/guides/fibonacci-vs-t-shirt-sizing">Fibonacci vs T-shirt sizing</a> for help choosing.
  </p>
</section>

<section aria-labelledby="session">
  <h2 id="session">A session, step by step</h2>
  <ol>
    {#each steps as step, i (step.name)}
      <li id={`step-${i + 1}`}>
        <strong>{step.name}.</strong>
        {step.text}
      </li>
    {/each}
  </ol>
  <p>
    A typical backlog refinement session estimates 8 to 15 items in 45 minutes. Aim for about
    five minutes per item; if an item needs much longer, it probably needs more refinement or
    splitting.
  </p>
</section>

<section aria-labelledby="pitfalls">
  <h2 id="pitfalls">Common pitfalls</h2>
  <ul>
    <li>Converting points to hours or days. Use velocity for forecasts instead.</li>
    <li>Comparing points between teams. Each team's scale is its own.</li>
    <li>Re-voting until everyone agrees. Adjacent values are usually close enough.</li>
    <li>Estimating items nobody understands. Use the ? card and clarify first.</li>
  </ul>
</section>

<section aria-labelledby="next">
  <h2 id="next">Try it</h2>
  <p>
    Backlogfit is free, open source and needs no sign-up. <a href="/new">Start a session</a>, or
    read the <a href="/guides/backlog-refinement">backlog refinement guide</a> for facilitation tips.
  </p>
</section>
