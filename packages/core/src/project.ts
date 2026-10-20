import { type Card, indexScale } from './scales.ts';
import type { RoomView, RoundView, VoteView } from './schemas.ts';
import {
  currentRound,
  idleAt,
  isFacilitator,
  maxExpiresAt,
  phaseOf,
  type RoomState,
  type Round,
} from './state.ts';
import { computeStats } from './stats.ts';

/**
 * Anonymous rounds list values sorted by scale order, so nothing links a value to a person
 * (not even the order in which people voted, which others could observe via hasVoted).
 */
function anonymousVotes(round: Round, scale: readonly Card[]): VoteView[] {
  const idx = indexScale(scale);
  const order = new Map(scale.map((c, i) => [c.value, idx.position.get(c.value) ?? 1000 + i]));
  return round.votes
    .map((v) => v.value)
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || (a < b ? -1 : a > b ? 1 : 0))
    .map((value) => ({ participantId: null, name: null, value }));
}

function roundView(round: Round, scale: readonly Card[]): RoundView {
  const revealed = round.revealedAt !== null;
  const base = { n: round.n, revealed, anonymous: round.anonymous, voteCount: round.votes.length };
  // Before reveal: counts only, never values.
  if (!revealed) return { ...base, votes: null, stats: null };
  const votes = round.anonymous
    ? anonymousVotes(round, scale)
    : round.votes.map((v) => ({ participantId: v.pid, name: v.name, value: v.value }));
  return {
    ...base,
    votes,
    stats: computeStats(
      round.votes.map((v) => v.value),
      scale,
    ),
  };
}

/**
 * The only way room data leaves the server. Privacy rules:
 *  - Before reveal no vote value appears except the viewer's own (`myVote`).
 *  - Secrets, hashes, connection ids and resume data never appear.
 *  - Lobby entries and the link allowlist are visible to facilitators only.
 */
export function project(state: RoomState, viewerId: string | null): RoomView {
  const viewer = state.participants.find((p) => p.id === viewerId && p.status === 'active') ?? null;
  const facilitator = isFacilitator(viewer);
  const round = currentRound(state);
  const mine = viewer && round ? round.votes.find((v) => v.pid === viewer.id) : undefined;
  const scale = state.config.scale;

  return {
    roomId: state.roomId,
    createdAt: state.createdAt,
    expiresAt: state.expiresAt,
    maxExpiresAt: maxExpiresAt(state),
    idleAt: idleAt(state),
    me: viewer
      ? { participantId: viewer.id, role: viewer.role, authority: viewer.authority }
      : null,
    config: {
      scale: scale.map((c) => ({ ...c })),
      taskPolicy: state.config.taskPolicy,
      allowlist: facilitator ? [...state.config.allowlist] : [],
      idPattern: state.config.idPattern,
      linkTemplate: state.config.linkTemplate,
      maxParticipants: state.config.maxParticipants,
      theme: state.config.theme,
    },
    settings: {
      autoReveal: state.settings.autoReveal,
      anonymousAfterReveal: state.settings.anonymousAfterReveal,
      allowSpectators: state.settings.allowSpectators,
      lobby: state.settings.lobby,
      timerSeconds: state.settings.timerSeconds,
      locked: state.settings.locked,
      passcodeRequired: state.secrets.passcode !== null,
      passcodeLocked: facilitator && state.passcodeLocked,
    },
    participants: state.participants
      .filter((p) => p.status === 'active')
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        authority: p.authority,
        connected: p.conn !== null,
        hasVoted: round ? round.votes.some((v) => v.pid === p.id) : false,
      })),
    lobby: facilitator
      ? state.participants
          .filter((p) => p.status === 'lobby')
          .map((p) => ({ id: p.id, name: p.name, role: p.role }))
      : [],
    tasks: state.tasks.map((t) => ({
      id: t.id,
      key: t.key,
      title: t.title,
      url: t.url,
      final: t.final,
      rounds: t.rounds.map((r) => roundView(r, scale)),
    })),
    currentTaskId: state.currentTaskId,
    phase: phaseOf(state),
    round: round?.n ?? null,
    myVote: mine?.value ?? null,
    timer: state.timer ? { endsAt: state.timer.endsAt, seconds: state.timer.seconds } : null,
  };
}
