<script lang="ts">
import { type RoomView, toCsv, toJson, toMarkdown, toSummary } from '@backlogfit/core';
import Button from '../components/Button.svelte';
import { downloadText, stamp } from '../download.ts';
import { formatStat } from '../room/format.ts';
import { toasts } from '../toast.svelte.ts';

let { view }: { view: RoomView } = $props();

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
      consensus: last?.stats?.consensus ?? '',
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
</script>

<section class="results print-keep" aria-labelledby="results-h">
  <div class="head">
    <h2 id="results-h">Results</h2>
    <p class="muted small no-print">Downloads are made in your browser. Nothing is sent anywhere.</p>
  </div>
  {#if rows.length === 0}
    <p class="muted">Results appear here once tasks are estimated.</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th scope="col">Task</th><th scope="col">Title</th><th scope="col">Final</th><th scope="col">Median</th><th scope="col">Agreement</th><th scope="col">Rounds</th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.id)}
            <tr>
              <td class="mono">{r.key}</td>
              <td>{r.title}</td>
              <td class="strong">{r.final || '–'}</td>
              <td>{r.median || '–'}</td>
              <td>{r.consensus || '–'}</td>
              <td>{r.rounds}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <div class="exports no-print">
    <Button size="sm" icon="download" onclick={() => downloadText(`${name()}.csv`, toCsv(view), 'text/csv')} data-testid="btn-export-csv">CSV</Button>
    <Button size="sm" icon="download" onclick={() => downloadText(`${name()}.json`, toJson(view, { generatedAt: new Date().toISOString() }), 'application/json')} data-testid="btn-export-json">JSON</Button>
    <Button size="sm" icon="download" onclick={() => downloadText(`${name()}.md`, toMarkdown(view), 'text/markdown')} data-testid="btn-export-md">Markdown</Button>
    <Button size="sm" icon="copy" onclick={copySummary} data-testid="btn-copy-summary">Copy summary</Button>
    <Button size="sm" variant="ghost" onclick={() => window.print()} data-testid="btn-print">Print</Button>
  </div>
</section>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  h2 {
    font-size: var(--text-md);
  }

  .small {
    font-size: var(--text-xs);
  }

  .table-wrap {
    overflow-x: auto;
  }

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

  .exports {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  @media print {
    table {
      font-size: 10pt;
    }

    th,
    td {
      border-bottom: 1px solid #999;
    }
  }
</style>
