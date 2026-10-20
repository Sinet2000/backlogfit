<script lang="ts">
import type { Card, TaskView } from '@backlogfit/core';
import Icon from '../components/Icon.svelte';
import { formatStat } from '../room/format.ts';

interface Props {
  task: TaskView;
  round: number | null;
  phase: 'idle' | 'voting' | 'revealed';
  scale: readonly Card[];
}
let { task, round, phase }: Props = $props();

const safeUrl = $derived.by(() => {
  if (!task.url || !/^https?:\/\//i.test(task.url)) return null;
  try {
    const u = new URL(task.url);
    return u.protocol === 'http:' || u.protocol === 'https:'
      ? { href: u.href, host: u.host }
      : null;
  } catch {
    return null;
  }
});
const earlier = $derived(task.rounds.filter((r) => r.revealed && r.n !== round));
const summary = (votes: { value: string }[] | null) => {
  const counts = new Map<string, number>();
  for (const v of votes ?? []) counts.set(v.value, (counts.get(v.value) ?? 0) + 1);
  return [...counts].map(([v, n]) => `${n}× ${v}`).join(', ') || 'no votes';
};
</script>

<section class="current" data-testid="current-task" data-key={task.key ?? ''} aria-labelledby="task-h">
  <div class="meta">
    <span class="status {phase}">
      {phase === 'voting' ? 'Voting' : phase === 'revealed' ? 'Revealed' : 'Waiting'}
    </span>
    {#if round !== null}<span class="muted">Round {round}</span>{/if}
    {#if task.final !== null}<span class="final"><Icon name="flag" size={14} /> Final: {task.final}</span>{/if}
  </div>
  <h2 id="task-h">
    {#if task.key}<span class="key">{task.key}</span>{/if}
    <span class="title">{task.title ?? (task.key ? '' : 'Untitled task')}</span>
  </h2>
  {#if safeUrl}
    <a class="ext" href={safeUrl.href} target="_blank" rel="noopener noreferrer">
      <Icon name="external" size={16} /> Open in tracker <span class="host">({safeUrl.host})</span>
    </a>
  {/if}
  {#if earlier.length > 0}
    <details class="history">
      <summary>Earlier rounds ({earlier.length})</summary>
      <ol>
        {#each earlier as r (r.n)}
          <li>
            Round {r.n}: {summary(r.votes)}{#if r.stats && r.stats.median !== null}
              · median {formatStat(r.stats, 'median')}{/if}{#if r.stats?.consensus} · {r.stats.consensus}{/if}
          </li>
        {/each}
      </ol>
    </details>
  {/if}
</section>

<style>
  .current {
    display: grid;
    gap: var(--space-2);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .status {
    padding: 2px var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    font-weight: var(--weight-semibold);
  }

  .status.voting {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .status.revealed {
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .final {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: var(--weight-semibold);
  }

  h2 {
    font-size: var(--text-2xl);
    overflow-wrap: anywhere;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.75em;
    margin-right: var(--space-2);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    vertical-align: middle;
  }

  .ext {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    width: fit-content;
    min-height: 32px;
    font-size: var(--text-sm);
  }

  .host {
    color: var(--color-text-muted);
  }

  .history {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .history summary {
    cursor: pointer;
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  .history ol {
    margin: var(--space-1) 0 0;
    padding-left: var(--space-5);
  }
</style>
