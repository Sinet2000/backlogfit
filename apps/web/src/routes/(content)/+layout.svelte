<script lang="ts">
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<div class="container">
  <article class="prose">
    {@render children()}
  </article>
</div>

<style>
  .prose {
    max-width: var(--prose-width);
    margin-inline: auto;
    padding-block: var(--space-12) var(--space-20);
    font-size: var(--text-lg);
    line-height: 1.7;
  }

  .prose :global(h1) {
    font-size: var(--text-3xl);
    margin-bottom: var(--space-6);
  }

  .prose :global(h2) {
    font-size: var(--text-2xl);
    margin-top: var(--space-12);
    margin-bottom: var(--space-4);
  }

  .prose :global(h3) {
    font-size: var(--text-xl);
    margin-top: var(--space-8);
    margin-bottom: var(--space-3);
  }

  .prose :global(p),
  .prose :global(ul),
  .prose :global(ol),
  .prose :global(table),
  .prose :global(blockquote) {
    margin-block: 0 var(--space-5);
  }

  .prose :global(li + li) {
    margin-top: var(--space-2);
  }

  .prose :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
  }

  .prose :global(blockquote) {
    padding: var(--space-4) var(--space-5);
    border-left: 4px solid var(--color-accent);
    background: var(--color-surface);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }

  .prose :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-md);
  }

  .prose :global(th),
  .prose :global(td) {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  .prose :global(details) {
    border-bottom: 1px solid var(--color-border);
    padding-block: var(--space-3);
  }

  .prose :global(summary) {
    cursor: pointer;
    font-weight: var(--weight-semibold);
    min-height: var(--target-min);
    display: flex;
    align-items: center;
  }
</style>
