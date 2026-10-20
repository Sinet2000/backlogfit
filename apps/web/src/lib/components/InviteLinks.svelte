<script lang="ts">
  import type { Team } from '@backlogfit/core';
  import { type RoomLink, teamUrl } from '../room/link.ts';
  import CopyField from './CopyField.svelte';
  import QR from './QR.svelte';

  interface Props {
    link: RoomLink;
    teams: readonly Team[];
    query?: string;
    layout?: 'stacked' | 'side';
    qrSize?: number;
    inputTestId?: string;
    buttonTestId?: string;
  }
  let {
    link,
    teams,
    query = '',
    layout = 'stacked',
    qrSize = 168,
    inputTestId = 'join-link',
    buttonTestId = 'copy-join-link',
  }: Props = $props();

  const uid = $props.id();
  let selected = $state<string | null>(null);
  const tabs = $derived([{ id: null, name: 'Everyone' }, ...teams]);
  const current = $derived(teams.find((t) => t.id === selected) ?? null);
  const url = $derived(teamUrl(location.origin, link, current?.id ?? null, query));
  let tabEls: HTMLButtonElement[] = $state([]);

  $effect(() => {
    if (selected !== null && !teams.some((t) => t.id === selected)) selected = null;
  });

  function onkey(e: KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    selected = tabs[next]?.id ?? null;
    tabEls[next]?.focus();
  }
</script>

<div class="invite-links {layout}">
  {#if teams.length > 0}
    <div class="tabs" role="tablist" aria-label="Join link for">
      {#each tabs as t, i (t.id ?? '')}
        <button
          bind:this={tabEls[i]}
          type="button"
          role="tab"
          id="{uid}-tab-{i}"
          aria-selected={selected === t.id}
          aria-controls="{uid}-panel"
          tabindex={selected === t.id ? 0 : -1}
          class="tab"
          onclick={() => (selected = t.id)}
          onkeydown={(e) => onkey(e, i)}
          data-testid="invite-tab"
          data-team={t.id ?? ''}
        >
          {t.name}
        </button>
      {/each}
    </div>
  {/if}
  <div
    class="panel-body"
    id="{uid}-panel"
    role={teams.length > 0 ? 'tabpanel' : undefined}
    aria-labelledby={teams.length > 0 ? `${uid}-tab-${tabs.findIndex((t) => t.id === selected)}` : undefined}
  >
    <div class="field-wrap">
      <CopyField
        label={current ? `Join link for ${current.name}` : teams.length > 0 ? 'Join link for everyone' : 'Join link for your team'}
        value={url}
        {inputTestId}
        {buttonTestId}
        hint={current
          ? `Opens with ${current.name} already picked. People can still choose another team, so it is not a password.`
          : 'Anyone with this link can join. Share it only with your team.'}
      />
    </div>
    <div class="qr">
      <QR value={url} label="QR code of the {current ? `${current.name} ` : ''}join link" size={qrSize} />
      <p class="muted small">Scan to join from a phone</p>
    </div>
  </div>
</div>

<style>
  .invite-links {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    width: fit-content;
    max-width: 100%;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .tab {
    min-height: var(--control-sm);
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: calc(var(--radius-md) - 2px);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    cursor: pointer;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab[aria-selected='true'] {
    border-color: var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    box-shadow: var(--shadow-sm, 0 1px 2px var(--color-shadow));
  }

  :global(:root[data-mode='contrast']) .tab[aria-selected='true'] {
    border-color: var(--color-text);
  }

  .panel-body {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
  }

  .side .panel-body {
    align-items: start;
  }

  @media (min-width: 640px) {
    .side .panel-body {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-6);
    }
  }

  .field-wrap {
    min-width: 0;
  }

  .qr {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: var(--space-2);
  }

  .small {
    font-size: var(--text-sm);
  }

  @media (pointer: coarse) {
    .tab {
      min-height: var(--target-min);
    }
  }
</style>
