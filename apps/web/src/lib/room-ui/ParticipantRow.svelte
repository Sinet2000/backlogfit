<script lang="ts">
  import type { ParticipantView } from '@backlogfit/core';
  import Icon from '../components/Icon.svelte';
  import MenuButton, { type MenuItem } from '../components/MenuButton.svelte';
  import TeamBadge from './TeamBadge.svelte';

  interface Props {
    p: ParticipantView;
    me: boolean;
    phase: 'idle' | 'voting' | 'revealed';
    actions: MenuItem[];
    team?: string | null;
    /** False when this person is not among the voters of the current task. */
    estimating?: boolean;
  }
  let { p, me, phase, actions, team = null, estimating = true }: Props = $props();

  const badge = $derived(
    p.authority === 'admin' ? 'Host' : p.authority === 'coadmin' ? 'Co-host' : null,
  );
</script>

<li
  data-testid="participant"
  data-name={p.name}
  data-voted={p.hasVoted ? 'true' : 'false'}
  data-role={p.role}
  data-team={p.team ?? ''}
  class:offline={!p.connected}
>
  <span class="avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
  <span class="who">
    <span class="name">{p.name}</span>
    <span class="tags">
      {#if me}<span class="tag you">You</span>{/if}
      {#if team}<TeamBadge name={team} />{/if}
      {#if badge}<span class="tag host"><Icon name="crown" size={12} />{badge}</span>{/if}
      {#if p.role === 'spectator'}<span class="tag"><Icon name="eye" size={12} />Watching</span>{/if}
      {#if !p.connected}<span class="tag">Offline</span>{/if}
    </span>
  </span>
  <span class="status">
    {#if p.role === 'voter' && phase !== 'idle'}
      {#if !estimating && !p.hasVoted}
        <span class="waiting">Not estimating</span>
      {:else if p.hasVoted}
        <span class="voted"><Icon name="check" size={16} /> Voted</span>
      {:else if phase === 'voting'}
        <span class="waiting">Not voted yet</span>
      {/if}
    {/if}
  </span>
  {#if actions.length > 0}
    <span class="menu">
      <MenuButton label="Actions for {p.name}" items={actions} size="sm" testid="participant-menu" />
    </span>
  {/if}
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 48px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
  }

  li:hover {
    background: var(--color-surface-2);
  }

  li.offline .name,
  li.offline .avatar {
    opacity: 0.6;
  }

  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: var(--weight-semibold);
    font-size: var(--text-sm);
  }

  .who {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-medium);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .tags:empty {
    display: none;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .tag.you {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    color: var(--color-text);
    font-weight: var(--weight-semibold);
  }

  li:hover .tag.you {
    background: var(--color-surface);
  }

  .tag.host {
    color: var(--color-accent);
    font-weight: var(--weight-semibold);
  }

  .status {
    flex: none;
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .voted {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-success);
    font-weight: var(--weight-semibold);
  }

  .waiting {
    color: var(--color-text-muted);
  }

  .menu {
    flex: none;
    opacity: 0;
  }

  li:hover .menu,
  .menu:focus-within,
  .menu:has(:global([aria-expanded='true'])) {
    opacity: 1;
  }

  @media (hover: none) {
    .menu {
      opacity: 1;
    }
  }

  @media print {
    .menu {
      display: none;
    }
  }
</style>
