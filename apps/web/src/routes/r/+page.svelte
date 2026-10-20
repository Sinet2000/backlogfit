<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import CardDeck from '#lib/components/CardDeck.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ParticipantList from '#lib/components/ParticipantList.svelte';
  import RevealPanel from '#lib/components/RevealPanel.svelte';
  import Timer from '#lib/components/Timer.svelte';
  import Toasts from '#lib/components/Toasts.svelte';
  import { batches, takePrepared } from '#lib/room/agenda.ts';
  import { createDemoRoom, takeDemoTasks } from '#lib/room/demo.ts';
  import { parseFragment, type RoomLink, roomUrls, settleAdminSecret } from '#lib/room/link.ts';
  import { RoomStore } from '#lib/room/room.svelte.ts';
  import { shortcutFor } from '#lib/room/shortcuts.ts';
  import { localStore, sessionStore } from '#lib/room/storage.ts';
  import CurrentTask from '#lib/room-ui/CurrentTask.svelte';
  import EndedState from '#lib/room-ui/EndedState.svelte';
  import FacilitatorControls from '#lib/room-ui/FacilitatorControls.svelte';
  import InviteDialog from '#lib/room-ui/InviteDialog.svelte';
  import JoinForm from '#lib/room-ui/JoinForm.svelte';
  import LobbyPanel from '#lib/room-ui/LobbyPanel.svelte';
  import ResultsPanel from '#lib/room-ui/ResultsPanel.svelte';
  import SessionPanel from '#lib/room-ui/SessionPanel.svelte';
  import SettingsDialog from '#lib/room-ui/SettingsDialog.svelte';
  import ShortcutHelp from '#lib/room-ui/ShortcutHelp.svelte';
  import TaskList from '#lib/room-ui/TaskList.svelte';
  import Seo from '#lib/seo/Seo.svelte';
  import { applyTheme, readTheme } from '#lib/theme.ts';

  let room = $state<RoomStore | null>(null);
  let invalidLink = $state(false);
  let preparing = $state(true);
  let helpOpen = $state(false);
  let settingsOpen = $state(false);
  let inviteOpen = $state(false);

  const view = $derived(room?.view ?? null);
  const status = $derived(room?.snap.status ?? 'idle');
  const joinUrl = $derived(
    room ? roomUrls(location.origin, room.link, room.demo ? 'demo' : '').join : '',
  );
  const anyDialog = $derived(helpOpen || settingsOpen || inviteOpen);

  function start(link: RoomLink, demo: boolean) {
    const store = new RoomStore(link, { demo });
    room = store;
    // Same tab reloaded: rejoin silently with the saved identity and resume token.
    const who = store.session.identity;
    if (who) store.join(who);
  }

  async function init() {
    const demo = new URLSearchParams(location.search).has('demo');
    let link = parseFragment(location.hash);
    if (!link && demo && location.hash === '') {
      link = await createDemoRoom({ sampleTasks: true });
    }
    if (link) {
      // SEC-014: show the join link in the address bar; the admin secret stays in this tab.
      const settled = settleAdminSecret(link, sessionStore());
      link = settled.link;
      if (settled.replace) {
        history.replaceState(
          history.state,
          '',
          `${location.pathname}${location.search}${settled.replace}`,
        );
      }
    }
    preparing = false;
    if (!link) {
      invalidLink = true;
      return;
    }
    start(link, demo);
  }

  function onHashChange() {
    room?.dispose();
    room = null;
    invalidLink = false;
    void init();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!room || !view || status !== 'joined') return;
    const action = shortcutFor(e, {
      canVote: room.canVote && view.phase === 'voting',
      isFacilitator: room.isFacilitator,
      dialogOpen: anyDialog,
    });
    if (!action) return;
    e.preventDefault();
    if (action.type === 'help') helpOpen = true;
    else if (action.type === 'pick') {
      const card = view.config.scale[action.index];
      if (card) room.vote(view.myVote === card.value ? null : card.value);
    } else if (action.type === 'reveal' && view.phase === 'voting')
      room.send({ type: 'admin.reveal' });
    else if (action.type === 'next') room.send({ type: 'admin.next' });
  }

  const onOnline = () => room?.nudge();
  const onVisible = () => document.visibilityState === 'visible' && room?.nudge();

  onMount(() => {
    void init();
    addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
  });

  onDestroy(() => {
    room?.dispose();
    if (typeof window !== 'undefined') {
      removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    }
  });

  // Follow the host's theme hint unless this person chose a style themselves.
  $effect(() => {
    const hint = view?.config.theme;
    if (!hint) return;
    const mine = readTheme();
    if (
      mine.theme === 'corporate' &&
      hint === 'colorful' &&
      localStore().getItem('bf-theme') === null
    ) {
      applyTheme('colorful', mine.mode, false);
    }
  });

  // Fresh offline demo: the host's own connection adds the sample tasks once.
  $effect(() => {
    if (room?.demo && status === 'joined' && room.isFacilitator) {
      const lines = takeDemoTasks(room.link.roomId);
      if (lines) room.send({ type: 'admin.tasks.add', lines });
    }
  });

  // Tasks prepared in the configurator: added once by the host, only into an empty room.
  $effect(() => {
    if (!room || status !== 'joined' || !room.isAdmin || !view) return;
    const lines = takePrepared(sessionStore(), room.link.roomId);
    if (!lines || view.tasks.length > 0) return;
    for (const batch of batches(lines)) room.send({ type: 'admin.tasks.add', lines: batch });
  });

  const announce = $derived.by(() => {
    if (!view) return '';
    if (view.phase === 'revealed') return 'Votes revealed.';
    if (view.phase === 'voting')
      return `Voting on ${room?.currentTask?.key ?? 'a new task'}, round ${view.round}.`;
    return '';
  });
