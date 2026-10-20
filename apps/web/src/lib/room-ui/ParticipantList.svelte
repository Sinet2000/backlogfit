<script lang="ts">
  import type { ParticipantView } from '@backlogfit/core';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import type { MenuItem } from '../components/MenuButton.svelte';
  import PanelHeader from '../components/PanelHeader.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { useRoom, viewOf } from './context.ts';
  import ParticipantRow from './ParticipantRow.svelte';

  const room = useRoom();
  const view = $derived(viewOf(room));
  const meId = $derived(view.me?.participantId ?? null);

  const sorted = $derived(
    [...view.participants].sort((a, b) => {
      const rank = (p: ParticipantView) => (p.role === 'spectator' ? 1 : 0);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    }),
  );
  const groups = $derived.by(() => {
    if (room.teams.length === 0) return [{ id: null, name: null, people: sorted }];
    const known = new Set(room.teams.map((t) => t.id));
    return [
      ...room.teams.map((t) => ({
        id: t.id,
        name: t.name,
        people: sorted.filter((p) => p.team === t.id),
      })),
      {
        id: null,
        name: 'No team',
        people: sorted.filter((p) => p.team === null || !known.has(p.team)),
      },
    ].filter((g) => g.people.length > 0);
  });
  const voters = $derived(room.eligible);
  const voted = $derived(voters.filter((p) => p.hasVoted).length);
  const eligibleIds = $derived(new Set(voters.map((p) => p.id)));

  let removing = $state<ParticipantView | null>(null);
  let confirmOpen = $state(false);

  function actionsFor(p: ParticipantView): MenuItem[] {
    const items: MenuItem[] = [];
    if (room.can('manage', p)) {
      items.push(
        p.role === 'voter'
          ? {
              label: 'Make spectator',
              icon: 'eye',
              onselect: () => room.updateParticipant(p.id, { role: 'spectator' }),
              testid: 'btn-make-spectator',
            }
          : {
              label: 'Make voter',
              icon: 'check',
              onselect: () => room.updateParticipant(p.id, { role: 'voter' }),
              testid: 'btn-make-voter',
            },
      );
      if (room.teams.length > 0) {
        const choices = [...room.teams, { id: null, name: 'No team' }];
        for (const t of choices) {
          items.push({
            label: t.name,
            group: 'Team',
            checked: (p.team ?? null) === t.id,
            onselect: () => room.updateParticipant(p.id, { team: t.id }),
            testid: `btn-team-${t.id ?? 'none'}`,
          });
        }
      }
    }
    if (room.can('promote', p)) {
      items.push({
        label: 'Make co-host',
        icon: 'crown',
        onselect: () => room.promote(p.id),
        testid: 'btn-promote',
      });
    }
    if (room.can('demote', p)) {
      items.push({
        label: 'Remove co-host',
        icon: 'crown',
        onselect: () => room.demote(p.id),
        testid: 'btn-demote',
      });
    }
    if (room.can('kick', p)) {
      items.push({
        label: 'Remove from session…',
        icon: 'door',
        danger: true,
        testid: 'btn-kick',
        onselect: () => {
          removing = p;
          confirmOpen = true;
        },
      });
    }
    return items;
  }

  function kick() {
    if (removing) room.kick(removing.id);
    confirmOpen = false;
    removing = null;
  }
</script>

<section class="participants" aria-labelledby="people-h">
  <PanelHeader id="people-h" title="People" count={view.participants.length} countLabel="{view.participants.length} in the session">
    {#snippet actions()}
      {#if view.phase === 'voting'}
        <p class="progress" aria-live="polite" data-testid="vote-progress">{voted} of {voters.length} voted</p>
      {/if}
    {/snippet}
  </PanelHeader>
  {#if view.phase === 'voting' && voters.length > 0}
    <div class="bar"><ProgressBar value={voted} max={voters.length} /></div>
  {/if}
  {#if room.teams.length === 0}
    <ul class="people">
      {#each sorted as p (p.id)}
        <ParticipantRow {p} me={p.id === meId} phase={view.phase} actions={actionsFor(p)} />
      {/each}
    </ul>
  {:else}
    <ul class="groups">
      {#each groups as g (g.id ?? '')}
        <li class="group" data-testid="people-group" data-team={g.id ?? ''}>
          <h3 class="group-name">{g.name} <span class="muted">· {g.people.length}</span></h3>
          <ul class="people">
            {#each g.people as p (p.id)}
              <ParticipantRow
                {p}
                me={p.id === meId}
                phase={view.phase}
                team={room.teamName(p.team)}
                estimating={eligibleIds.has(p.id)}
                actions={actionsFor(p)}
              />
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<Dialog bind:open={confirmOpen} title="Remove {removing?.name ?? 'this person'}?" size="sm" onclose={() => (removing = null)}>
  <p>They are disconnected right away and their vote in this round is dropped. They can join again with the link unless you lock the session.</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancel</Button>
    <Button variant="danger" onclick={kick} data-testid="btn-kick-confirm">Remove</Button>
  {/snippet}
</Dialog>

<style>
  .progress {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .bar {
    margin-bottom: var(--space-3);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  .groups {
    gap: var(--space-3);
  }

  .group-name {
    padding: 0 var(--space-2);
    margin-bottom: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .group-name .muted {
    font-weight: var(--weight-medium);
  }

  @media print {
    .bar {
      display: none;
    }
  }
</style>
