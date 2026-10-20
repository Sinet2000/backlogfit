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
    'podman run -d --name backlogfit -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp:rw,size=16m,mode=1777,noexec,nosuid,nodev --cap-drop=ALL --security-opt=no-new-privileges --memory=256m --pids-limit=128 -e PUBLIC_ORIGIN=https://estimate.example.com -e TRUST_PROXY=true ghcr.io/sinet2000/backlogfit:latest';

  const buildCommand = 'podman build --format docker -f apps/server/Containerfile -t backlogfit .';

  const verifyCommand =
    "cosign verify ghcr.io/sinet2000/backlogfit@sha256:<digest> --certificate-identity-regexp '^https://github.com/Sinet2000/backlogfit/.github/workflows/release.yml@refs/tags/v' --certificate-oidc-issuer https://token.actions.githubusercontent.com";

  const settings = [
    {
      name: 'PUBLIC_ORIGIN',
      value: 'required in production',
      note: 'Exact public origin; checked on room creation and WebSocket upgrades.',
    },
    { name: 'ALLOWED_ORIGINS', value: 'empty', note: 'Extra exact origins, comma separated.' },
    { name: 'PORT / HOST', value: '8080 / 0.0.0.0', note: 'Listen address inside the container.' },
    {
      name: 'TRUST_PROXY',
      value: 'false',
      note: 'true (one proxy), a hop count 1–9, or cloudflare; decides which address rate limits use.',
    },
    {
      name: 'DATA_DIR',
      value: 'empty (memory)',
      note: 'Directory for SQLite storage if rooms should survive restarts.',
    },
    { name: 'DEFAULT_LIFETIME_HOURS', value: '2', note: 'Default room lifetime (1–24).' },
    { name: 'MAX_LIFETIME_HOURS', value: '8', note: 'Hard maximum including extensions (1–24).' },
    { name: 'IDLE_TIMEOUT_MINUTES', value: '30', note: 'Close rooms without activity.' },
    { name: 'MAX_PARTICIPANTS', value: '50', note: 'Upper bound per room.' },
    { name: 'MAX_TASKS', value: '500', note: 'Tasks per room.' },
    { name: 'MAX_ROOMS', value: '1000', note: 'Concurrent rooms per server.' },
    { name: 'MAX_MESSAGE_BYTES', value: '16384', note: 'Largest accepted WebSocket message.' },
    {
      name: 'RATE_MSGS_PER_SEC / RATE_BURST',
      value: '20 / 40',
      note: 'Per-connection message rate limit.',
    },
    {
      name: 'ROOM_CREATE_PER_MIN',
      value: '10',
      note: 'Room creations per client address per minute.',
    },
    {
      name: 'PASSCODE_MAX_ATTEMPTS',
      value: '5',
      note: 'Wrong passcodes per room before passcode joins are refused.',
    },
    {
      name: 'MAX_CONNECTIONS',
      value: '5000',
      note: 'Concurrent WebSocket connections per server.',
    },
    {
      name: 'MAX_CONNECTIONS_PER_CLIENT',
      value: '50',
      note: 'Concurrent WebSocket connections per client address.',
    },
    {
      name: 'WS_UPGRADES_PER_MIN',
      value: '120',
      note: 'WebSocket upgrades per client address per minute.',
    },
    {
      name: 'HELLO_TIMEOUT_SECONDS',
      value: '20',
      note: 'Close sockets that do not join within this time.',
    },
    {
      name: 'HEARTBEAT_SECONDS',
      value: '30',
      note: 'WebSocket ping interval; dead sockets are dropped.',
    },
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
  <p>
    The image is distroless, runs as a non-root user, works with a read-only root file system and
    keeps rooms in memory by default:
  </p>
  <pre><code>{runCommand}</code></pre>
  <p>
    Docker accepts the same flags. Put the container behind a reverse proxy that terminates TLS
    (hence <code>TRUST_PROXY=true</code> and the loopback-only port), and set
    <code>PUBLIC_ORIGIN</code> to the address your team uses. To keep rooms across restarts, add
    <code>-e DATA_DIR=/data -v backlogfit-data:/data</code>.
  </p>
  <p>
    To build the image from source, use <code>--format docker</code> so the health check is kept:
  </p>
  <pre><code>{buildCommand}</code></pre>
</section>

<section aria-labelledby="settings">
  <h2 id="settings">Settings</h2>
  <table>
    <caption>Environment variables (safe defaults; PUBLIC_ORIGIN is required in production)</caption>
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
    Invalid or out-of-range values stop the server at start-up. See the
    <a href={`${REPO_URL}/blob/main/docs/security/SELF_HOSTING.md`} rel="noopener noreferrer">self-hosting guide</a>
    for hardening advice, reverse proxy examples and network layout.
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
