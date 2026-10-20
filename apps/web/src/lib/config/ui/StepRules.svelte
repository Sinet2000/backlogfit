<script lang="ts">
  import { LIFETIMES } from '../draft.ts';
  import { hoursLabel, type RuleValues } from '../rules.ts';
  import { accessSummary } from '../summary.ts';
  import type { SessionWizard } from '../wizard.svelte.ts';
  import SessionRuleFields from './SessionRuleFields.svelte';

  let { wizard }: { wizard: SessionWizard } = $props();

  const d = $derived(wizard.draft);
  const e = $derived(wizard.errors);
  const moreOpen = $derived(wizard.showErrors && (!!e.maxParticipants || !!e.passcode));
  const set = (patch: Partial<RuleValues>) => (wizard.draft = { ...wizard.draft, ...patch });
</script>

<div class="group">
  <div class="field">
    <label class="field-label" for="expiry">Session length</label>
    <select id="expiry" class="select field-narrow" bind:value={wizard.draft.lifetimeHours} aria-describedby="expiry-hint" data-testid="setting-expiry">
      {#each LIFETIMES as h (h)}
        <option value={h}>{hoursLabel(h)}{h === 2 ? ' (recommended)' : ''}</option>
      {/each}
    </select>
    <p class="field-hint" id="expiry-hint">Everything is deleted when the time is up. You can add an hour during the session.</p>
  </div>

  <div class="checks">
    <SessionRuleFields value={d} fields={['autoReveal', 'anonymousAfterReveal']} mode="create" onchange={set} />
  </div>

  <details class="disclosure more" open={moreOpen} data-testid="rules-more">
    <summary>More options <span class="summary-note">{accessSummary(d)}</span></summary>
    <div class="more-body">
      <section aria-labelledby="sec-join">
        <h2 class="section-label" id="sec-join">Who can join</h2>
        <SessionRuleFields value={d} fields={['lobby', 'allowSpectators']} mode="create" onchange={set} />
        <div class="field">
          <label class="field-label" for="passcode">Passcode <span class="muted">(optional)</span></label>
          <input id="passcode" class="input field-narrow" type="text" bind:value={wizard.draft.passcode} maxlength="64" autocomplete="off" spellcheck="false" aria-describedby="pass-hint" aria-invalid={wizard.showErrors && e.passcode ? 'true' : undefined} data-testid="setting-passcode" />
          <p class="field-hint" id="pass-hint">An extra word people type to join. Tell it out loud; it is never saved in settings files.</p>
          {#if wizard.showErrors && e.passcode}<p class="form-error">{e.passcode}</p>{/if}
        </div>
        <div class="field">
          <label class="field-label" for="maxp">Maximum people</label>
          <input id="maxp" class="input field-narrow" type="number" min="2" max="500" inputmode="numeric" bind:value={wizard.draft.maxParticipants} aria-describedby="maxp-hint" aria-invalid={wizard.showErrors && e.maxParticipants ? 'true' : undefined} data-testid="setting-max-participants" />
          <p class="field-hint" id="maxp-hint">Including you. Between 2 and 500.</p>
          {#if wizard.showErrors && e.maxParticipants}<p class="form-error">{e.maxParticipants}</p>{/if}
        </div>
      </section>

      <section aria-labelledby="sec-time">
        <h2 class="section-label" id="sec-time">Timer</h2>
        <SessionRuleFields value={d} fields={['timerSeconds']} mode="create" onchange={set} />
      </section>

      <fieldset>
        <legend class="section-label">Color style for everyone</legend>
        <div class="inline">
          {#each ['corporate', 'colorful'] as const as t (t)}
            <label class="check">
              <input type="radio" name="theme" value={t} checked={d.theme === t} onchange={() => (wizard.draft.theme = t)} data-testid="setting-theme-{t}" />
              <span class="check-text">
                <span>{t === 'corporate' ? 'Corporate' : 'Colorful'}</span>
                <span class="field-hint">{t === 'corporate' ? 'Calm blue and grey.' : 'Brighter cards. People can still switch.'}</span>
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
    </div>
  </details>
</div>

<style>
  .group {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
  }

  .checks {
    display: grid;
  }

  .more {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .more-body {
    display: grid;
    gap: var(--space-6);
    padding-top: var(--space-4);
  }

  section,
  fieldset {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-2);
  }

  .inline {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-8);
  }

  @media (max-width: 640px) {
    .more summary {
      flex-wrap: wrap;
    }

    .more :global(.summary-note) {
      width: 100%;
      margin-left: calc(0.85em + var(--space-2));
    }
  }
</style>
