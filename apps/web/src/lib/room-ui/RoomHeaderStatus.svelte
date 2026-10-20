<script lang="ts">
  import { formatEndTime } from '../room/format.ts';
  import type { RoomStore } from '../room/room.svelte.ts';

  let { room }: { room: RoomStore } = $props();

  const view = $derived(room.view);
  const position = $derived.by(() => {
    if (!view || view.tasks.length === 0) return null;
    const i = view.tasks.findIndex((t) => t.id === view.currentTaskId);
    return i < 0 ? null : { n: i + 1, of: view.tasks.length };
  });
</script>

{#if view}
  <span data-testid="room-status">
    {#if position}Task {position.n} of {position.of}{:else if view.tasks.length > 0}{view.tasks.length} {view.tasks.length === 1 ? 'task' : 'tasks'}{:else}No tasks yet{/if}
    <span aria-hidden="true">·</span> Ends at {formatEndTime(view.expiresAt)}
  </span>
{/if}
