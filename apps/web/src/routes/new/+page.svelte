<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '#lib/components/AppShell.svelte';
  import Toasts from '#lib/components/Toasts.svelte';
  import SessionCreated from '#lib/config/ui/SessionCreated.svelte';
  import WizardForm from '#lib/config/ui/WizardForm.svelte';
  import { SessionWizard } from '#lib/config/wizard.svelte.ts';
  import Seo from '#lib/seo/Seo.svelte';

  const wizard = new SessionWizard();
  onMount(() => wizard.load(location.search));
</script>

<Seo title="New session" description="Set up a new estimation session in four short steps." path="/new" noindex />

<AppShell>
  <div class="container page">
    {#if wizard.created}
      <SessionCreated created={wizard.created} onreset={() => wizard.reset()} />
    {:else}
      <WizardForm {wizard} />
    {/if}
  </div>
</AppShell>

<Toasts />

<style>
  .page {
    padding-block: var(--space-8) var(--space-12);
  }

  @media (max-width: 640px) {
    .page {
      padding-block: var(--space-5) var(--space-8);
    }
  }
</style>
