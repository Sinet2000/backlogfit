<script lang="ts">
import Dialog from '../components/Dialog.svelte';
import { SHORTCUT_HELP } from '../room/shortcuts.ts';

let { open = $bindable(), isFacilitator }: { open: boolean; isFacilitator: boolean } = $props();
const rows = $derived(SHORTCUT_HELP.filter((r) => r.who === 'all' || isFacilitator));
</script>

<Dialog bind:open title="Keyboard shortcuts" size="sm">
  <table>
    <tbody>
      {#each rows as r (r.keys)}
        <tr><th scope="row"><kbd>{r.keys}</kbd></th><td>{r.does}</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="muted small">Shortcuts never trigger while you are typing in a field.</p>
</Dialog>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--space-2) 0;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }

  th {
    width: 9rem;
    font-weight: var(--weight-normal);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  .small {
    font-size: var(--text-sm);
    margin-top: var(--space-3);
  }
</style>
