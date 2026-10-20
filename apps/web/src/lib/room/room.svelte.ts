import {
  type ActionTarget,
  type Actor,
  type ClientMessageInput,
  can,
  canEstimate,
  type ErrorCode,
  nextTaskId,
  type ParticipantView,
  type RoomAction,
  type RoomView,
  type RoundView,
  type TaskView,
  type Team,
} from '@backlogfit/core';
import { toasts } from '../toast.svelte.ts';
import { type ConnectionSnapshot, type JoinRequest, RoomConnection } from './connection.ts';
import { demoEngine } from './demo.ts';
import type { RoomLink } from './link.ts';
import { errorText } from './messages.ts';
import { batches, splitLines } from './prepared-tasks.ts';
import { RoomSessionStore, sessionStore } from './storage.ts';
import { loopbackTransport, type TransportFactory, webSocketTransport } from './transport.ts';

export type SessionSettings = Extract<ClientMessageInput, { type: 'admin.settings' }>;
export type SettingsPatch = Omit<SessionSettings, 'type'>;

export interface AddOptions {
  estimateNow?: boolean;
  /** Teams for lines without a #team tag; null or omitted = everyone. */
  voters?: string[] | null;
}

interface PendingAdd {
  left: number;
  ids: string[];
  done: (ids: string[] | null) => void;
}

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
  readonly #pending = new Map<string, PendingAdd>();
  #requestSeq = 0;
  /** True after a join from the form, until the person has confirmed their team. */
  askTeam = $state(false);
  teamHint = $state<string | null>(null);

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
  upNextId = $derived(this.snap.view ? nextTaskId(this.snap.view) : null);
  teams = $derived<Team[]>(this.snap.view?.config.teams ?? []);
  me = $derived<ParticipantView | null>(
    this.snap.view?.participants.find((p) => p.id === this.snap.view?.me?.participantId) ?? null,
  );
  /** Voters who may estimate the current task (everyone with role voter on an Everyone task). */
  eligible = $derived<ParticipantView[]>(
    this.snap.view?.participants.filter((p) => canEstimate(p, this.currentTask?.voters)) ?? [],
  );
  canEstimateNow = $derived(!!this.me && canEstimate(this.me, this.currentTask?.voters));
  needsTeam = $derived(this.askTeam && this.snap.status === 'joined' && this.teams.length > 0);
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
      onTasksAdded: (requestId, ids) => this.#tasksAdded(requestId, ids),
    });
  }

  teamName(id: string | null | undefined): string | null {
    return this.teams.find((t) => t.id === id)?.name ?? null;
  }

  serverNow = (): number => Date.now() + this.snap.clockOffset;

  can(action: RoomAction, target?: ActionTarget): boolean {
    return can(this.actor, action, target);
  }

  /** Joins from the form; with teams in the room the person then confirms their team. */
  join(req: JoinRequest, opts: { askTeam?: boolean } = {}): void {
    this.askTeam = opts.askTeam ?? false;
    this.teamHint = req.team ?? null;
    this.#conn.join(req);
  }

  chooseTeam(team: string | null): void {
    this.askTeam = false;
    if ((this.me?.team ?? null) !== team) this.#send({ type: 'team', team });
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

  /**
   * Sends the lines in batches. `added` resolves with the ids the server created, from its
   * `tasks.added` replies, or with null when the add was refused or the connection dropped.
   */
  addTasks(
    text: string | readonly string[],
    opts: AddOptions = {},
  ): { count: number; added: Promise<string[] | null> } {
    const lines = typeof text === 'string' ? splitLines(text) : [...text];
    if (lines.length === 0) return { count: 0, added: Promise.resolve([]) };
    const parts = batches(lines);
    const requestId = `add${++this.#requestSeq}`;
    const added = new Promise<string[] | null>((done) => {
      this.#pending.set(requestId, { left: parts.length, ids: [], done });
    });
    const voters = opts.voters ?? null;
    for (const batch of parts) {
      const sent = this.#conn.send({
        type: 'admin.tasks.add',
        lines: batch,
        requestId,
        ...(voters ? { voters } : {}),
      });
      if (!sent) {
        toasts.show('Not connected right now. Reconnecting…', 'error');
        this.#settleAdd(requestId, true);
        break;
      }
    }
    if (opts.estimateNow) {
      void added.then((ids) => {
        if (ids?.[0]) this.select(ids[0]);
      });
    }
    return { count: lines.length, added };
  }

  setVoters(taskId: string, voters: string[] | null): void {
    this.#send({ type: 'admin.tasks.voters', taskId, voters });
  }

  setTeams(teams: Team[]): void {
    this.#send({ type: 'admin.teams', teams });
  }

  updateParticipant(
    participantId: string,
    change: { role?: 'voter' | 'spectator'; team?: string | null },
  ): void {
    this.#send({ type: 'admin.participant', participantId, ...change });
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
    if (this.snap.status !== 'joined' && this.#pending.size > 0) {
      for (const id of [...this.#pending.keys()]) this.#settleAdd(id, true);
    }
  }

  #tasksAdded(requestId: string | undefined, ids: string[]): void {
    const p = requestId ? this.#pending.get(requestId) : undefined;
    if (!p || !requestId) return;
    p.ids.push(...ids);
    p.left -= 1;
    if (p.left <= 0) this.#settleAdd(requestId);
  }

  #settleAdd(requestId: string, failed = false): void {
    const p = this.#pending.get(requestId);
    if (!p) return;
    this.#pending.delete(requestId);
    p.done(failed ? null : p.ids);
  }

  #serverError(code: ErrorCode, ref: string | undefined): void {
    if (ref === 'admin.tasks.add' && code !== 'invalid_task') {
      for (const id of [...this.#pending.keys()]) this.#settleAdd(id, true);
    }
    toasts.show(errorText(code, ref), 'error');
  }
}
