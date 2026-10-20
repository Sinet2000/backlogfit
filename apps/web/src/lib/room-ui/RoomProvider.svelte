<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { RoomStore } from '../room/room.svelte.ts';
  import { provideRoom } from './context.ts';

  let { room, children }: { room: RoomStore; children: Snippet } = $props();
  provideRoom(() => room);
</script>

{@render children()}
