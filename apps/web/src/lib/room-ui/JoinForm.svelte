<script lang="ts">
  import type { ErrorCode } from '@backlogfit/core';
  import { onMount } from 'svelte';
  import Button from '../components/Button.svelte';
  import { errorText } from '../room/messages.ts';
  import { rememberedName, rememberName } from '../room/storage.ts';

  interface Props {
    isHost: boolean;
    busy: boolean;
    error: ErrorCode | null;
    demo: boolean;
    onjoin: (req: { name: string; role: 'voter' | 'spectator'; passcode?: string }) => void;
  }
  let { isHost, busy, error, demo, onjoin }: Props = $props();

  let name = $state('');
  let passcode = $state('');
  let spectator = $state(false);
  let nameInput: HTMLInputElement | undefined = $state();
  let passInput: HTMLInputElement | undefined = $state();
  let touched = $state(false);

  onMount(() => {
    name = rememberedName();
    nameInput?.focus();
  });

  $effect(() => {
    if (error === 'bad_passcode' || error === 'passcode_locked') passInput?.focus();
  });

  const nameError = $derived(
    touched && name.trim() === '' ? 'Enter your name so others know who voted.' : '',
  );

  function submit(e: SubmitEvent) {
    e.preventDefault();
    touched = true;
    const n = name.trim().slice(0, 40);
    if (n === '') {
      nameInput?.focus();
      return;
    }
    rememberName(n);
    onjoin({ name: n, role: spectator ? 'spectator' : 'voter', ...(passcode ? { passcode } : {}) });
  }
</script>

<div class="join panel">
  <p class="eyebrow">{isHost ? 'You are the host' : 'You are invited'}</p>
  <h1>Join the estimation session</h1>
  <p class="muted lead">
    {#if isHost}
      You opened the host link. You can vote too, or only run the session.
    {:else}
      Pick a name your team will recognise. No account needed.
    {/if}
  </p>

  <form onsubmit={submit} novalidate>
    <div class="field">
      <label class="field-label" for="join-name">Your name</label>
      <input
        bind:this={nameInput}
        id="join-name"
        class="input"
        bind:value={name}
        maxlength="40"
        autocomplete="nickname"
        required
        aria-invalid={nameError ? 'true' : undefined}
        aria-describedby={nameError ? 'join-name-err' : undefined}
        data-testid="join-name"
      />
      {#if nameError}<p class="error" id="join-name-err">{nameError}</p>{/if}
    </div>

    <div class="field">
      <label class="field-label" for="join-passcode">Passcode <span class="muted">(only if the host gave you one)</span></label>
      <input
        bind:this={passInput}
        id="join-passcode"
        class="input"
        type="password"
        bind:value={passcode}
        maxlength="64"
        autocomplete="off"
        aria-invalid={error === 'bad_passcode' ? 'true' : undefined}
        aria-describedby={error ? 'join-err' : undefined}
        data-testid="join-passcode"
      />
    </div>

    <label class="check">
      <input type="checkbox" bind:checked={spectator} data-testid="join-as-spectator" />
      <span class="check-text">
        <span>{isHost ? 'I will only facilitate (no voting)' : 'Join as a spectator'}</span>
        <span class="field-hint">{isHost ? 'You can still reveal, move on and set final estimates.' : 'Watch without voting, if the host allows it.'}</span>
      </span>
    </label>

    {#if error}
      <p class="error banner" id="join-err" role="alert">{errorText(error)}</p>
    {/if}

    <Button type="submit" variant="primary" size="lg" block disabled={busy} data-testid="join-submit">
      {busy ? 'Joining…' : 'Join session'}
    </Button>
  </form>

  {#if demo}
    <p class="demo-note muted">Offline demo: this session runs only in this browser tab, with simulated teammates.</p>
  {/if}
</div>

<style>
  .join {
    max-width: 480px;
    margin: var(--space-12) auto;
    padding: var(--space-8) var(--space-6);
  }

  h1 {
    font-size: var(--text-2xl);
    margin-top: var(--space-2);
  }

  .lead {
    margin-top: var(--space-2);
  }

  form {
    display: grid;
    gap: var(--space-5);
    margin-top: var(--space-6);
  }

  .error {
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .banner {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    color: var(--color-text);
    border: 1px solid var(--color-danger);
  }

  .demo-note {
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }

  @media (max-width: 480px) {
    .join {
      margin: var(--space-4) auto;
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
