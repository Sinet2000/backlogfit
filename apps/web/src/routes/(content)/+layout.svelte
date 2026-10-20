<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="container">
  <article class="prose">
    {@render children()}
  </article>
</div>
