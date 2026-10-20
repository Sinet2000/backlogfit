<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconName } from './Icon.svelte';

  type Common = {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
    size?: 'sm' | 'md' | 'lg';
    icon?: IconName;
    iconAfter?: IconName;
    block?: boolean;
    destructive?: boolean;
    children?: Snippet;
  };
  type Props = Common &
    ((HTMLButtonAttributes & { href?: undefined }) | (HTMLAnchorAttributes & { href: string }));

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    iconAfter,
    block = false,
    destructive = false,
    children,
    class: klass = '',
    ...rest
  }: Props = $props();

  const cls = $derived(
    `btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${destructive ? 'destructive' : ''} ${klass ?? ''}`,
  );
  const iconSize = $derived(size === 'lg' ? 20 : size === 'sm' ? 16 : 18);
</script>

{#if rest.href !== undefined}
  <a class={cls} {...rest as HTMLAnchorAttributes}>
    {#if icon}<Icon name={icon} size={iconSize} />{/if}
    {@render children?.()}
    {#if iconAfter}<Icon name={iconAfter} size={iconSize} />{/if}
  </a>
{:else}
  <button class={cls} type="button" {...rest as HTMLButtonAttributes}>
    {#if icon}<Icon name={icon} size={iconSize} />{/if}
    {@render children?.()}
    {#if iconAfter}<Icon name={iconAfter} size={iconSize} />{/if}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--control-md);
    padding: 0 var(--space-4);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-weight: var(--weight-semibold);
    font-size: var(--text-sm);
    line-height: 1.2;
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      color var(--duration-fast) var(--ease-out);
  }

  .btn:disabled,
  .btn[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .btn-sm {
    min-height: var(--control-sm);
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
  }

  .btn-lg {
    min-height: var(--control-lg);
    padding: 0 var(--space-6);
    font-size: var(--text-md);
  }

  .btn-block {
    width: 100%;
  }

  .btn-primary {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
    color: var(--color-accent-text);
  }

  .btn-secondary {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  .btn-ghost {
    background: transparent;
    color: var(--color-text);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  .btn-danger {
    background: var(--color-danger);
    color: var(--color-surface);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--color-danger);
    color: var(--color-surface);
    filter: brightness(0.92);
  }

  .btn.destructive {
    color: var(--color-danger);
  }

  .btn.destructive:hover:not(:disabled) {
    background: var(--color-danger-soft);
    color: var(--color-danger);
  }

  .btn-link {
    min-height: auto;
    padding: var(--space-1) 0;
    background: transparent;
    color: var(--color-accent);
    font-weight: var(--weight-medium);
  }

  .btn-link:hover:not(:disabled) {
    color: var(--color-accent-hover);
    text-decoration: underline;
  }

  @media (pointer: coarse) {
    .btn:not(.btn-link) {
      min-height: var(--target-min);
    }
  }

  @media (forced-colors: active) {
    .btn {
      border-color: ButtonText;
    }
  }
</style>
