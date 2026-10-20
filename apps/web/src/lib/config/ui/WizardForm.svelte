<script lang="ts">
  import { tick } from 'svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import type { SessionWizard } from '../wizard.svelte.ts';
  import { LAST_STEP, STEPS } from '../wizard.ts';
  import DeckPreview from './DeckPreview.svelte';
  import StepReview from './StepReview.svelte';
  import StepRules from './StepRules.svelte';
  import StepScale from './StepScale.svelte';
  import StepTasks from './StepTasks.svelte';

  let { wizard }: { wizard: SessionWizard } = $props();
  let heading: HTMLHeadingElement | undefined = $state();
  let form: HTMLFormElement | undefined = $state();

  function go(to: number) {
    if (wizard.go(to)) {
      void tick().then(() => heading?.focus());
      return;
    }
    void tick().then(() =>
      form?.querySelector<HTMLElement>('[aria-invalid="true"], .step-errors')?.focus(),
    );
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (wizard.step < LAST_STEP) go(wizard.step + 1);
    else void wizard.create();
  }
</script>

<header class="head">
  <p class="eyebrow">New session</p>
  <h1 bind:this={heading} tabindex="-1">{wizard.title}</h1>
</header>

<Stepper steps={STEPS} current={wizard.step} onselect={go} />

<div class="layout">
  <form bind:this={form} class="main panel" onsubmit={submit} novalidate>
    {#if wizard.step === 0}
      <StepScale {wizard} />
    {:else if wizard.step === 1}
      <StepTasks {wizard} />
    {:else if wizard.step === 2}
      <StepRules {wizard} />
    {:else}
      <StepReview {wizard} onjump={go} />
    {/if}

    {#if wizard.showErrors && wizard.stepErrors.length > 0}
      <div class="step-errors" tabindex="-1">
        <StatusBanner tone="danger" icon="alert" role="alert">
          <p>Please fix this before you continue:</p>
          <ul>{#each wizard.stepErrors as e (e)}<li>{e}</li>{/each}</ul>
        </StatusBanner>
      </div>
    {/if}

    <div class="nav">
      {#if wizard.step > 0}
        <Button variant="ghost" icon="left" onclick={() => go(wizard.step - 1)} data-testid="wizard-back">Back</Button>
      {/if}
      <span class="spacer"></span>
      {#if wizard.step < LAST_STEP}
        <Button type="submit" variant="primary" iconAfter="right" data-testid="wizard-next">Continue</Button>
      {:else}
        <Button type="submit" variant="primary" size="lg" icon="play" disabled={wizard.creating} data-testid="wizard-create">
          {wizard.creating ? 'Creating…' : 'Create session'}
        </Button>
      {/if}
    </div>
  </form>

  <DeckPreview deck={wizard.draft.scale} error={wizard.errors.scale ?? null} />
</div>

<style>
  .head {
    margin-bottom: var(--space-6);
  }

  h1 {
    font-size: var(--text-3xl);
    margin-top: var(--space-1);
  }

  h1:focus {
    outline: none;
  }

  .layout {
    display: grid;
    gap: var(--space-6);
    margin-top: var(--space-6);
    align-items: start;
  }

  @media (min-width: 960px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 300px;
    }
  }

  .main {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6);
    min-width: 0;
  }

  .step-errors:focus {
    outline: none;
  }

  .step-errors ul {
    margin: 0;
    padding-left: var(--space-5);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .spacer {
    flex: 1;
  }

  @media (max-width: 640px) {
    .main {
      padding: var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
