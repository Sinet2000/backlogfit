<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from '#lib/components/AppShell.svelte';
  import Button from '#lib/components/Button.svelte';
  import IconButton from '#lib/components/IconButton.svelte';
  import Toasts from '#lib/components/Toasts.svelte';
  import { RoomSession } from '#lib/room/session.svelte.ts';
  import EndedState from '#lib/room-ui/EndedState.svelte';
  import InviteDialog from '#lib/room-ui/InviteDialog.svelte';
  import RoomGate from '#lib/room-ui/RoomGate.svelte';
  import RoomHeaderStatus from '#lib/room-ui/RoomHeaderStatus.svelte';
  import RoomLayout from '#lib/room-ui/RoomLayout.svelte';
  import RoomProvider from '#lib/room-ui/RoomProvider.svelte';
  import SettingsDialog from '#lib/room-ui/SettingsDialog.svelte';
  import ShortcutHelp from '#lib/room-ui/ShortcutHelp.svelte';
  import TeamChoice from '#lib/room-ui/TeamChoice.svelte';
  import Seo from '#lib/seo/Seo.svelte';

  const session = new RoomSession();
  let helpOpen = $state(false);
  let settingsOpen = $state(false);
  let inviteOpen = $state(false);

  const room = $derived(session.room);
  const live = $derived(
    !!room?.view && (room.snap.status === 'joined' || room.snap.status === 'reconnecting'),
  );

  onMount(() => session.mount());

  function onkeydown(e: KeyboardEvent) {
    const action = session.shortcut(e, helpOpen || settingsOpen || inviteOpen);
    if (action?.type === 'help') helpOpen = true;
  }
</script>

<svelte:window {onkeydown} />

<Seo title="Estimation session" description="A private Backlogfit estimation session." path="/r" noindex />

<AppShell onleave={live ? () => room?.leave() : undefined}>
  {#snippet status()}
    {#if live && room}<RoomHeaderStatus {room} />{/if}
  {/snippet}
  {#snippet actions()}
    {#if live && room}
      {#if room.canFacilitate}
        <Button size="sm" icon="users" onclick={() => (inviteOpen = true)} data-testid="btn-invite">Invite</Button>
      {/if}
      <IconButton icon="keyboard" label="Keyboard shortcuts (?)" onclick={() => (helpOpen = true)} aria-keyshortcuts="?" data-testid="btn-shortcuts" />
      <Button size="sm" variant="ghost" icon="door" onclick={() => room?.leave()} data-testid="btn-leave">Leave</Button>
    {/if}
  {/snippet}

  <div class="room-page container">
    {#if session.boot === 'preparing'}
      <h1 class="visually-hidden">Estimation session</h1>
      <p class="muted center" aria-live="polite">Preparing the session…</p>
    {:else if session.boot === 'invalid'}
      <EndedState reason="invalid_link" joinError={null} />
    {:else if room}
      {#key room}
        <RoomProvider {room}>
          {#if live && room.needsTeam}
            <TeamChoice />
          {:else if live}
            <RoomLayout announcement={session.announcement} onsettings={() => (settingsOpen = true)} />
            <ShortcutHelp bind:open={helpOpen} isHost={room.canFacilitate} />
            <InviteDialog bind:open={inviteOpen} link={room.link} teams={room.teams} query={room.demo ? 'demo' : ''} />
            {#if room.canFacilitate}
              <SettingsDialog bind:open={settingsOpen} />
            {/if}
          {:else}
            <RoomGate />
          {/if}
        </RoomProvider>
      {/key}
    {/if}
  </div>
</AppShell>

<Toasts />

<style>
  .room-page {
    padding-block: var(--space-6) var(--space-8);
  }

  .center {
    text-align: center;
    margin-top: var(--space-16);
  }

  @media (max-width: 640px) {
    .room-page {
      padding-block: var(--space-4);
    }
  }
</style>
