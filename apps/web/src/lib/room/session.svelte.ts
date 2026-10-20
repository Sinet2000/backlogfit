import { applyTheme, hasThemePreference, readTheme } from '../theme.ts';
import { toasts } from '../toast.svelte.ts';
import { createDemoRoom, takeDemoTasks } from './demo.ts';
import { parseFragment, type RoomLink, roomUrls, settleAdminSecret } from './link.ts';
import { clearPrepared, handoffStep, readPrepared } from './prepared-tasks.ts';
import { RoomStore } from './room.svelte.ts';
import { type ShortcutAction, shortcutFor } from './shortcuts.ts';
import { sessionStore } from './storage.ts';

export type Boot = 'preparing' | 'invalid' | 'ready';

/** Owns the room page's lifecycle: link parsing, the RoomStore, listeners and one-off handoffs. */
export class RoomSession {
  boot = $state<Boot>('preparing');
  room = $state<RoomStore | null>(null);
  #generation = 0;
  #handoff: { lines: string[]; sent: boolean } | null = null;

  joinUrl = $derived(
    this.room ? roomUrls(location.origin, this.room.link, this.room.demo ? 'demo' : '').join : '',
  );

  announcement = $derived.by(() => {
    const view = this.room?.view;
    if (!view) return '';
    if (view.phase === 'revealed') return 'Votes revealed.';
    if (view.phase === 'voting') {
      return `Voting on ${this.room?.currentTask?.key ?? 'a new task'}, round ${view.round}.`;
    }
    return '';
  });

  /** Starts the session and its listeners; returns the cleanup for the page's onMount. */
  mount(): () => void {
    void this.#init();
    const onOnline = () => this.room?.nudge();
    const onVisible = () => document.visibilityState === 'visible' && this.room?.nudge();
    const onHash = () => this.#restart();
    addEventListener('online', onOnline);
    addEventListener('hashchange', onHash);
    document.addEventListener('visibilitychange', onVisible);
    const stopEffects = $effect.root(() => {
      $effect(() => this.#followThemeHint());
      $effect(() => this.#addDemoTasks());
      $effect(() => this.#handOffPrepared());
    });
    return () => {
      this.#generation++;
      stopEffects();
      removeEventListener('online', onOnline);
      removeEventListener('hashchange', onHash);
      document.removeEventListener('visibilitychange', onVisible);
      this.room?.dispose();
    };
  }

  shortcut(e: KeyboardEvent, dialogOpen: boolean): ShortcutAction | null {
    const room = this.room;
    const view = room?.view;
    if (!room || !view || room.snap.status !== 'joined') return null;
    const action = shortcutFor(e, {
      canVote: room.canVote && view.phase === 'voting',
      canFacilitate: room.canFacilitate,
      dialogOpen,
    });
    if (!action) return null;
    e.preventDefault();
    if (action.type === 'pick') {
      const card = view.config.scale[action.index];
      if (card) room.vote(room.myVote === card.value ? null : card.value);
    } else if (action.type === 'reveal') room.reveal();
    else if (action.type === 'next') room.next();
    return action;
  }

  #restart(): void {
    this.room?.dispose();
    this.room = null;
    this.boot = 'preparing';
    void this.#init();
  }

  async #init(): Promise<void> {
    const gen = ++this.#generation;
    const demo = new URLSearchParams(location.search).has('demo');
    let link = parseFragment(location.hash);
    if (!link && demo && location.hash === '') link = await createDemoRoom({ sampleTasks: true });
    if (gen !== this.#generation) return;
    if (link) {
      // The admin secret moves from the address bar into this tab's sessionStorage (SEC-014).
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
    if (!link) {
      this.boot = 'invalid';
      return;
    }
    this.#start(link, demo);
  }

  #start(link: RoomLink, demo: boolean): void {
    const store = new RoomStore(link, { demo });
    this.room = store;
    this.boot = 'ready';
    const prepared = readPrepared(sessionStore(), link.roomId);
    this.#handoff = prepared ? { lines: prepared, sent: false } : null;
    const who = store.session.identity;
    if (who) store.join(who);
  }

  #followThemeHint(): void {
    const hint = this.room?.view?.config.theme;
    if (hint !== 'colorful' || hasThemePreference()) return;
    const mine = readTheme();
    if (mine.theme === 'corporate') applyTheme('colorful', mine.mode, false);
  }

  #addDemoTasks(): void {
    const room = this.room;
    if (!room?.demo || room.snap.status !== 'joined' || !room.canFacilitate) return;
    const lines = takeDemoTasks(room.link.roomId);
    if (lines) room.addTasks(lines);
  }

  #handOffPrepared(): void {
    const room = this.room;
    const h = this.#handoff;
    if (!room || !h) return;
    const view = room.view;
    const step = handoffStep(h.lines, {
      sent: h.sent,
      canAdd: room.snap.status === 'joined' && room.isHost && view !== null,
      taskCount: view?.tasks.length ?? 0,
    });
    if (step.do === 'send') {
      h.sent = true;
      room.addTasks(h.lines);
    } else if (step.do === 'done') {
      this.#handoff = null;
      clearPrepared(sessionStore(), room.link.roomId);
      if (step.added > 0) {
        toasts.show(
          `${step.added} ${step.added === 1 ? 'task' : 'tasks'} added from your list.`,
          'success',
        );
      }
    }
  }
}
