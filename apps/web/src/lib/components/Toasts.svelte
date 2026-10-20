<script lang="ts">
  import { toasts } from '../toast.svelte.ts';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
</script>

<div class="toasts no-print" role="status" aria-live="polite" aria-atomic="false">
  {#each toasts.items as t (t.id)}
    <div class="toast {t.kind}" data-testid="toast">
      <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} />
      <span class="text">{t.text}</span>
      <IconButton icon="x" size="sm" label="Dismiss" onclick={() => toasts.dismiss(t.id)} />
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    z-index: 50;
    right: var(--space-4);
    bottom: var(--space-4);
    left: var(--space-4);
    display: grid;
    justify-items: end;
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: 440px;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    background: var(--color-text);
    color: var(--color-bg);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    animation: toast-in var(--duration-normal) var(--ease-out);
  }

  .toast :global(.icon-btn) {
    color: inherit;
  }

  .toast :global(.icon-btn:hover) {
    background: transparent;
    opacity: 0.8;
  }

  .toast.error {
    background: var(--color-danger);
    color: var(--color-surface);
  }

  .text {
    flex: 1;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