</script>

<svelte:window onkeydown={onKeydown} onhashchange={onHashChange} />

<Seo title="Estimation session" description="A private Backlogfit estimation session." path="/r" noindex />

<div class="room-page container">
  {#if preparing}
    <h1 class="visually-hidden">Estimation session</h1>
    <p class="muted center" aria-live="polite">Preparing the session…</p>
  {:else if invalidLink}
    <EndedState reason="not_found" joinError={null} />
  {:else if room}
    {#if status === 'ended' && room.snap.ended}
      <EndedState reason={room.snap.ended} joinError={room.snap.joinError} demo={room.demo} onretry={() => room?.retry()} />
    {:else if status === 'idle' || (status === 'connecting' && !room.snap.view && room.snap.attempt === 0)}
      <JoinForm
        isHost={room.link.adminSecret !== null}
        busy={status === 'connecting'}
        error={room.snap.joinError}
        demo={room.demo}
        onjoin={(req) => room?.join(req)}
      />
    {:else if status === 'lobby'}
      <section class="lobby-wait panel" data-testid="lobby-waiting" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <h1>Waiting for the host</h1>
        <p class="muted">The host approves each person before they join. This page updates by itself.</p>
      </section>
    {:else if status === 'connecting'}
      <section class="lobby-wait panel" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <h1>Connecting…</h1>
        <p class="muted">Attempt {room.snap.attempt + 1}. Checking that the server is reachable.</p>
      </section>
    {:else if view}
      {#if status === 'reconnecting'}
        <p class="reconnect no-print" role="status">
          <Icon name="refresh" size={16} /> Connection lost. Reconnecting… your vote and place are kept.
        </p>
      {/if}
      {#if room.demo}
        <p class="demo-banner no-print">
          <Icon name="info" size={16} /> Offline demo with simulated teammates. Nothing leaves this tab.
        </p>
      {/if}
      <h1 class="visually-hidden">
        Estimation session{room.currentTask?.key ? `: ${room.currentTask.key}` : ''}
      </h1>
      <p class="visually-hidden" aria-live="polite">{announce}</p>

      <div class="layout">
        <div class="main">
          <div class="stage panel">
            {#if room.currentTask}
              <div class="stage-head">
                <CurrentTask task={room.currentTask} round={view.round} phase={view.phase} scale={view.config.scale} />
                {#if view.timer && view.phase === 'voting'}
                  <Timer endsAt={view.timer.endsAt} seconds={view.timer.seconds} serverNow={room.serverNow} />
                {/if}
              </div>

              {#if view.phase === 'revealed' && room.currentRound}
                {#key `${view.currentTaskId}:${view.round}`}
                  <RevealPanel round={room.currentRound} scale={view.config.scale} />
                {/key}
              {:else if view.phase === 'voting'}
                {#if room.canVote}
                  <div class="vote">
                    <p class="prompt">
                      {view.myVote === null ? 'Pick a card. Others will not see it until the reveal.' : 'Your vote is in. You can change it until the reveal.'}
                    </p>
                    <CardDeck cards={view.config.scale} selected={view.myVote} onpick={(v) => room?.vote(v)} />
                  </div>
                {:else}
                  <p class="prompt muted">You are watching. Votes appear when the host reveals them.</p>
                {/if}
              {/if}
            {:else}
              <div class="empty-stage">
                <h2>{view.tasks.length === 0 ? 'Ready when you are' : 'Waiting for the next task'}</h2>
                <p class="muted">
                  {#if room.isFacilitator}
                    {view.tasks.length === 0 ? 'Add tasks on the right, then start the first one.' : 'Press "Start first task", or press ▶ next to any task in the list.'}
                  {:else}
                    The host will start the next task soon.
                  {/if}
                </p>
              </div>
            {/if}

            {#if room.isFacilitator}
              <FacilitatorControls {room} {view} task={room.currentTask} />
            {/if}
          </div>

          <div class="panel pad">
            <ResultsPanel {view} />
          </div>
        </div>

        <aside class="side" aria-label="Session details">
          {#if room.isFacilitator}
            <LobbyPanel {room} {view} />
          {/if}
          <div class="panel pad no-print">
            <ParticipantList
              participants={view.participants}
              meId={view.me?.participantId ?? null}
              phase={view.phase}
              authority={room.authority}
              onkick={(p) => room?.send({ type: 'admin.kick', participantId: p.id })}
              onpromote={(p) => room?.send({ type: 'admin.promote', participantId: p.id })}
              ondemote={(p) => room?.send({ type: 'admin.demote', participantId: p.id })}
            />
          </div>
          <div class="panel pad no-print">
            <TaskList {room} {view} canManage={room.isFacilitator} />
          </div>
          {#if room.isFacilitator}
            <div class="panel pad no-print">
              <SessionPanel {room} {view} onsettings={() => (settingsOpen = true)} oninvite={() => (inviteOpen = true)} />
            </div>
          {/if}
          <div class="foot no-print">
            <button type="button" class="link-btn" onclick={() => (helpOpen = true)} aria-keyshortcuts="?">
              <Icon name="keyboard" size={16} /> Keyboard shortcuts
            </button>
            <button type="button" class="link-btn" onclick={() => (inviteOpen = true)}>
              <Icon name="users" size={16} /> Invite
            </button>
            <button type="button" class="link-btn" onclick={() => room?.leave()} data-testid="btn-leave">
              <Icon name="door" size={16} /> Leave
            </button>
          </div>
        </aside>
      </div>

      <ShortcutHelp bind:open={helpOpen} isFacilitator={room.isFacilitator} />
      <InviteDialog bind:open={inviteOpen} url={joinUrl} />
      {#if room.isAdmin}
        <SettingsDialog bind:open={settingsOpen} {room} {view} />
      {/if}
    {/if}
  {/if}
</div>

<Toasts />

<style>
  .room-page {
    padding-block: var(--space-6) var(--space-12);
  }

  .center {
    text-align: center;
    margin-top: var(--space-16);
  }

  .layout {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  @media (min-width: 960px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 360px;
    }
  }

  @media (min-width: 1280px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 420px;
    }
  }

  .main,
  .side {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .pad {
    padding: var(--space-5);
  }

  .stage {
    display: grid;
    gap: var(--space-6);
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-6);
  }

  .stage-head > :global(.current) {
    flex: 1 1 16rem;
    min-width: 0;
  }

  .stage-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .vote {
    display: grid;
    gap: var(--space-4);
  }

  .prompt {
    text-align: center;
  }

  .empty-stage {
    text-align: center;
    padding: var(--space-10) 0;
    display: grid;
    gap: var(--space-2);
  }

  .empty-stage h2 {
    font-size: var(--text-2xl);
  }

  .lobby-wait {
    max-width: 480px;
    margin: var(--space-16) auto;
    padding: var(--space-10) var(--space-6);
    text-align: center;
    display: grid;
    justify-items: center;
    gap: var(--space-3);
  }

  .lobby-wait h1 {
    font-size: var(--text-2xl);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    animation: spin 900ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .reconnect,
  .demo-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .reconnect {
    background: var(--color-warning-soft);
    border: 1px solid var(--color-warning);
  }

  .demo-banner {
    background: var(--color-accent-soft);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .link-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--target-min);
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .link-btn:hover {
    color: var(--color-text);
    text-decoration: underline;
  }

  @media (max-width: 480px) {
    .stage {
      padding: var(--space-4);
    }

    .pad {
      padding: var(--space-4);
    }
  }

  @media print {
    .layout {
      display: block;
    }

    .stage,
    .side {
      display: none;
    }

    .panel {
      border: 0;
    }
  }
</style>
