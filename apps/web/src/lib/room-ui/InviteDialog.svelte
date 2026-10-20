<script lang="ts">
  import type { Team } from '@backlogfit/core';
  import Dialog from '../components/Dialog.svelte';
  import InviteLinks from '../components/InviteLinks.svelte';
  import type { RoomLink } from '../room/link.ts';

  interface Props {
    link: RoomLink;
    teams: readonly Team[];
    query?: string;
    open: boolean;
  }
  let { link, teams, query = '', open = $bindable() }: Props = $props();
</script>

<Dialog bind:open title="Invite your team">
  {#if teams.length > 0}
    <p class="muted intro">Send each team its own link, so their team is already picked when they join.</p>
  {/if}
  <InviteLinks {link} {teams} {query} qrSize={180} inputTestId="invite-link" buttonTestId="copy-invite-link" />
</Dialog>

<style>
  .intro {
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }
</style>
