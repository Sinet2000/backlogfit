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
      'Secure, privacy-friendly story point estimation for banks and enterprise teams: no accounts, no tracking, short-lived rooms, self-hostable.',
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
      { '@type': 'ListItem', position: 2, name: 'Security', item: `${SITE_ORIGIN}/security` },
    ],
  },
];
</script>

<Seo
  title="Security for banks and enterprise"
  description="How Backlogfit protects estimation sessions: no accounts, secrets kept out of server logs, private votes, strict CSP, auto-deletion and signed releases."
  path="/security"
  {jsonLd}
/>

<header>
  <h1>Security overview for banks and enterprise teams</h1>
  <p>
    Backlogfit was designed to pass the security review of strict organizations. This page
    summarizes the model for security, privacy and procurement teams. The full details are in the
    <a href={`${REPO_URL}/blob/main/docs/security/THREAT_MODEL.md`} rel="noopener noreferrer">threat model</a>
    and the open source code.
  </p>
</header>

<section aria-labelledby="summary">
  <h2 id="summary">In one minute</h2>
  <ul>
    <li>No accounts, passwords, emails, cookies, analytics or third-party requests.</li>
    <li>The only personal data is a display name the participant types, which can be a nickname.</li>
    <li>Room secrets never reach the server in a URL; the server stores only hashes.</li>
    <li>Nobody receives another person's vote before the reveal, not even the facilitator.</li>
    <li>Rooms expire after hours, not months, and their storage is deleted.</li>
    <li>Open source (Apache-2.0), signed container images, SBOMs and build provenance.</li>
    <li>Can be self-hosted inside your network with no outbound connections.</li>
  </ul>
</section>

<section aria-labelledby="links">
  <h2 id="links">Links without leaks</h2>
  <p>
    Join and admin secrets are generated in the participant's browser and placed in the URL
    fragment (the part after <code>#</code>). Browsers never send the fragment to servers, so
    secrets do not appear in request lines, proxy logs, access logs or <code>Referer</code> headers.
    The secret is sent once, inside the encrypted WebSocket connection, and the server compares
    its SHA-256 hash in constant time. A wrong secret looks exactly like a room that does not
    exist. A database dump therefore contains nothing that grants access to a room.
  </p>
</section>

<section aria-labelledby="votes">
  <h2 id="votes">Vote secrecy</h2>
  <p>
    All room logic runs in one pure, deterministic function shared by both backends. Before the
    reveal, the view sent to each participant contains only whether others have voted, never
    their values. This rule is enforced in a single projection step and verified with
    property-based tests over thousands of random sessions. Optional anonymous reveal shows the
    distribution without names.
  </p>
</section>

<section aria-labelledby="lifetime">
  <h2 id="lifetime">Data minimization and deletion</h2>
  <ul>
    <li>Rooms live 1 to 8 hours (default 2) and close after 30 minutes without activity.</li>
    <li>On expiry or close, all room storage is deleted.</li>
    <li>No IP addresses are stored or logged by the application; request data is not logged.</li>
    <li>Exports are generated in the browser and never uploaded.</li>
  </ul>
</section>

<section aria-labelledby="web">
  <h2 id="web">Browser hardening</h2>
  <ul>
    <li>
      Strict Content Security Policy: <code>default-src 'none'</code>, scripts and styles only
      from the same origin, no inline code, <code>frame-ancestors 'none'</code>.
    </li>
    <li>
      <code>Referrer-Policy: no-referrer</code>, HSTS, <code>X-Content-Type-Options: nosniff</code>,
      cross-origin isolation headers and a restrictive Permissions-Policy.
    </li>
    <li>Fonts and assets are self-hosted; the app loads nothing from other domains.</li>
    <li>
      Task links are limited to http(s), optionally to an allowlist of your own hosts, or disabled
      entirely in favor of plain task IDs. Backlogfit never fetches them.
    </li>
  </ul>
</section>

<section aria-labelledby="server">
  <h2 id="server">Server hardening</h2>
  <ul>
    <li>Strict schema validation of every message, with size and length limits.</li>
    <li>Rate limits per connection and per room; caps on rooms, participants and tasks.</li>
    <li>WebSocket origin checks against an allowlist.</li>
    <li>
      The container runs as a non-root user on a read-only file system, with no native add-ons
      and no external database.
    </li>
  </ul>
</section>

<section aria-labelledby="supply-chain">
  <h2 id="supply-chain">Supply chain</h2>
  <ul>
    <li>Few dependencies, pinned to exact versions, each one justified in the repository.</li>
    <li>CodeQL, OSV-Scanner, secret scanning, dependency audits and OpenSSF Scorecard in CI.</li>
    <li>
      Release images are scanned with Trivy (builds fail on high or critical findings), signed
      with Sigstore cosign, and published with CycloneDX SBOMs and build provenance attestations.
    </li>
  </ul>
</section>

<section aria-labelledby="review">
  <h2 id="review">For your review</h2>
  <ul>
    <li><a href={`${REPO_URL}/blob/main/docs/security/THREAT_MODEL.md`} rel="noopener noreferrer">Threat model (STRIDE)</a></li>
    <li><a href={`${REPO_URL}/blob/main/docs/security/PRIVACY.md`} rel="noopener noreferrer">Privacy and data flow</a></li>
    <li><a href={`${REPO_URL}/blob/main/docs/security/SELF_HOSTING.md`} rel="noopener noreferrer">Self-hosting and hardening guide</a></li>
    <li><a href={`${REPO_URL}/blob/main/SECURITY.md`} rel="noopener noreferrer">Vulnerability reporting policy</a></li>
    <li><a href="/privacy">Privacy summary</a> and <a href="/self-hosting">self-hosting overview</a></li>
  </ul>
</section>
