<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    open: boolean;
    title: string;
    children: Snippet;
    actions?: Snippet;
    onclose?: () => void;
    size?: 'sm' | 'md';
  }
  let { open = $bindable(), title, children, actions, onclose, size = 'md' }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let returnFocus: Element | null = null;
  const uid = $props.id();
  const titleId = `dlg-${uid}`;

  // Native modal <dialog>: the rest of the page becomes inert (focus is trapped), Esc closes it,
  // and focus goes back to the element that opened it.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function handleClose() {
    open = false;
    onclose?.();
    if (returnFocus instanceof HTMLElement) returnFocus.focus();
  }

  function handleClick(e: MouseEvent) {
    if (e.target === dialog) open = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="dialog {size}"
  aria-labelledby={titleId}
  onclose={handleClose}
  onclick={handleClick}
>
  <div class="inner">
    <header>
      <h2 id={titleId}>{title}</h2>
      <IconButton icon="x" label="Close" onclick={() => (open = false)} />
    </header>
    <div class="body">
      {@render children()}
    </div>
    {#if actions}
      <footer>{@render actions()}</footer>
    {/if}
  </div>
</dialog>

<style>
  .dialog {
    width: min(560px, calc(100vw - 2 * var(--space-4)));
    max-height: calc(100vh - 2 * var(--space-8));
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
  }

  .dialog.sm {
    width: min(420px, calc(100vw - 2 * var(--space-4)));
  }

  .dialog::backdrop {
    background: rgba(10, 14, 20, 0.55);
  }

  .inner {
    padding: var(--space-5) var(--space-6) var(--space-6);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  h2 {
    font-size: var(--text-xl);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-6);
  }

  @media print {
    .dialog {
      display: none;
    }
  }
</style>
