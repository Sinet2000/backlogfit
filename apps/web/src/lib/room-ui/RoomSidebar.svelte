<script lang="ts">
  import { useRoom } from './context.ts';
  import LobbyPanel from './LobbyPanel.svelte';
  import ParticipantList from './ParticipantList.svelte';
  import SessionPanel from './SessionPanel.svelte';
  import TaskList from './TaskList.svelte';

  let { onsettings }: { onsettings: () => void } = $props();
  const room = useRoom();
</script>

<aside class="side" aria-label="Session details">
  {#if room.canFacilitate}
    <LobbyPanel />
  {/if}
  <div class="panel pad no-print"><ParticipantList /></div>
  <div class="panel pad no-print"><TaskList /></div>
  {#if room.canFacilitate}
    <div class="panel pad no-print"><SessionPanel {onsettings} /></div>
  {/if}
</aside>

<style>
  .side {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    min-width: 0;
  }

  .pad {
    padding: var(--space-4) var(--space-5) var(--space-5);
  }

  @media (max-width: 640px) {
    .pad {
      padding: var(--space-4);
    }
  }
</style>
