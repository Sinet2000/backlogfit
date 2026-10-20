<script lang="ts">
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import SessionRuleFields from '../config/ui/SessionRuleFields.svelte';
  import { useRoom, viewOf } from './context.ts';

  let { open = $bindable() }: { open: boolean } = $props();

  const room = useRoom();
  const view = $derived(viewOf(room));
  const s = $derived(view.settings);
  const isHost = $derived(room.can('settings'));
  let confirmClose = $state(false);

  function endSession() {
    confirmClose = false;
    open = false;
    room.close();
  }
</script>

<Dialog bind:open title="Session settings">
  <div class="body">
    <section aria-labelledby="set-access">
      <h3 id="set-access">Access</h3>
      <label class="check">
        <input
          type="checkbox"
          checked={s.locked}
          onchange={(e) => room.setLocked(e.currentTarget.checked)}
          data-testid="btn-lock"
        />
        <span class="check-text">
          <span>Lock the session</span>
          <span class="field-hint">Nobody new can join, even with the link. People already here stay. Unlocking also lets people try a passcode again.</span>
        </span>
      </label>
      {#if s.passcodeLocked}
        <p class="warn" role="status">Too many wrong passcodes. Unlock the session to let people try again.</p>
      {/if}
      <SessionRuleFields
        value={s}
        fields={['allowSpectators', 'lobby']}
        mode="live"
        disabled={!isHost}
        onchange={(patch) => room.updateSettings(patch)}
      />
    </section>

    <section aria-labelledby="set-voting">
      <h3 id="set-voting">Voting</h3>
      <SessionRuleFields
        value={s}
        fields={['autoReveal', 'anonymousAfterReveal', 'timerSeconds']}
        mode="live"
        disabled={!isHost}
        onchange={(patch) => room.updateSettings(patch)}
      />
      {#if !isHost}
        <p class="field-hint">Only the host can change these.</p>
      {/if}
    </section>

    {#if room.can('close')}
      <section class="danger-zone">
        <Button variant="ghost" destructive icon="door" onclick={() => (confirmClose = true)} data-testid="btn-close-room">
          End session for everyone…
        </Button>
      </section>
    {/if}
  </div>
</Dialog>

<Dialog bind:open={confirmClose} title="End the session for everyone?" size="sm">
  <p>Everyone is disconnected and all session data is deleted right away. Download the results first if you need them.</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmClose = false)}>Cancel</Button>
    <Button variant="danger" onclick={endSession} data-testid="btn-close-confirm">End session</Button>
  {/snippet}
</Dialog>

<style>
  .body {
    display: grid;
    gap: var(--space-5);
  }

  section {
    display: grid;
    gap: var(--space-1);
  }

  section + section {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  h3 {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .warn {
    font-size: var(--text-sm);
    color: var(--color-warning);
  }

  .danger-zone {
    justify-items: start;
  }
</style>
