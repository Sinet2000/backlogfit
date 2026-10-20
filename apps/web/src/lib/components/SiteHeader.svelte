<script lang="ts">
  import Logo from './Logo.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<header class="site-header no-print">
  <div class="container bar">
    <a class="brand" href="/" aria-label="Backlogfit home"><Logo /> <span>Backlogfit</span></a>
    <nav aria-label="Main">
      <a href="/guide">Guide</a>
      <a class="cta" href="/new"><span class="long">Start a session</span><span class="short" aria-hidden="true">Start</span></a>
      <ThemeSwitcher />
    </nav>
  </div>
</header>

<style>
  .site-header {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 64px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text);
    font-weight: var(--weight-bold);
    font-size: var(--text-lg);
    text-decoration: none;
    min-height: var(--target-min);
  }

  nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  nav a {
    display: inline-flex;
    align-items: center;
    min-height: var(--target-min);
    padding-inline: var(--space-3);
    color: var(--color-text);
    text-decoration: none;
    border-radius: var(--radius-md);
    font-weight: var(--weight-medium);
  }

  nav a:hover {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  .short {
    display: none;
  }

  @media (max-width: 640px) {
    nav {
      gap: var(--space-1);
    }

    nav a {
      padding-inline: var(--space-2);
    }

    nav a.cta {
      min-height: var(--control-sm);
      padding-inline: var(--space-3);
      font-size: var(--text-sm);
    }

    .long {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .short {
      display: inline;
    }
  }

  nav a.cta {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  nav a.cta:hover {
    background: var(--color-accent-hover);
    color: var(--color-accent-text);
  }
</style>
