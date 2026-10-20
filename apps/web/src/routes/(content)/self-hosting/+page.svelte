<script lang="ts">
  import Seo from '#lib/seo/Seo.svelte';
  import { REPO_URL, SITE_ORIGIN } from '#lib/seo/site.ts';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Self-hosting',
        item: `${SITE_ORIGIN}/self-hosting`,
      },
    ],
  };

  const runCommand =
    'podman run -d --name backlogfit -p 8080:8080 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=256 --memory=512m -v backlogfit-data:/data -e PUBLIC_ORIGIN=https://estimate.example.com ghcr.io/sinet2000/backlogfit:latest';

  const verifyCommand =
    "cosign verify ghcr.io/sinet2000/backlogfit@sha256:<digest> --certificate-identity-regexp '^https://github.com/Sinet2000/backlogfit/.github/workflows/release.yml@refs/tags/v' --certificate-oidc-issuer https://token.actions.githubusercontent.com";

  const settings = [
    {
      name: 'PUBLIC_ORIGIN',
      value: 'required',
      note: 'Public URL of your instance; used for origin checks.',
    },
    { name: 'PORT', value: '8080', note: 'Listening port inside the container.' },
    {
      name: 'DATA_DIR',
      value: '/data in the image',
      note: 'SQLite storage directory (a volume); set it empty to keep rooms in memory only.',
    },
    { name: 'DEFAULT_LIFETIME_HOURS', value: '2', note: 'Default room lifetime.' },
    { name: 'MAX_LIFETIME_HOURS', value: '8', note: 'Hard maximum, including extensions.' },
    { name: 'IDLE_TIMEOUT_MINUTES', value: '30', note: 'Close rooms without activity.' },
    { name: 'MAX_PARTICIPANTS', value: '50', note: 'Per room.' },
    { name: 'MAX_ROOMS', value: '1000', note: 'Concurrent rooms per instance.' },
    { name: 'TRUST_PROXY', value: 'false', note: 'Set to true behind a trusted reverse proxy.' },
  ];
</script>

<Seo
  title="Self-hosted story point estimation"
  description="Run Backlogfit on your own infrastructure: one hardened container for Podman or Docker, no database, no outbound requests, signed images."
  path="/self-hosting"
  {jsonLd}
/>

<header>
  <h1>Self-hosted story point estimation</h1>
  <p>
    Teams with strict data policies can run their own Backlogfit instance. It is one small,
    signed container image with no external database and no outbound connections, so it fits in
    isolated and air-gapped networks.
  </p>
</header>

<section aria-labelledby="options">
  <h2 id="options">Deployment options</h2>
  <ul>
    <li>
      <strong>Container (Podman or Docker).</strong> A Node.js server that serves the web app and
      runs rooms in memory, optionally persisting to SQLite in a volume.
    </li>
    <li>
      <strong>Cloudflare Workers.</strong> Deploy the Worker and Durable Object version to your
      own Cloudflare account.
    </li>
  </ul>
</section>

<section aria-labelledby="run">
  <h2 id="run">Run the container</h2>
  <p>The image runs as a non-root user and works with a read-only root file system:</p>
  <pre><code>{runCommand}</code></pre>
  <p>
    Docker accepts the same flags. Put the container behind a reverse proxy that terminates TLS,
    and set <code>PUBLIC_ORIGIN</code> to the address your team uses. Rooms are stored in the
    <code>/data</code> volume so they survive restarts; mount a named volume there (for example
    <code>-v backlogfit-data:/data</code>) or set <code>DATA_DIR</code> empty to keep them in memory.
  </p>
</section>

<section aria-labelledby="settings">
  <h2 id="settings">Main settings</h2>
  <table>
    <caption>Environment variables (all have safe defaults except PUBLIC_ORIGIN)</caption>
    <thead>
      <tr>
        <th scope="col">Variable</th>
        <th scope="col">Default</th>
        <th scope="col">Purpose</th>
      </tr>
    </thead>
    <tbody>
      {#each settings as s (s.name)}
        <tr>
          <th scope="row"><code>{s.name}</code></th>
          <td>{s.value}</td>
          <td>{s.note}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p>
    Rate limits and message size limits can be tuned as well; see the
    <a href={`${REPO_URL}/blob/main/docs/security/SELF_HOSTING.md`} rel="noopener noreferrer">self-hosting guide</a>
    for the complete list and hardening advice.
  </p>
</section>

<section aria-labelledby="verify">
  <h2 id="verify">Verify the image</h2>
  <p>
    Every release image is signed with Sigstore cosign (keyless), scanned with Trivy, and comes
    with CycloneDX SBOMs and build provenance. Deploy by digest and verify the signature first:
  </p>
  <pre><code>{verifyCommand}</code></pre>
</section>

<section aria-labelledby="next">
  <h2 id="next">Next steps</h2>
  <ul>
    <li><a href="/security">Security overview</a> for your review board.</li>
    <li>
      <a href={`${REPO_URL}/releases`} rel="noopener noreferrer">Releases</a> with SBOMs and notes.
    </li>
    <li>
      <a href={REPO_URL} rel="noopener noreferrer">Source code</a> under the Apache-2.0 license.
    </li>
  </ul>
</section>
