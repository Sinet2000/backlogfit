<script lang="ts">
  import Button from '../../components/Button.svelte';
  import type { SessionWizard } from '../wizard.svelte.ts';
  import PreparedTaskList from './PreparedTaskList.svelte';
  import TaskLinkSettings from './TaskLinkSettings.svelte';
  import TeamEditor from './TeamEditor.svelte';

  let { wizard }: { wizard: SessionWizard } = $props();

  const idSettingsChanged = $derived(
    wizard.draft.idPattern.trim() !== '' ||
      wizard.draft.linkTemplate.trim() !== '' ||
      wizard.draft.taskPolicy !== 'ids',
  );
  const invalid = $derived(wizard.items.flatMap((item, i) => (item.error ? [i] : [])));
  const firstTag = $derived(wizard.draft.teams[0]?.name.toLowerCase().replace(/\s+/g, '') ?? 'qa');
  const linkTrouble = $derived(
    wizard.items.some((i) => i.error === 'links_disabled' || i.error === 'url_not_allowed'),
  );
</script>

<div class="group">
  <section class="teams-section" aria-labelledby="teams-h">
    <h2 id="teams-h" class="section-label">Teams <span class="optional">(optional)</span></h2>
    <p class="muted small">Estimating with several teams, like developers and testers? Add them here. Each team gets its own join link, and you can choose which team estimates each task.</p>
    <TeamEditor
      teams={wizard.draft.teams}
      onadd={(name) => wizard.addTeam(name)}
      onrename={(id, name) => wizard.renameTeam(id, name)}
      onremove={(id) => wizard.removeTeam(id)}
      hint="Up to 6 teams. Skip this if everyone estimates everything."
    />
    {#if wizard.showErrors && wizard.errors.teams}<p class="form-error">{wizard.errors.teams}</p>{/if}
  </section>

  <p class="muted">
    Paste the tasks you want to estimate, in the order you want to go through them. This is
    optional: you can also add tasks in the room.
  </p>
  <div class="field">
    <label class="field-label" for="prepared-input">Tasks to estimate <span class="muted">(optional)</span></label>
    <textarea
      id="prepared-input"
      class="textarea"
      rows="5"
      bind:value={wizard.tasksText}
      placeholder={'SCP-3655 Fix login timeout\nSCP-3656 Export to PDF'}
      aria-describedby="prepared-hint"
      spellcheck="false"
      data-testid="prepared-input"
    ></textarea>
    <p class="field-hint" id="prepared-hint">
      One task per line: an ID like SCP-3655, optionally followed by a title. Paste straight from a spreadsheet or your tracker.{#if wizard.draft.teams.length > 0}{' '}End a line with #{firstTag} to let only that team estimate it.{/if}
    </p>
  </div>

  {#if wizard.items.length > 0}
    <section class="list" aria-labelledby="prepared-h">
      <div class="list-head">
        <h2 id="prepared-h" class="section-label">Your list · {wizard.validLines.length} {wizard.validLines.length === 1 ? 'task' : 'tasks'}</h2>
        <Button size="sm" variant="ghost" onclick={() => wizard.clearLines()} data-testid="prepared-clear">Clear list</Button>
      </div>
      {#if invalid.length > 0}
        <div class="attention" role="status">
          <span>
            <strong>{invalid.length === 1 ? '1 line needs' : `${invalid.length} lines need`} attention.</strong>
            {invalid.length === 1 ? 'It is' : 'They are'} skipped unless you fix {invalid.length === 1 ? 'it' : 'them'}{linkTrouble ? ' or change the link settings below' : ''}.
          </span>
          <Button size="sm" variant="secondary" onclick={() => wizard.removeLines(invalid)} data-testid="prepared-remove-invalid">
            Remove {invalid.length === 1 ? 'this line' : 'these lines'}
          </Button>
        </div>
      {/if}
      <PreparedTaskList {wizard} />
    </section>
  {/if}

  <details class="disclosure advanced" open={idSettingsChanged}>
    <summary>Task IDs and links</summary>
    <TaskLinkSettings {wizard} />
  </details>
</div>

<style>
  .group {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
  }

  .teams-section {
    display: grid;
    gap: var(--space-2);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .optional {
    font-weight: var(--weight-medium);
    text-transform: none;
    letter-spacing: 0;
  }

  .small {
    font-size: var(--text-sm);
  }

  .list {
    display: grid;
    gap: var(--space-2);
  }

  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .attention {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    font-size: var(--text-sm);
  }

  .advanced {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }
</style>
