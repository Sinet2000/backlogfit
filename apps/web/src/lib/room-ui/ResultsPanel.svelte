<script lang="ts">
  import { toCsv, toJson, toMarkdown, toSummary, votersLabel } from '@backlogfit/core';
  import MenuButton, { type MenuItem } from '../components/MenuButton.svelte';
  import PanelHeader from '../components/PanelHeader.svelte';
  import { downloadText, stamp } from '../download.ts';
  import { formatStat } from '../room/format.ts';
  import { toasts } from '../toast.svelte.ts';
  import { useRoom, viewOf } from './context.ts';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const AGREEMENT = { full: 'Agreed', near: 'Close', split: 'Votes differed' } as const;

  const rows = $derived(
    view.tasks.map((t) => {
      const revealed = t.rounds.filter((r) => r.revealed);
      const last = revealed[revealed.length - 1];
      return {
        id: t.id,
        key: t.key ?? '',
        title: t.title ?? '',
        final: t.final ?? '',
        rounds: revealed.length,
        median: last?.stats ? formatStat(last.stats, 'median') : '',
        agreement: last?.stats?.consensus ? AGREEMENT[last.stats.consensus] : '',
        by: votersLabel(t.voters, room.teams),
      };
    }),
  );

  const name = () => `backlogfit-${stamp()}`;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(toSummary(view));
      toasts.show('Summary copied to the clipboard.', 'success');
    } catch {
      toasts.show('Could not copy. Use one of the downloads instead.', 'error');
    }
  }

  const exports: MenuItem[] = [
    {
      label: 'Download CSV (Excel)',
      icon: 'download',
      testid: 'btn-export-csv',
      onselect: () => downloadText(`${name()}.csv`, toCsv(view), 'text/csv'),
    },
    {
      label: 'Download Markdown',
      icon: 'download',
      testid: 'btn-export-md',
      onselect: () => downloadText(`${name()}.md`, toMarkdown(view), 'text/markdown'),
    },
    {
      label: 'Download JSON',
      icon: 'download',
      testid: 'btn-export-json',
      onselect: () =>
        downloadText(
          `${name()}.json`,
          toJson(view, { generatedAt: new Date().toISOString() }),
          'application/json',
        ),
    },
    {
      label: 'Copy summary',
      icon: 'copy',
      testid: 'btn-copy-summary',
      onselect: () => void copySummary(),
    },
    { label: 'Print', icon: 'print', testid: 'btn-print', onselect: () => window.print() },
  ];
</script>

<section class="results print-keep" aria-labelledby="results-h" data-testid="results">
  <PanelHeader id="results-h" title="Results" count="{rows.filter((r) => r.final).length}/{rows.length}" countLabel="{rows.filter((r) => r.final).length} of {rows.length} estimated">
    {#snippet actions()}
      <span class="no-print">
        <MenuButton label="Export results" text="Export" items={exports} size="sm" testid="btn-export" />
      </span>
    {/snippet}
  </PanelHeader>
  {#if rows.length === 0}
    <p class="muted">Results appear here once tasks are estimated.</p>
  {:else}
    <table>
      <thead>
        <tr><th scope="col">Task</th><th scope="col">Title</th>{#if room.teams.length > 0}<th scope="col">Estimated by</th>{/if}<th scope="col">Final</th><th scope="col">Median</th><th scope="col">Agreement</th><th scope="col">Rounds</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          <tr>
            <td class="mono">{r.key}</td>
            <td>{r.title}</td>
            {#if room.teams.length > 0}<td>{r.by}</td>{/if}
            <td class="strong">{r.final || '–'}</td>
            <td>{r.median || '–'}</td>
            <td>{r.agreement || '–'}</td>
            <td>{r.rounds}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <ul class="stacked" aria-label="Results">
      {#each rows as r (r.id)}
        <li>
          <span class="task"><span class="mono">{r.key}</span> {r.title}</span>
          <span class="facts">
            <strong>Final {r.final || '–'}</strong>{room.teams.length > 0 ? ` · ${r.by}` : ''} · Median {r.median || '–'}{r.agreement ? ` · ${r.agreement}` : ''} · {r.rounds} {r.rounds === 1 ? 'round' : 'rounds'}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="note muted no-print">Exports are made in your browser. Nothing is sent anywhere.</p>
</section>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  th,
  td {
    text-align: left;
    padding: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  th {
    color: var(--color-text-muted);
    font-weight: var(--weight-medium);
  }

  .mono {
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .strong {
    font-weight: var(--weight-bold);
  }

  .stacked {
    display: none;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stacked li {
    display: grid;
    gap: 2px;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .task {
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  .task .mono {
    font-size: var(--text-sm);
  }

  .facts {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .facts strong {
    color: var(--color-text);
  }

  .note {
    margin-top: var(--space-3);
    font-size: var(--text-xs);
  }

  @media (max-width: 640px) {
    table {
      display: none;
    }

    .stacked {
      display: block;
    }
  }

  @media print {
    table {
      display: table;
      font-size: 10pt;
    }

    .stacked {
      display: none;
    }

    th,
    td {
      border-bottom: 1px solid #999;
    }
  }
</style>
