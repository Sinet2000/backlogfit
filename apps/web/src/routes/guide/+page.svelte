<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  import Seo from '#lib/seo/Seo.svelte';
  import { SITE_ORIGIN } from '#lib/seo/site.ts';

  const steps: { title: string; body: string }[] = [
    {
      title: 'Prepare a short list',
      body: 'Pick the 5 to 15 backlog items you want sized. Have the ticket IDs at hand, for example SCP-3655.',
    },
    {
      title: 'Create the session',
      body: 'Open “Start a session”, keep the Fibonacci cards unless your team uses something else, and press Create. It takes about a minute.',
    },
    {
      title: 'Keep the host link safe',
      body: 'You get two links. The host link gives you control; keep it for yourself. Share only the join link.',
    },
    {
      title: 'Invite the team',
      body: 'Paste the join link in the meeting chat or show the QR code. People type a name and they are in. No accounts.',
    },
    {
      title: 'Add the tasks',
      body: 'Paste your list in the Tasks step, one per line, and drag it into the order you want. An ID followed by a short title works best. You can also add tasks in the room at any time.',
    },
    {
      title: 'Explain the first task',
      body: 'Press “Start first task”. The product owner explains it in a couple of minutes and answers questions.',
    },
    {
      title: 'Everyone votes in secret',
      body: 'Each person picks a card. You see who has voted, never what. This keeps anyone from anchoring on the first opinion.',
    },
    {
      title: 'Reveal together',
      body: 'When everyone has voted the cards turn over by themselves (or press Reveal). The screen shows the median and how close the votes are.',
    },
    {
      title: 'Talk about the gaps',
      body: 'If the votes are split, ask the highest and the lowest voter why. Then press “Vote again”. Two rounds are usually enough.',
    },
    {
      title: 'Record the estimate and move on',
      body: 'Choose the final estimate (the suggested card is preselected) and press Next. At the end download the results or copy the summary into your tracker.',
    },
  ];
</script>

<Seo
  title="Manager guide: run an estimation session"
  description="A plain-language guide to story points and to running a backlog refinement session with Backlogfit in ten steps."
  path="/guide"
  type="article"
  jsonLd={{
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Run a backlog estimation session',
    url: `${SITE_ORIGIN}/guide`,
    totalTime: 'PT45M',
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.body })),
  }}
/>

<div class="container">
  <article class="prose guide">
    <p class="eyebrow">Manager guide</p>
    <h1>Run a calm, useful estimation session</h1>
    <p class="lead">
      This page explains story points in plain words and walks you through a refinement session from start
      to finish. No agile background needed. It prints on two pages.
    </p>

    <h2 id="story-points">What are story points?</h2>
    <p>
      A story point is a <strong>relative</strong> size. Instead of guessing hours, the team compares work
      with work: “this is about twice as big as that”. Size includes effort, complexity and uncertainty.
    </p>
    <p>
      The numbers grow faster as they get bigger (1, 2, 3, 5, 8, 13, 21) because big work is harder to
      predict. If something feels bigger than 13, it usually should be split into smaller pieces.
    </p>
    <ul>
      <li><strong>Small numbers</strong> mean the team understands the work well.</li>
      <li><strong>?</strong> means “I need more information”.</li>
      <li><strong>☕</strong> means “let’s take a short break”.</li>
      <li><strong>∞</strong> means “too big to estimate, split it first”.</li>
    </ul>
    <blockquote>
      Points are for the team to plan its own work. They are not a measure of individual performance and
      should not be compared between teams.
    </blockquote>

    <h2 id="steps">A session in 10 steps</h2>
    <ol class="steps">
      {#each steps as s (s.title)}
        <li><strong>{s.title}.</strong> {s.body}</li>
      {/each}
    </ol>

    <h2 id="tips">Tips from experienced facilitators</h2>
    <ul>
      <li><strong>Time-box each task.</strong> Five minutes is plenty. Use the round timer if discussions drift.</li>
      <li><strong>Agree on a reference.</strong> Pick one well-known finished task and call it a 3. Size everything against it.</li>
      <li><strong>Listen to the outliers.</strong> The person who voted very differently often knows something the others do not.</li>
      <li><strong>Do not average away disagreement.</strong> A split vote is a signal to talk, not a number to compute.</li>
      <li><strong>Use anonymous results</strong> when hierarchy might make people hold back.</li>
      <li><strong>Turn on approvals</strong> (the lobby) or a passcode for sessions with external guests.</li>
      <li><strong>Lock the session</strong> once everyone has joined, if you want to be sure nobody else comes in.</li>
    </ul>

    <h2 id="teams">Estimating with several teams</h2>
    <p>
      If developers, testers or analysts size different parts of the backlog, add them as teams (up to six) in
      the Tasks step, or later in Session settings. Each team gets its own join link, so people find their team
      already picked when they join. They can still choose another one; a team link is a convenience, not a
      password.
    </p>
    <ul>
      <li><strong>Choose who estimates a task.</strong> End a pasted line with a tag such as <code>#qa</code>, use
        “Estimated by” next to the add form, or open a task’s menu. Only that team gets the cards; everyone
        else sees “QA is estimating this task. You can follow along.”</li>
      <li><strong>Compare teams.</strong> On a task for everyone, the results also show each team’s median and
        number of votes, never names. In anonymous sessions this is hidden when a team has only one vote, so
        nobody’s card can be worked out.</li>
      <li><strong>Move people.</strong> In the People list, open a person’s menu to change their team, make them a
        spectator or a voter, make them a co-host, or remove them.</li>
    </ul>

    <h2 id="privacy">Privacy in one paragraph</h2>
    <p>
      Backlogfit uses no cookies, no tracking and no third-party services. The secret part of the links is
      created in your browser and the server stores only a fingerprint of it. Votes stay hidden until the
      reveal. When the session ends or expires, everything about it is deleted.
    </p>

    <h2 id="shortcuts">Keyboard shortcuts</h2>
    <table>
      <thead><tr><th scope="col">Key</th><th scope="col">What it does</th></tr></thead>
      <tbody>
        <tr><td><kbd>1</kbd> – <kbd>9</kbd></td><td>Pick the card in that position</td></tr>
        <tr><td><kbd>Space</kbd></td><td>Reveal the votes (host)</td></tr>
        <tr><td><kbd>N</kbd></td><td>Next task (host)</td></tr>
        <tr><td><kbd>?</kbd></td><td>Show all shortcuts</td></tr>
      </tbody>
    </table>

    <div class="actions no-print">
      <Button href="/new" variant="primary" size="lg" iconAfter="right">Start a session</Button>
      <Button href="/r?demo" variant="secondary" size="lg">Try the offline demo</Button>
      <Button variant="ghost" onclick={() => window.print()}>Print this guide</Button>
    </div>
  </article>
</div>

<style>
  .lead {
    font-size: var(--text-xl);
    color: var(--color-text-muted);
  }

  .steps li {
    padding-left: var(--space-1);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: 0.85em;
    padding: 1px 6px;
    border: 1px solid var(--color-border-strong);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-12);
  }

  @media print {
    .guide {
      padding-block: 0;
      font-size: 11pt;
    }

    .guide :global(h2) {
      break-after: avoid;
      margin-top: 18pt;
    }

    .steps li {
      break-inside: avoid;
    }
  }
</style>
