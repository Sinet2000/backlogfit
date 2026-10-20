<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    tone?: 'info' | 'warning' | 'danger';
    icon?: IconName;
    role?: 'status' | 'alert';
    testid?: string;
    children: Snippet;
  }
  let { tone = 'info', icon = 'info', role, testid, children }: Props = $props();
</script>

<div class="banner {tone} no-print" {role} data-testid={testid}>
  <Icon name={icon} size={18} />
  <div class="body">{@render children()}</div>
</div>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .banner :global(.icon) {
    margin-top: 2px;
  }

  .body {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .info {
    background: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
  }

  .warning {
    background: var(--color-warning-soft);
    border-color: var(--color-warning);
  }

  .warning :global(.icon) {
    color: var(--color-warning);
  }

  .danger {
    background: var(--color-danger-soft);
    border-color: var(--color-danger);
  }

  .danger :global(.icon) {
    color: var(--color-danger);
  }

  :global(:root[data-mode='contrast']) .banner {
    border-color: var(--color-border);
  }
</style>
