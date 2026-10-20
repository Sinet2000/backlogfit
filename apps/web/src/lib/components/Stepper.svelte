<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    steps: readonly string[];
    current: number;
    onselect?: (index: number) => void;
  }
  let { steps, current, onselect }: Props = $props();
</script>

<nav aria-label="Setup steps" class="stepper">
  <ol>
    {#each steps as step, i (step)}
      <li class:done={i < current} class:current={i === current}>
        {#if i < current && onselect}
          <button type="button" onclick={() => onselect?.(i)}>
            <span class="dot"><Icon name="check" size={14} /></span>
            <span class="name">{step}</span>
            <span class="visually-hidden">(completed, go back)</span>
          </button>
        {:else}
          <span class="item" aria-current={i === current ? 'step' : undefined}>
            <span class="dot">{i + 1}</span>
            <span class="name">{step}</span>
          </span>
        {/if}
      </li>
    {/each}
  </ol>
  <p class="mobile-label muted">Step {current + 1} of {steps.length}</p>
</nav>

<style>
  ol {
    display: flex;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    flex: 1;
    min-width: 0;
    border-top: 3px solid var(--color-border);
    padding-top: var(--space-2);
  }

  li.done,
  li.current {
    border-top-color: var(--color-accent);
  }

  button,
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    text-align: left;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  button {
    cursor: pointer;
    color: var(--color-text);
  }

  button:hover .name {
    text-decoration: underline;
  }

  .current .item {
    color: var(--color-text);
    font-weight: var(--weight-semibold);
  }

  .dot {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border-strong);
    font-size: var(--text-xs);
  }

  .done .dot,
  .current .dot {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-text);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-label {
    display: none;
    font-size: var(--text-sm);
    margin-top: var(--space-1);
  }

  @media (max-width: 640px) {
    .name {
      display: none;
    }

    .current .name {
      display: inline;
    }

    li {
      flex: 0 0 auto;
    }

    li.current {
      flex: 1;
    }

    .mobile-label {
      display: block;
    }
  }
</style>
