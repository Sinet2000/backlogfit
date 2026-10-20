<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import {
    accessSummary,
    lengthSummary,
    linksSummary,
    revealSummary,
    tasksSummary,
    teamsSummary,
    timerSummary,
  } from '../summary.ts';
  import type { SessionWizard } from '../wizard.svelte.ts';

  let { wizard, onjump }: { wizard: SessionWizard; onjump: (step: number) => void } = $props();

  const SHOWN = 5;
  const d = $derived(wizard.draft);
  const tasks = $derived(wizard.items.filter((i) => i.task !== null));
  const rows = $derived([
    { label: 'Cards', value: d.scale.map((c) => c.value).join('  '), step: 0 },
    { label: 'Teams', value: teamsSummary(d), step: 1 },
    { label: 'Task links', value: linksSummary(d), step: 1 },
    { label: 'Length', value: lengthSummary(d), step: 2 },
    { label: 'Reveal', value: revealSummary(d), step: 2 },
    { label: 'Joining', value: accessSummary(d), step: 2 },
    { label: 'Timer', value: timerSummary(d), step: 2 },
  ]);
</script>

<div class="group">
  <dl class="summary">
    <div>
      <dt>{rows[0]?.label}</dt>
      <dd>{rows[0]?.value}</dd>
      <dd class="change"><Button variant="link" onclick={() => onjump(0)} aria-label="Change the cards">Change</Button></dd>
    </div>
    <div>
      <dt>Tasks</dt>
      <dd data-testid="summary-tasks">
        {tasksSummary(wizard.validLines.length, wizard.invalidCount)}
        {#if tasks.length > 0}
          <ol class="tasks">
            {#each tasks.slice(0, SHOWN) as t (t.line)}
              <li>
                {#if t.task?.key}<span class="key">{t.task.key}</span>{/if}
                {t.task?.title ?? ''}
              </li>
            {/each}
          </ol>
          {#if tasks.length > SHOWN}<p class="muted more">and {tasks.length - SHOWN} more</p>{/if}
        {/if}
      </dd>
      <dd class="change"><Button variant="link" onclick={() => onjump(1)} aria-label="Change the tasks">Change</Button></dd>
    </div>
    {#each rows.slice(1) as r (r.label)}
      <div>
        <dt>{r.label}</dt>
        <dd>{r.value}</dd>
        <dd class="change"><Button variant="link" onclick={() => onjump(r.step)} aria-label="Change {r.label.toLowerCase()}">Change</Button></dd>
      </div>
    {/each}
  </dl>

  <p class="muted small"><Icon name="shield" size={16} /> Secret links are created in your browser. The server only receives a fingerprint of them, never the links themselves.</p>

  <div>
    <Button variant="secondary" size="sm" icon="download" onclick={() => wizard.exportPreset()} data-testid="preset-export">
      Save these settings for next time (.json)
    </Button>
  </div>

  {#if wizard.createError}
    <StatusBanner tone="danger" icon="alert" role="alert">
      <p>{wizard.createError}</p>
      {#if wizard.offerDemo}
        <div><Button size="sm" onclick={() => wizard.create(true)} data-testid="create-demo">Try an offline demo instead</Button></div>
      {/if}
    </StatusBanner>
  {/if}
</div>

<style>
  .group {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
  }

  .summary {
    display: grid;
    margin: 0;
  }

  .summary > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .summary > div:first-child {
    padding-top: 0;
  }

  dt {
    grid-column: 1;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  dd {
    grid-column: 1;
    margin: 0;
    overflow-wrap: anywhere;
  }

  dd.change {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
  }

  @media (min-width: 640px) {
    .summary > div {
      grid-template-columns: 9rem minmax(0, 1fr) auto;
    }

    dt,
    dd {
      grid-column: auto;
    }

    dd.change {
      grid-column: 3;
      grid-row: auto;
      align-self: start;
    }
  }

  .tasks {
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
    font-size: var(--text-sm);
  }

  .key {
    margin-right: var(--space-1);
    font-family: var(--font-mono);
    font-weight: var(--weight-semibold);
  }

  .more {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
  }

  .small {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .small :global(.icon) {
    margin-top: 2px;
  }
</style>
