<script lang="ts">
  import type { Team } from '@backlogfit/core';
  import Button from '../../components/Button.svelte';
  import CopyField from '../../components/CopyField.svelte';
  import Icon from '../../components/Icon.svelte';
  import InviteLinks from '../../components/InviteLinks.svelte';
  import { downloadText } from '../../download.ts';
  import { type RoomLink, roomUrls, teamUrl } from '../../room/link.ts';
  import { toasts } from '../../toast.svelte.ts';

  interface Props {
    created: { link: RoomLink; demo: boolean; prepared: string[]; teams: Team[] };
    onreset: () => void;
  }
  let { created, onreset }: Props = $props();

  let heading: HTMLHeadingElement | undefined = $state();
  $effect(() => heading?.focus());

  const urls = $derived(roomUrls(location.origin, created.link, created.demo ? 'demo' : ''));
  const count = $derived(created.prepared.length);

  function saveHostLink() {
    if (!urls.admin) return;
    const query = created.demo ? 'demo' : '';
    const teamLinks = created.teams
      .map(
        (t) =>
          `\nJoin link for ${t.name}:\n${teamUrl(location.origin, created.link, t.id, query)}\n`,
      )
      .join('');
    const text = `Backlogfit host link. Keep it private: it gives full control of the session.\n\n${urls.admin}\n\nJoin link for the team:\n${urls.join}\n${teamLinks}`;
    downloadText('backlogfit-host-link.txt', text, 'text/plain');
  }

  async function copyTasks() {
    try {
      await navigator.clipboard.writeText(created.prepared.join('\n'));
      toasts.show('Task list copied. Paste it into the room if it does not appear.', 'success');
    } catch {
      toasts.show('Could not copy the task list.', 'error');
    }
  }
</script>

<section class="done" aria-labelledby="done-h">
  <span class="ok-icon" aria-hidden="true"><Icon name="check" size={28} /></span>
  <h1 id="done-h" bind:this={heading} tabindex="-1">Your session is ready</h1>
  <p class="muted">
    {created.teams.length > 0
      ? 'Share a join link with each team. Keep the host link for yourself.'
      : 'Share the join link with your team. Keep the host link for yourself.'}
  </p>
  {#if created.demo}
    <p class="note">Offline demo: this session lives only in this browser tab, with simulated teammates.</p>
  {/if}

  <div class="share panel">
    <InviteLinks link={created.link} teams={created.teams} query={created.demo ? 'demo' : ''} layout="side" />
    <div class="share-main">
      {#if urls.admin}
        <div class="admin-box">
          <CopyField label="Host link (only for you)" value={urls.admin} inputTestId="admin-link" buttonTestId="copy-admin-link" tone="warning" />
          <p class="warn">
            <Icon name="alert" size={18} />
            <span><strong>Keep this link private.</strong> It gives full control of the session and cannot be shown again. Save it if you want to switch devices.</span>
          </p>
          <div><Button size="sm" icon="download" onclick={saveHostLink} data-testid="save-admin-link">Save host link as a file</Button></div>
        </div>
      {/if}
    </div>
  </div>

  {#if count > 0}
    <div class="prepared" data-testid="prepared-note">
      <Icon name="info" size={18} />
      <div>
        <p><strong>{count} prepared {count === 1 ? 'task is' : 'tasks are'} added when you open the room in this tab.</strong></p>
        <p class="muted small">The list is kept only in this browser tab. If you open the room somewhere else, paste it there.</p>
      </div>
      <Button size="sm" variant="ghost" icon="copy" onclick={copyTasks} data-testid="copy-prepared">Copy task list</Button>
    </div>
  {/if}

  <div class="done-actions">
    <Button href={urls.admin ?? urls.join} variant="primary" size="lg" iconAfter="right" data-testid="open-room">Open the room</Button>
    <Button variant="ghost" onclick={onreset}>Set up another session</Button>
  </div>
</section>

<style>
  .done {
    max-width: 880px;
    margin-inline: auto;
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  h1 {
    font-size: var(--text-3xl);
  }

  h1:focus {
    outline: none;
  }

  .ok-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-full);
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .note {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    font-size: var(--text-sm);
  }

  .share {
    width: 100%;
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .share-main {
    display: grid;
    gap: var(--space-6);
    min-width: 0;
  }

  .admin-box {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
  }

  .warn {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .warn :global(.icon) {
    color: var(--color-warning);
    margin-top: 2px;
  }

  .prepared {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .prepared > div {
    flex: 1 1 18rem;
  }

  .prepared :global(.icon) {
    color: var(--color-accent);
    margin-top: 2px;
  }

  .small {
    font-size: var(--text-sm);
  }

  .done-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  @media (max-width: 640px) {
    .share {
      padding: var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
