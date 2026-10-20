<script lang="ts">
  import StatusBanner from '../components/StatusBanner.svelte';
  import { useRoom, viewOf } from './context.ts';
  import ResultsPanel from './ResultsPanel.svelte';
  import RoomSidebar from './RoomSidebar.svelte';
  import RoomStage from './RoomStage.svelte';

  let { announcement, onsettings }: { announcement: string; onsettings: () => void } = $props();

  const room = useRoom();
  const view = $derived(viewOf(room));
  const showResults = $derived(
    view.tasks.length > 0 && (room.canFacilitate || view.tasks.some((t) => t.final !== null)),
  );
</script>

<div class="banners">
  {#if room.snap.status === 'reconnecting'}
    <StatusBanner tone="warning" icon="refresh" role="status" testid="reconnecting">
      Connection lost. Reconnecting… Your place is kept, and a vote you pick now is sent when the connection is back.
    </StatusBanner>
  {/if}
  {#if room.demo}
    <StatusBanner>Offline demo with simulated teammates. Nothing leaves this tab.</StatusBanner>
  {/if}
</div>

<h1 class="visually-hidden">Estimation session{room.currentTask?.key ? `: ${room.currentTask.key}` : ''}</h1>
<p class="visually-hidden" aria-live="polite">{announcement}</p>

<div class="layout">
  <div class="stage"><RoomStage /></div>
  <div class="side"><RoomSidebar {onsettings} /></div>
  {#if showResults}
    <div class="results panel"><ResultsPanel /></div>
  {/if}
</div>

<style>
  .banners {
    display: grid;
    gap: var(--space-2);
  }

  .banners:not(:empty) {
    margin-bottom: var(--space-4);
  }

  .layout {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'stage' 'side' 'results';
    align-items: start;
  }

  .stage {
    grid-area: stage;
    min-width: 0;
  }

  .side {
    grid-area: side;
    min-width: 0;
  }

  .results {
    grid-area: results;
    min-width: 0;
    padding: var(--space-4) var(--space-5) var(--space-5);
  }

  @media (min-width: 960px) {
    .layout {
      gap: var(--space-6);
      grid-template-columns: minmax(0, 1fr) 360px;
      grid-template-rows: auto 1fr;
      grid-template-areas: 'stage side' 'results side';
    }
  }

  @media (min-width: 1280px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 400px;
    }
  }

  @media print {
    .layout {
      display: block;
    }

    .stage,
    .side {
      display: none;
    }

    .results {
      border: 0;
      padding: 0;
    }
  }
</style>
