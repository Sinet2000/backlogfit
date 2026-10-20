import type {
  ClientMessageInput,
  ErrorCode,
  ParticipantView,
  RoomView,
  RoundView,
  TaskView,
} from '@backlogfit/core';
import { toasts } from '../toast.svelte.ts';
import { type ConnectionSnapshot, type JoinRequest, RoomConnection } from './connection.ts';
import { demoEngine } from './demo.ts';
import type { RoomLink } from './link.ts';
import { errorText } from './messages.ts';
import { batches, splitLines } from './prepared-tasks.ts';
import { type Actor, can, nextTaskId, type RoomAction } from './rules.ts';
import { RoomSessionStore, sessionStore } from './storage.ts';
import { loopbackTransport, type TransportFactory, webSocketTransport } from './transport.ts';

export type SessionSettings = Extract<ClientMessageInput, { type: 'admin.settings' }>;
export type SettingsPatch = Omit<SessionSettings, 'type'>;

/** Reactive room state for the UI, with one typed method per protocol action. */
export class RoomStore {
  snap = $state<ConnectionSnapshot>({
    status: 'idle',
    view: null,
    you: null,
    ended: null,
    joinError: null,
    attempt: 0,
    clockOffset: 0,
    queuedVote: null,
  });

  readonly link: RoomLink;
  readonly demo: boolean;
  readonly session: RoomSessionStore;
  readonly #conn: RoomConnection;
  #selectAfterAdd: { known: Set<string> } | null = null;

  view = $derived<RoomView | null>(this.snap.view);
  authority = $derived(this.snap.view?.me?.authority ?? this.snap.you?.authority ?? 'none');
  actor = $derived<Actor>({
    id: this.snap.view?.me?.participantId ?? this.snap.you?.participantId ?? null,
    authority: this.authority,
  });
  canFacilitate = $derived(this.authority === 'admin' || this.authority === 'coadmin');
  isHost = $derived(this.authority === 'admin');
  canVote = $derived((this.snap.view?.me?.role ?? this.snap.you?.role) === 'voter');
  currentTask = $derived<TaskView | null>(
    this.snap.view?.tasks.find((t) => t.id === this.snap.view?.currentTaskId) ?? null,
  );
  currentRound = $derived<RoundView | null>(
    this.currentTask?.rounds.find((r) => r.n === this.snap.view?.round) ?? null,
  );
  upNextId = $derived(
    this.snap.view ? nextTaskId(this.snap.view.tasks, this.snap.view.currentTaskId) : null,
  );
  myVote = $derived.by<string | null>(() => {
    const v = this.snap.view;
    const q = this.snap.queuedVote;
    if (q && v && q.taskId === v.currentTaskId && q.round === v.round) return q.value;
    return v?.myVote ?? null;
  });

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
        this.#afterChange();
      },
      onServerError: (code, ref) => this.#serverError(code, ref),
    });
  }

  serverNow = (): number => Date.now() + this.snap.clockOffset;

  can(action: RoomAction, target?: Pick<ParticipantView, 'id' | 'authority'>): boolean {
    return can(this.actor, action, target);
  }

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

  vote(value: string | null): void {
    const v = this.snap.view;
    if (v?.phase !== 'voting' || v.currentTaskId === null || v.round === null) return;
    const r = this.#conn.vote(v.currentTaskId, v.round, value);
    if (r === 'queued') toasts.show('Connection lost. Your vote is sent when it is back.', 'info');
    if (r === 'dropped') toasts.show('Not connected right now. Reconnecting…', 'error');
  }

  reveal(): void {
    if (this.snap.view?.phase === 'voting') this.#send({ type: 'admin.reveal' });
  }

  restartRound(): void {
    this.#send({ type: 'admin.revote' });
  }

  next(): void {
    this.#send({ type: 'admin.next' });
  }

  select(taskId: string): void {
    this.#send({ type: 'admin.select', taskId });
  }

  setFinal(taskId: string, value: string | null): void {
    this.#send({ type: 'admin.final', taskId, value });
  }

  saveAndNext(taskId: string, value: string): void {
    this.setFinal(taskId, value);
    this.next();
  }

  addTasks(text: string | readonly string[], opts: { estimateNow?: boolean } = {}): number {
    const lines = typeof text === 'string' ? splitLines(text) : [...text];
    if (lines.length === 0) return 0;
    if (opts.estimateNow) {
      this.#selectAfterAdd = { known: new Set(this.snap.view?.tasks.map((t) => t.id)) };
    }
    for (const batch of batches(lines)) this.#send({ type: 'admin.tasks.add', lines: batch });
    return lines.length;
  }

  removeTask(taskId: string): void {
    this.#send({ type: 'admin.tasks.remove', taskId });
  }

  moveTask(taskId: string, toIndex: number): void {
    const n = this.snap.view?.tasks.length ?? 0;
    if (toIndex >= 0 && toIndex < n) this.#send({ type: 'admin.tasks.move', taskId, toIndex });
  }

  startTimer(): void {
    this.#send({ type: 'admin.timer', action: 'start' });
  }

  stopTimer(): void {
    this.#send({ type: 'admin.timer', action: 'stop' });
  }

  updateSettings(patch: SettingsPatch): void {
    this.#send({ type: 'admin.settings', ...patch });
  }

  setLocked(locked: boolean): void {
    this.#send({ type: 'admin.lock', locked });
  }

  kick(participantId: string): void {
    this.#send({ type: 'admin.kick', participantId });
  }

  promote(participantId: string): void {
    this.#send({ type: 'admin.promote', participantId });
  }

  demote(participantId: string): void {
    this.#send({ type: 'admin.demote', participantId });
  }

  admit(participantId: string, decision: 'approve' | 'deny'): void {
    this.#send({ type: 'admin.lobby', participantId, decision });
  }

  extend(hours = 1): void {
    this.#send({ type: 'admin.extend', hours });
  }

  close(): void {
    this.#send({ type: 'admin.close' });
  }

  #send(msg: ClientMessageInput): void {
    if (!this.#conn.send(msg)) toasts.show('Not connected right now. Reconnecting…', 'error');
  }

  #afterChange(): void {
    const pending = this.#selectAfterAdd;
    const tasks = this.snap.view?.tasks;
    if (!pending || !tasks) return;
    const added = tasks.find((t) => !pending.known.has(t.id));
    if (!added) return;
    this.#selectAfterAdd = null;
    this.select(added.id);
  }

  #serverError(code: ErrorCode, ref: string | undefined): void {
    if (code === 'invalid_task' || code === 'too_many_tasks') this.#selectAfterAdd = null;
    toasts.show(errorText(code, ref), 'error');
  }
}
