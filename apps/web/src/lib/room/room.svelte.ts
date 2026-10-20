/** Reactive wrapper around RoomConnection for the /r page. */
import type {
  ClientMessageInput,
  ErrorCode,
  RoomView,
  RoundView,
  TaskView,
} from '@backlogfit/core';
import { toasts } from '../toast.svelte.ts';
import { type ConnectionSnapshot, type JoinRequest, RoomConnection } from './connection.ts';
import { demoEngine } from './demo.ts';
import type { RoomLink } from './link.ts';
import { errorText } from './messages.ts';
import { RoomSessionStore, sessionStore } from './storage.ts';
import { loopbackTransport, type TransportFactory, webSocketTransport } from './transport.ts';

export class RoomStore {
  snap = $state<ConnectionSnapshot>({
    status: 'idle',
    view: null,
    you: null,
    ended: null,
    joinError: null,
    attempt: 0,
    clockOffset: 0,
  });

  readonly link: RoomLink;
  readonly demo: boolean;
  readonly session: RoomSessionStore;
  readonly #conn: RoomConnection;

  view = $derived<RoomView | null>(this.snap.view);
  you = $derived(this.snap.you);
  authority = $derived(this.snap.view?.me?.authority ?? this.snap.you?.authority ?? 'none');
  isFacilitator = $derived(this.authority === 'admin' || this.authority === 'coadmin');
  isAdmin = $derived(this.authority === 'admin');
  canVote = $derived((this.snap.view?.me?.role ?? this.snap.you?.role) === 'voter');
  currentTask = $derived<TaskView | null>(
    this.snap.view?.tasks.find((t) => t.id === this.snap.view?.currentTaskId) ?? null,
  );
  currentRound = $derived<RoundView | null>(
    this.currentTask?.rounds.find((r) => r.n === this.snap.view?.round) ?? null,
  );

  constructor(link: RoomLink, opts: { demo: boolean; transport?: TransportFactory }) {
    this.link = link;
    this.demo = opts.demo;
    this.session = new RoomSessionStore(sessionStore(), link.roomId);
    const transport =
      opts.transport ?? (opts.demo ? loopbackTransport(demoEngine) : webSocketTransport());
    this.#conn = new RoomConnection({
      link,
      transport,
      session: this.session,
      onChange: (s) => {
        this.snap = s;
      },
      onServerError: (code, ref) => this.#serverError(code, ref),
    });
  }

  serverNow = (): number => Date.now() + this.snap.clockOffset;

  join(req: JoinRequest): void {
    this.#conn.join(req);
  }

  retry(): void {
    this.#conn.retry();
  }

  nudge(): void {
    this.#conn.nudge();
  }

  leave(): void {
    this.#conn.leave();
  }

  dispose(): void {
    this.#conn.dispose();
  }

  send(msg: ClientMessageInput): void {
    if (!this.#conn.send(msg)) toasts.show('Not connected right now. Reconnecting…', 'error');
  }

  vote(value: string | null): void {
    const v = this.snap.view;
    if (v?.phase !== 'voting' || v.currentTaskId === null || v.round === null) return;
    if (value === null) this.send({ type: 'unvote', taskId: v.currentTaskId, round: v.round });
    else this.send({ type: 'vote', taskId: v.currentTaskId, round: v.round, value });
  }

  #serverError(code: ErrorCode, ref: string | undefined): void {
    toasts.show(errorText(code, ref), 'error');
  }
}
