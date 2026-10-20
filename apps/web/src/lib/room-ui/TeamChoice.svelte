<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../components/Button.svelte';
  import Icon from '../components/Icon.svelte';
  import { useRoom } from './context.ts';

  const room = useRoom();
  const known = (id: string | null | undefined) => room.teams.some((t) => t.id === id);
  let choice = $state<string>(
    known(room.me?.team)
      ? (room.me?.team ?? '')
      : known(room.teamHint)
        ? (room.teamHint ?? '')
        : '',
  );
  let heading: HTMLHeadingElement | undefined = $state();
  const options = $derived([
    ...room.teams.map((t) => ({ id: t.id, name: t.name })),
    { id: '', name: 'No team' },
  ]);

  onMount(() => heading?.focus());

  function submit(e: SubmitEvent) {
    e.preventDefault();
    room.chooseTeam(choice === '' ? null : choice);
  }
</script>

<div class="choice panel" data-testid="team-choice">
  <p class="eyebrow">One more step</p>
  <h1 bind:this={heading} tabindex="-1">Which team are you in?</h1>
  <p class="muted lead">
    Some tasks may be estimated by one team only. The host can change your team later.
  </p>
  <form onsubmit={submit}>
    <fieldset>
      <legend class="visually-hidden">Your team</legend>
      <div class="options">
        {#each options as o (o.id)}
          <label class="option" class:on={choice === o.id} data-testid="team-option" data-team={o.id}>
            <input type="radio" name="team" value={o.id} bind:group={choice} />
            <span class="mark" aria-hidden="true">{#if choice === o.id}<Icon name="check" size={16} />{/if}</span>
            <span class="name">{o.name}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <Button type="submit" variant="primary" size="lg" block data-testid="team-continue">Continue</Button>
  </form>
</div>

<style>
  .choice {
    max-width: 480px;
    margin: var(--space-12) auto;
    padding: var(--space-8) var(--space-6);
  }

  h1 {
    font-size: var(--text-2xl);
    margin-top: var(--space-2);
  }

  h1:focus {
    outline: none;
  }

  .lead {
    margin-top: var(--space-2);
  }

  form {
    display: grid;
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-2);
  }

  .option {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--target-min);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;
  }

  .option:hover {
    background: var(--color-surface-2);
  }

  .option.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  .option:has(input:focus-visible) {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .mark {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-accent-text);
  }

  .on .mark {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .name {
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    .choice {
      margin: var(--space-4) auto;
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
