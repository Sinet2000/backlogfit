<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Logo from './Logo.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';

  interface Props {
    children: Snippet;
    status?: Snippet;
    actions?: Snippet;
    onleave?: (() => void) | undefined;
  }
  let { children, status, actions, onleave }: Props = $props();

  let confirmLeave = $state(false);

  function home(e: MouseEvent) {
    if (!onleave) return;
    e.preventDefault();
    confirmLeave = true;
  }

  function leave() {
    confirmLeave = false;
    onleave?.();
    void goto('/');
  }
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="app-header no-print">
  <div class="bar">
    <a class="brand" href="/" onclick={home} aria-label="Backlogfit home" data-testid="app-home">
      <Logo size={26} />
      <span class="name">Backlogfit</span>
    </a>
    {#if status}<div class="status">{@render status()}</div>{/if}
    <div class="actions">
      {#if actions}{@render actions()}{/if}
      <ThemeSwitcher compact />
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
  {@render children()}
</main>
<footer class="app-footer no-print">
  <a href="/privacy">Privacy</a>
  <span aria-hidden="true">·</span>
  <a href="/guide">Help</a>
</footer>

{#if onleave}
  <Dialog bind:open={confirmLeave} title="Leave this session?" size="sm">
    <p>You can come back with the same link while the session is open.</p>
    {#snippet actions()}
      <Button variant="ghost" onclick={() => (confirmLeave = false)}>Stay</Button>
      <Button variant="primary" onclick={leave} data-testid="leave-confirm">Leave session</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    max-width: var(--content-width);
    min-height: var(--header-height);
    margin-inline: auto;
    padding-inline: var(--gutter);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    color: var(--color-text);
    font-weight: var(--weight-bold);
    text-decoration: none;
  }

  .brand:hover {
    color: var(--color-text);
  }

  .status {
    flex: 1;
    min-width: 0;
    padding-left: var(--space-4);
    border-left: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }

  main {
    display: block;
    min-height: calc(100vh - var(--header-height) - 4rem);
  }

  main:focus {
    outline: none;
  }

  .app-footer {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--gutter) var(--space-8);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .app-footer a {
    color: var(--color-text-muted);
  }

  .app-footer a:hover {
    color: var(--color-text);
  }

  @media (max-width: 640px) {
    .name,
    .status {
      display: none;
    }

    .bar {
      gap: var(--space-2);
    }
  }
</style>
