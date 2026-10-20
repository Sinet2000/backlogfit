<script lang="ts">
  import '#lib/styles/app.css';
  import type { Snippet } from 'svelte';
  import SiteFooter from '#lib/components/SiteFooter.svelte';
  import SiteHeader from '#lib/components/SiteHeader.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<SiteHeader />
<main id="main" tabindex="-1">
  {@render children()}
</main>
<SiteFooter />

<style>
  main {
    display: block;
    min-height: 60vh;
  }

  main:focus {
    outline: none;
  }
</style>
