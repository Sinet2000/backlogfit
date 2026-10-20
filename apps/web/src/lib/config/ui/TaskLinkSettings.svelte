<script lang="ts">
  import { DEFAULT_ID_PATTERN } from '@backlogfit/core';
  import { exampleLink } from '../draft.ts';
  import { POLICY_HINTS, POLICY_NAMES } from '../summary.ts';
  import type { SessionWizard } from '../wizard.svelte.ts';
  import DomainChips from './DomainChips.svelte';

  let { wizard }: { wizard: SessionWizard } = $props();

  const ID_EXAMPLE = '[A-Z]{2,5}-\\d{1,6}';
  const COUNT_EXAMPLE = '{1,9}';
  const example = $derived(exampleLink(wizard.draft));
  const d = $derived(wizard.draft);
  const e = $derived(wizard.errors);
</script>

<div class="settings">
  <div class="field">
    <label class="field-label" for="id-pattern">Task ID format <span class="muted">(optional)</span></label>
    <input id="id-pattern" class="input mono field-narrow" bind:value={wizard.draft.idPattern} placeholder={DEFAULT_ID_PATTERN} aria-describedby="id-pattern-hint" aria-invalid={e.idPattern && d.idPattern.trim() !== '' ? 'true' : undefined} data-testid="setting-id-pattern" />
    <p class="field-hint" id="id-pattern-hint">Leave empty to recognise IDs like <code>SCP-3655</code> or <code>PAY-12</code>. Custom example: <code>{ID_EXAMPLE}</code>. Allowed: letters, digits, <code>\d</code>, <code>\w</code>, <code>.</code>, classes like <code>[A-Z]</code>, and one count per part such as <code>+</code> or <code>{COUNT_EXAMPLE}</code>. No groups, <code>|</code> or anchors.</p>
    {#if e.idPattern && d.idPattern.trim() !== ''}<p class="form-error">{e.idPattern}</p>{/if}
  </div>

  <div class="field">
    <label class="field-label" for="link-tpl">Link to your tracker <span class="muted">(optional)</span></label>
    <input id="link-tpl" class="input mono" bind:value={wizard.draft.linkTemplate} placeholder="https://yourtracker/browse/{'{id}'}" aria-describedby="link-tpl-hint" aria-invalid={wizard.showErrors && e.linkTemplate ? 'true' : undefined} inputmode="url" data-testid="setting-link-template" />
    <p class="field-hint" id="link-tpl-hint">
      Put <code>{'{id}'}</code> where the task ID goes.
      {#if example}Example: <span class="mono example">{example}</span>{/if}
    </p>
    {#if wizard.showErrors && e.linkTemplate}<p class="form-error">{e.linkTemplate}</p>{/if}
  </div>

  <fieldset class="field">
    <legend class="field-label">Links in task lists</legend>
    {#each ['ids', 'links', 'allowlist'] as const as p (p)}
      <label class="check">
        <input type="radio" name="policy" value={p} checked={d.taskPolicy === p} onchange={() => (wizard.draft.taskPolicy = p)} data-testid="setting-policy-{p}" />
        <span class="check-text"><span>{POLICY_NAMES[p]}</span><span class="field-hint">{POLICY_HINTS[p]}</span></span>
      </label>
    {/each}
  </fieldset>

  {#if d.taskPolicy === 'allowlist'}
    <DomainChips
      hosts={d.allowlist}
      error={wizard.showErrors ? (e.allowlist ?? null) : null}
      onchange={(hosts) => (wizard.draft.allowlist = hosts)}
    />
  {/if}
</div>

<style>
  .settings {
    display: grid;
    gap: var(--space-5);
    padding-top: var(--space-2);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .example {
    overflow-wrap: anywhere;
    color: var(--color-text);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
</style>
