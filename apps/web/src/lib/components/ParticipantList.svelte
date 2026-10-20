<script lang="ts">
  import type { ParticipantView } from '@backlogfit/core';
  import Icon from './Icon.svelte';

  interface Props {
    participants: readonly ParticipantView[];
    meId: string | null;
    phase: 'idle' | 'voting' | 'revealed';
    /** Viewer's authority. */
    authority: 'admin' | 'coadmin' | 'none';
    onkick?: (p: ParticipantView) => void;
    onpromote?: (p: ParticipantView) => void;
    ondemote?: (p: ParticipantView) => void;
  }
  let { participants, meId, phase, authority, onkick, onpromote, ondemote }: Props = $props();

  const sorted = $derived(
    [...participants].sort((a, b) => {
      const rank = (p: ParticipantView) => (p.role === 'spectator' ? 1 : 0);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    }),
  );
  const voters = $derived(participants.filter((p) => p.role === 'voter'));
  const voted = $derived(voters.filter((p) => p.hasVoted).length);

  const canKick = (p: ParticipantView) =>
    p.id !== meId &&
    p.authority !== 'admin' &&
    (authority === 'admin' || (authority === 'coadmin' && p.authority === 'none'));
  const canPromote = (p: ParticipantView) => authority === 'admin' && p.id !== meId;

  const badge = (p: ParticipantView) =>
    p.authority === 'admin' ? 'Host' : p.authority === 'coadmin' ? 'Co-host' : null;
</script>

<section class="participants" aria-labelledby="people-h">
  <div class="head">
    <h2 id="people-h">People <span class="count">{participants.length}</span></h2>
    {#if phase === 'voting'}
      <p class="progress" aria-live="polite" data-testid="vote-progress">
        {voted} of {voters.length} voted
      </p>
    {/if}
  </div>
  {#if phase === 'voting' && voters.length > 0}
    <div class="bar" aria-hidden="true">
      <span class="fill" style:--pct="{(voted / voters.length) * 100}%"></span>
    </div>
  {/if}
  <ul>
    {#each sorted as p (p.id)}
      <li
        data-testid="participant"
        data-name={p.name}
        data-voted={p.hasVoted ? 'true' : 'false'}
        data-role={p.role}
        class:offline={!p.connected}
      >
        <span class="avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
        <span class="who">
          <span class="name">
            {p.name}{#if p.id === meId}<span class="you"> (you)</span>{/if}
          </span>
          <span class="tags">
            {#if badge(p)}<span class="tag host"><Icon name="crown" size={12} />{badge(p)}</span>{/if}
            {#if p.role === 'spectator'}<span class="tag"><Icon name="eye" size={12} />Watching</span>{/if}
            {#if !p.connected}<span class="tag">Offline</span>{/if}
          </span>
        </span>
        <span class="status">
          {#if p.role === 'voter' && phase !== 'idle'}
            {#if p.hasVoted}
              <span class="voted"><Icon name="check" size={16} /> Voted</span>
            {:else if phase === 'voting'}
              <span class="waiting">Thinking</span>
            {/if}
          {/if}
        </span>
        {#if canKick(p) || canPromote(p)}
          <span class="actions">
            {#if canPromote(p) && p.authority === 'none'}
              <button
                type="button"
                class="act"
                data-testid="btn-promote"
                onclick={() => onpromote?.(p)}
                aria-label="Make {p.name} a co-host"
                title="Make co-host">Co-host</button
              >
            {:else if canPromote(p) && p.authority === 'coadmin'}
              <button
                type="button"
                class="act"
                data-testid="btn-demote"
                onclick={() => ondemote?.(p)}
                aria-label="Remove co-host rights from {p.name}"
                title="Remove co-host">Uncohost</button
              >
            {/if}
            {#if canKick(p)}
              <button
                type="button"
                class="act danger"
                data-testid="btn-kick"
                onclick={() => onkick?.(p)}
                aria-label="Remove {p.name} from the session"
                title="Remove">Remove</button
              >
            {/if}
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  h2 {
    font-size: var(--text-md);
  }

  .count {
    color: var(--color-text-muted);
    font-weight: var(--weight-normal);
  }

  .progress {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .bar {
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
    margin-bottom: var(--space-3);
  }

  .fill {
    display: block;
    height: 100%;
    width: var(--pct);
    background: var(--color-success);
    transition: width var(--duration-normal) var(--ease-out);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
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

  /* Room for ~20-character names at desktop widths; the actions wrap to a second line. */
  .who {
    display: grid;
    flex: 1 1 11rem;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-medium);
  }

  .you {
    color: var(--color-text-muted);
    font-weight: var(--weight-normal);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .tags:empty {
    display: none;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
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
    gap: 4px;
    color: var(--color-success);
    font-weight: var(--weight-semibold);
  }

  .waiting {
    color: var(--color-text-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-1);
    margin-left: auto;
  }

  .act {
    min-height: 28px;
    min-width: 24px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .act:hover {
    border-color: var(--color-border-strong);
  }

  .act.danger {
    color: var(--color-danger);
  }

  @media print {
    .actions,
    .bar {
      display: none;
    }
  }
</style>
