<script lang="ts" module>
  import type { IconName } from './Icon.svelte';

  export interface MenuItem {
    label: string;
    onselect: () => void;
    icon?: IconName;
    danger?: boolean;
    disabled?: boolean;
    testid?: string;
    shortcut?: string;
    /** Items with the same group follow each other under a small heading. */
    group?: string;
    /** Makes the item a radio choice within its group. */
    checked?: boolean;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    label: string;
    items: readonly MenuItem[];
    icon?: IconName;
    text?: string;
    size?: 'sm' | 'md';
    align?: 'start' | 'end';
    placement?: 'below' | 'above';
    testid?: string;
  }
  let {
    label,
    items,
    icon = 'more',
    text,
    size = 'md',
    align = 'end',
    placement = 'below',
    testid,
  }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();
  const uid = $props.id();

  const entries = () => [
    ...(menu?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([disabled])') ?? []),
  ];
  const startsGroup = (i: number) => {
    const item = items[i];
    return item?.group !== undefined && items[i - 1]?.group !== item.group;
  };

  async function show(focus: 'first' | 'last' = 'first') {
    open = true;
    await tick();
    const list = entries();
    (focus === 'first' ? list[0] : list.at(-1))?.focus();
  }

  function hide(returnFocus = true) {
    open = false;
    if (returnFocus) trigger?.focus();
  }

  function choose(item: MenuItem) {
    hide();
    item.onselect();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      void show(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function onMenuKey(e: KeyboardEvent) {
    const list = entries();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % list.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
      return;
    } else if (e.key === 'Tab') {
      hide(false);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    list[next]?.focus();
  }

  $effect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) hide(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  });
</script>

<div class="menu-button" bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger {size}"
    class:with-text={!!text}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="{uid}-menu"
    aria-label={text ? undefined : label}
    title={text ? undefined : label}
    data-testid={testid}
    onclick={() => (open ? hide() : void show())}
    onkeydown={onTriggerKey}
  >
    {#if text}<span>{text}</span><Icon name="down" size={16} />{:else}<Icon name={icon} size={size === 'sm' ? 18 : 20} />{/if}
  </button>
  {#if open}
    <div
      bind:this={menu}
      id="{uid}-menu"
      class="menu {align} {placement}"
      role="menu"
      aria-label={label}
      tabindex="-1"
      onkeydown={onMenuKey}
    >
      {#each items as item, i (`${item.group ?? ''}:${item.label}`)}
        {#if startsGroup(i)}
          {#if i > 0}<div class="sep" role="separator"></div>{/if}
          <div class="group-label" aria-hidden="true">{item.group}</div>
        {:else if i > 0 && item.group === undefined && items[i - 1]?.group !== undefined}
          <div class="sep" role="separator"></div>
        {/if}
        <button
          type="button"
          role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={item.checked === undefined ? undefined : item.checked}
          aria-label={item.group ? `${item.group}: ${item.label}` : undefined}
          class="item"
          class:danger={item.danger}
          disabled={item.disabled}
          data-testid={item.testid}
          data-checked={item.checked === undefined ? undefined : String(item.checked)}
          onclick={() => choose(item)}
        >
          {#if item.checked !== undefined}
            <span class="radio" aria-hidden="true">{#if item.checked}<Icon name="check" size={16} />{/if}</span>
          {:else if item.icon}<Icon name={item.icon} size={18} />{/if}
          <span class="label">{item.label}</span>
          {#if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu-button {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: var(--control-md);
    height: var(--control-md);
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }

  .trigger.sm {
    width: var(--control-sm);
    height: var(--control-sm);
    border-color: transparent;
    background: transparent;
  }

  .trigger.with-text {
    width: auto;
    padding: 0 var(--space-3) 0 var(--space-4);
    font-weight: var(--weight-semibold);
  }

  .trigger.sm.with-text {
    border-color: var(--color-border-strong);
    background: var(--color-surface);
    font-size: var(--text-sm);
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    background: var(--color-surface-2);
  }

  .menu {
    position: absolute;
    z-index: 45;
    min-width: 13rem;
    max-height: min(70vh, 30rem);
    overflow-y: auto;
    padding: var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
  }

  .menu.below {
    top: calc(100% + var(--space-1));
  }

  .menu.above {
    bottom: calc(100% + var(--space-1));
  }

  .menu.end {
    right: 0;
  }

  .menu.start {
    left: 0;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--control-md);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text);
    font-size: var(--text-sm);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .item:hover:not(:disabled),
  .item:focus-visible {
    background: var(--color-surface-2);
  }

  .item:focus-visible {
    outline-offset: -2px;
  }

  .item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .item.danger {
    color: var(--color-danger);
  }

  .label {
    flex: 1;
  }

  .sep {
    height: 1px;
    margin: var(--space-1) calc(-1 * var(--space-1));
    background: var(--color-border);
  }

  .group-label {
    padding: var(--space-2) var(--space-3) var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .radio {
    display: inline-grid;
    place-items: center;
    width: 18px;
    color: var(--color-accent);
  }

  .item[aria-checked='true'] {
    font-weight: var(--weight-semibold);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  :global(:root[data-mode='contrast']) .menu {
    border-color: var(--color-border-strong);
  }

  @media (pointer: coarse) {
    .item {
      min-height: var(--target-min);
    }

    .trigger.sm {
      width: var(--target-min);
      height: var(--target-min);
    }
  }
</style>
