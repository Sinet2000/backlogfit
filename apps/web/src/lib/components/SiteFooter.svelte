<script lang="ts">
  import { REPO_URL, TAGLINE } from '#lib/seo/site.ts';
</script>

<footer class="site-footer no-print">
  <div class="container cols">
    <div>
      <p class="name">Backlogfit</p>
      <p class="muted">{TAGLINE}</p>
      <p class="muted small">Open source under Apache-2.0. No cookies, no tracking.</p>
    </div>
    <nav aria-label="Product">
      <p class="col-h">Learn</p>
      <ul>
        <li><a href="/guide">Manager guide</a></li>
        <li><a href="/how-story-point-estimation-works">How story points work</a></li>
        <li><a href="/planning-poker-alternative">A planning poker alternative</a></li>
        <li><a href="/compare">Compare tools</a></li>
        <li><a href="/guides">Guides</a></li>
        <li><a href="/faq">FAQ</a></li>
      </ul>
    </nav>
    <nav aria-label="Trust">
      <p class="col-h">Trust</p>
      <ul>
        <li><a href="/security">Security</a></li>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/self-hosting">Self-hosting</a></li>
        <li><a href={REPO_URL} rel="noopener noreferrer">Source code on GitHub</a></li>
      </ul>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: var(--space-20);
    padding-block: var(--space-10);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .cols {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-8);
  }

  .name {
    font-weight: var(--weight-bold);
  }

  .small {
    font-size: var(--text-sm);
    margin-top: var(--space-2);
  }

  .col-h {
    font-weight: var(--weight-semibold);
    margin-bottom: var(--space-2);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  ul a {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
  }
</style>
