<script lang="ts">
import Seo from '#lib/seo/Seo.svelte';
import { REPO_URL, SITE_ORIGIN } from '#lib/seo/site.ts';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Backlogfit',
    url: `${SITE_ORIGIN}/`,
    description:
      'Free, open-source and privacy-friendly story point estimation for agile teams. No sign-up, self-hostable.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    isAccessibleForFree: true,
    codeRepository: REPO_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Planning poker alternative',
        item: `${SITE_ORIGIN}/planning-poker-alternative`,
      },
    ],
  },
];
</script>

<Seo
  title="A free, open-source planning poker alternative"
  description="Backlogfit is a free planning poker alternative for story point estimation: open source, no sign-up, privacy-friendly and self-hosted if you need it."
  path="/planning-poker-alternative"
  ogImage="/og/planning-poker-alternative.png"
  {jsonLd}
/>

<header>
  <h1>A free, open-source planning poker alternative</h1>
  <p>
    Backlogfit keeps everything teams like about planning poker (private votes, a simultaneous
    reveal, a quick discussion) and removes what gets in the way: accounts, ads, tracking and
    data you cannot control. It is free, open source under Apache-2.0, and can run on your own
    infrastructure.
  </p>
</header>

<section aria-labelledby="same">
  <h2 id="same">The technique you know</h2>
  <p>
    Planning poker, sometimes called scrum poker, is a consensus-based way to estimate backlog
    items in story points. Everyone picks a card in secret, all cards are revealed together, and
    the team talks about the differences. Backlogfit supports this flow end to end, with
    Fibonacci estimation, T-shirt sizing and custom decks.
  </p>
</section>

<section aria-labelledby="different">
  <h2 id="different">What is different</h2>
  <ul>
    <li>
      <strong>No sign-up, for anyone.</strong> The facilitator creates a room and shares a link;
      participants type a display name. No email, no password, no account to delete later.
    </li>
    <li>
      <strong>Votes stay private until the reveal.</strong> The server never sends anyone's
      vote value to others before the reveal, not even to the facilitator.
    </li>
    <li>
      <strong>Nothing is kept.</strong> Rooms expire after a few hours and all their data is
      deleted. There are no cookies, analytics or third-party scripts.
    </li>
    <li>
      <strong>Secure by design.</strong> Room secrets live only in the link's fragment and are
      stored as hashes; a strict Content Security Policy blocks injected scripts. See the
      <a href="/security">security overview</a>.
    </li>
    <li>
      <strong>Self-hosted if you want.</strong> One container image, no external database, no
      outbound requests. See <a href="/self-hosting">self-hosting</a>.
    </li>
    <li>
      <strong>Open source.</strong> Every line can be reviewed, audited and changed. Releases are
      signed and ship with an SBOM.
    </li>
  </ul>
</section>

<section aria-labelledby="facilitation">
  <h2 id="facilitation">Built for facilitators</h2>
  <ul>
    <li>Paste a task list of IDs or tracker links and step through it.</li>
    <li>Reveal manually or automatically when everyone has voted.</li>
    <li>Re-vote with history, record the final estimate, export to CSV, JSON or Markdown.</li>
    <li>Lobby, passcode, room lock, spectators, co-facilitators and anonymous reveal.</li>
    <li>Timer, keyboard shortcuts, high-contrast mode and screen-reader support.</li>
  </ul>
</section>

<section aria-labelledby="who">
  <h2 id="who">Who it is for</h2>
  <p>
    Any agile team that wants a quick, focused estimation session. It is especially useful for
    teams in banks, insurers, public sector and other enterprises whose security policies rule
    out tools with accounts or external data storage.
  </p>
</section>

<section aria-labelledby="start">
  <h2 id="start">Get started</h2>
  <p>
    <a href="/new">Start a session</a> in under a minute, read
    <a href="/how-story-point-estimation-works">how story point estimation works</a>, or see how
    Backlogfit <a href="/compare">compares by capability</a>.
  </p>
</section>
