<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import Icon, { type IconName } from './Icon.svelte';

type Props = HTMLButtonAttributes & {
  icon: IconName;
  /** Required accessible name (also shown as tooltip). */
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary' | 'danger';
};
let { icon, label, size = 'md', variant = 'ghost', class: klass = '', ...rest }: Props = $props();
</script>

<button
  type="button"
  class="icon-btn {variant} {size} {klass}"
  aria-label={label}
  title={label}
  {...rest}
>
  <Icon name={icon} size={size === 'sm' ? 16 : 20} />
</button>

<style>
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--target-min);
    height: var(--target-min);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    flex: none;
  }

  .icon-btn.sm {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--color-surface-2);
  }

  .icon-btn.secondary {
    border-color: var(--color-border-strong);
    background: var(--color-surface);
  }

  .icon-btn.danger {
    color: var(--color-danger);
  }

  .icon-btn.danger:hover:not(:disabled) {
    background: var(--color-danger-soft);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
