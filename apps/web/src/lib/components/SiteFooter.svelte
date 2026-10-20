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
    <nav aria-label="Footer">
      <ul>
        <li><a href="/guide">Manager guide</a></li>
        <li><a href={REPO_URL} rel="noopener noreferrer">Source code on GitHub</a></li>
        <li><a href={`${REPO_URL}/blob/main/docs/security/PRIVACY.md`} rel="noopener noreferrer">Privacy</a></li>
        <li><a href={`${REPO_URL}/blob/main/SECURITY.md`} rel="noopener noreferrer">Security</a></li>
        <li><a href={`${REPO_URL}/blob/main/docs/security/SELF_HOSTING.md`} rel="noopener noreferrer">Self-hosting</a></li>
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
