<script lang="ts">
import type { RoomView } from '@backlogfit/core';
import { onMount } from 'svelte';
import Button from '../components/Button.svelte';
import Dialog from '../components/Dialog.svelte';
import { formatRemaining } from '../room/format.ts';
import type { RoomStore } from '../room/room.svelte.ts';

let {
  room,
  view,
  onsettings,
  oninvite,
}: { room: RoomStore; view: RoomView; onsettings: () => void; oninvite: () => void } = $props();

let now = $state(0);
let confirmClose = $state(false);
onMount(() => {
  now = room.serverNow();
  const id = setInterval(() => (now = room.serverNow()), 15_000);
  return () => clearInterval(id);
});

const canExtend = $derived(room.isAdmin && view.expiresAt < view.maxExpiresAt);
</script>

<section class="session" aria-labelledby="session-h">
  <h2 id="session-h">Session</h2>
  <p class="muted small">
    Ends in {formatRemaining(view.expiresAt - (now || view.createdAt))}.
    {#if view.settings.locked}<strong class="locked">Locked: nobody new can join.</strong>{/if}
  </p>
  <div class="buttons">
    <Button size="sm" icon="users" onclick={oninvite} data-testid="btn-invite">Invite</Button>
    <Button
      size="sm"
      icon={view.settings.locked ? 'unlock' : 'lock'}
      onclick={() => room.send({ type: 'admin.lock', locked: !view.settings.locked })}
      aria-pressed={view.settings.locked}
      data-testid="btn-lock"
    >
      {view.settings.locked ? 'Unlock' : 'Lock'}
    </Button>
    {#if room.isAdmin}
      <Button size="sm" icon="clock" onclick={() => room.send({ type: 'admin.extend', hours: 1 })} disabled={!canExtend} data-testid="btn-extend">
        Add 1 hour
      </Button>
      <Button size="sm" icon="settings" onclick={onsettings} data-testid="btn-settings">Settings</Button>
      <Button size="sm" variant="danger" icon="door" onclick={() => (confirmClose = true)} data-testid="btn-close-room">
        End session
      </Button>
    {/if}
  </div>
  {#if view.settings.passcodeLocked}
    <p class="warn small" role="status">Too many wrong passcodes. Unlock the session to let people try again.</p>
  {/if}
</section>

<Dialog bind:open={confirmClose} title="End the session for everyone?" size="sm">
  <p>Everyone is disconnected and all session data is deleted right away. Download the results first if you need them.</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmClose = false)}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        confirmClose = false;
        room.send({ type: 'admin.close' });
      }}
      data-testid="btn-close-confirm"
    >
      End session
    </Button>
  {/snippet}
</Dialog>

<style>
  h2 {
    font-size: var(--text-md);
    margin-bottom: var(--space-1);
  }

  .small {
    font-size: var(--text-sm);
  }

  .locked {
    color: var(--color-warning);
  }

  .warn {
    margin-top: var(--space-2);
    color: var(--color-warning);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
