<script lang="ts">
import Seo from '#lib/seo/Seo.svelte';
import { REPO_URL, SITE_ORIGIN } from '#lib/seo/site.ts';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name: 'Privacy', item: `${SITE_ORIGIN}/privacy` },
  ],
};
</script>

<Seo
  title="Privacy: no sign-up, no tracking"
  description="What Backlogfit stores and for how long: a display name and votes for the room's lifetime, then deleted. No accounts, cookies, analytics or ads."
  path="/privacy"
  {jsonLd}
/>

<header>
  <h1>Privacy</h1>
  <p>
    Backlogfit is privacy-friendly by design: it collects as little as possible, keeps it only as
    long as a room is open, and shares it with nobody. This summary applies to backlogfit.com;
    self-hosted instances follow the same software behavior, operated by your organization.
  </p>
</header>

<section aria-labelledby="collect">
  <h2 id="collect">What is processed</h2>
  <table>
    <caption>Data processed during a room's lifetime</caption>
    <thead>
      <tr>
        <th scope="col">Data</th>
        <th scope="col">Why</th>
        <th scope="col">Kept for</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Display name you type</th>
        <td>Show the team who is in the room and who has voted</td>
        <td>Room lifetime</td>
      </tr>
      <tr>
        <th scope="row">Votes and final estimates</th>
        <td>Reveal, statistics and history within the session</td>
        <td>Room lifetime</td>
      </tr>
      <tr>
        <th scope="row">Room settings and task list</th>
        <td>Run the session the facilitator configured</td>
        <td>Room lifetime</td>
      </tr>
      <tr>
        <th scope="row">Hashes of room secrets</th>
        <td>Check that a participant holds a valid link</td>
        <td>Room lifetime</td>
      </tr>
    </tbody>
  </table>
  <p>
    A room lives at most 8 hours (2 by default) and closes after 30 minutes without activity.
    When it closes, everything above is deleted.
  </p>
</section>

<section aria-labelledby="not">
  <h2 id="not">What is not collected</h2>
  <ul>
    <li>No accounts, emails or passwords: there is no sign-up.</li>
    <li>No cookies, analytics, advertising or tracking pixels.</li>
    <li>No third-party fonts, scripts or content delivery networks.</li>
    <li>No IP addresses stored or logged by the application.</li>
    <li>No room secrets on the server: they stay in the link's fragment, which browsers do not send.</li>
  </ul>
</section>

<section aria-labelledby="browser">
  <h2 id="browser">In your browser</h2>
  <p>
    To let you reconnect after a page reload, the browser keeps your room link and a reconnect
    token in session storage, which is cleared when you close the tab. Your theme preference may
    be kept in local storage. Exports are created locally and never uploaded.
  </p>
</section>

<section aria-labelledby="hosting">
  <h2 id="hosting">Hosting</h2>
  <p>
    backlogfit.com runs on Cloudflare's network with request logging and observability disabled
    for the application. If your organization needs full control over where data is processed,
    <a href="/self-hosting">self-host Backlogfit</a> in your own environment.
  </p>
</section>

<section aria-labelledby="details">
  <h2 id="details">Details and contact</h2>
  <p>
    The complete data flow is documented in
    <a href={`${REPO_URL}/blob/main/docs/security/PRIVACY.md`} rel="noopener noreferrer">PRIVACY.md</a>.
    Questions can be raised in the project's
    <a href={`${REPO_URL}/issues`} rel="noopener noreferrer">GitHub issues</a>; please never post
    room links. For security concerns, see the <a href="/security">security overview</a>.
  </p>
</section>
