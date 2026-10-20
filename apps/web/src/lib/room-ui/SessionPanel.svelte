<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../components/Button.svelte';
  import Icon from '../components/Icon.svelte';
  import PanelHeader from '../components/PanelHeader.svelte';
  import { formatEndTime, formatRemaining } from '../room/format.ts';
  import { useRoom, viewOf } from './context.ts';

  let { onsettings }: { onsettings: () => void } = $props();

  const room = useRoom();
  const view = $derived(viewOf(room));
  let now = $state(0);

  onMount(() => {
    now = room.serverNow();
    const id = setInterval(() => (now = room.serverNow()), 15_000);
    return () => clearInterval(id);
  });

  const canExtend = $derived(room.can('extend') && view.expiresAt < view.maxExpiresAt);
</script>

<section aria-labelledby="session-h">
  <PanelHeader id="session-h" title="Session" />
  <p class="ends">
    <Icon name="clock" size={16} />
    <span>
      Ends at <strong>{formatEndTime(view.expiresAt)}</strong>
      <span class="muted">(in {formatRemaining(view.expiresAt - (now || view.createdAt))})</span>
    </span>
    {#if room.can('extend')}
      <Button size="sm" variant="link" onclick={() => room.extend(1)} disabled={!canExtend} data-testid="btn-extend">+1 hour</Button>
    {/if}
  </p>
  {#if view.settings.locked}
    <p class="locked"><Icon name="lock" size={16} /> Locked: nobody new can join.</p>
  {/if}
  {#if view.settings.passcodeLocked}
    <p class="warn" role="status">Too many wrong passcodes. Unlock the session in the settings to let people try again.</p>
  {/if}
  <Button icon="settings" onclick={onsettings} data-testid="btn-settings">Session settings…</Button>
</section>

<style>
  section {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }

  section > :global(.panel-header) {
    margin-bottom: 0;
  }

  .ends,
  .locked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .locked {
    color: var(--color-warning);
    font-weight: var(--weight-semibold);
  }

  .warn {
    font-size: var(--text-sm);
    color: var(--color-warning);
  }
</style>
