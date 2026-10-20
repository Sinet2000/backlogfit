import type { Card } from './scales.ts';
import type {
  ClientMessage,
  CloseReason,
  CreateRoomRequest,
  PasscodeHash,
  ServerMessage,
} from './schemas.ts';
import type { TaskPolicy } from './tasks.ts';
import type { Team } from './teams.ts';

export type Role = 'voter' | 'spectator';
/** admin = holds the admin secret; coadmin = promoted by an admin; none = regular participant. */
export type Authority = 'admin' | 'coadmin' | 'none';
export type Phase = 'idle' | 'voting' | 'revealed';

export interface Participant {
  id: string;
  name: string;
  role: Role;
  authority: Authority;
  /** Team id from config.teams, or null. */
  team: string | null;
  status: 'active' | 'lobby';
  conn: string | null;
  /** SHA-256 hex of the current resume token. Rotated on every successful hello. */
  resumeHash: string;
  joinedAt: number;
}

export interface Vote {
  pid: string;
  name: string;
  /** The voter's team, kept current until the round is revealed, then fixed. */
  team: string | null;
  value: string;
}

export interface Round {
  n: number;
  votes: Vote[];
  startedAt: number;
  revealedAt: number | null;
  /** Fixed once voting starts; can only be switched on (never de-anonymize cast votes). */
  anonymous: boolean;
}

export interface Task {
  id: string;
  key: string | null;
  title: string | null;
  url: string | null;
  /** Team ids that estimate this task; null = everyone. */
  voters: string[] | null;
  rounds: Round[];
  final: string | null;
}

export interface Settings {
  autoReveal: boolean;
  anonymousAfterReveal: boolean;
  allowSpectators: boolean;
  lobby: boolean;
  timerSeconds: number | null;
  locked: boolean;
}

export interface Limits {
  maxLifetimeMs: number;
  idleTimeoutMs: number;
  maxParticipants: number;
  maxTasks: number;
  passcodeMaxAttempts: number;
}

export const HOUR_MS = 3_600_000;

export const DEFAULT_LIMITS: Readonly<Limits> = {
  maxLifetimeMs: 8 * HOUR_MS,
  idleTimeoutMs: 30 * 60_000,
  maxParticipants: 50,
  maxTasks: 500,
  passcodeMaxAttempts: 5,
};

export interface RoomSecretsState {
  joinHash: string;
  adminHash: string;
  passcode: PasscodeHash | null;
}

/** Full server-side room state. Never sent to clients; only project() output is. */
export interface RoomState {
  v: 1;
  roomId: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  rev: number;
  config: {
    scale: Card[];
    taskPolicy: TaskPolicy;
    allowlist: string[];
    idPattern: string | null;
    linkTemplate: string | null;
    maxParticipants: number;
    theme: 'corporate' | 'colorful';
    teams: Team[];
  };
  settings: Settings;
  secrets: RoomSecretsState;
  passcodeFailures: number;
  passcodeLocked: boolean;
  limits: Limits;
  participants: Participant[];
  tasks: Task[];
  currentTaskId: string | null;
  timer: { endsAt: number; seconds: number } | null;
  alarmAt: number | null;
  closed: CloseReason | null;
}

export interface Ctx {
  now: number;
  randomId: () => string;
}

/** Computed by the adapter (async hashing) before reduce; see verifyHello(). */
export interface HelloAuth {
  joinOk: boolean;
  adminOk: boolean;
  passcodeOk: boolean | null;
  resumeParticipantId: string | null;
  /** Fresh resume token for this connection; only its hash is stored. */
  resume: { token: string; hash: string };
}

export type RoomEvent =
  | { type: 'connect'; conn: string }
  | { type: 'disconnect'; conn: string }
  | { type: 'tick' }
  | { type: 'message'; conn: string; msg: ClientMessage; auth?: HelloAuth };

export type Effect =
  | { type: 'send'; to: string; msg: ServerMessage }
  /** Send `state` to every active participant connection, each projected for its viewer. */
  | { type: 'broadcastState' }
  /** Send `closed{reason}` to the connection, then close it. */
  | { type: 'close'; to: string; reason: CloseReason }
  /** Single room alarm. null = cancel. */
  | { type: 'scheduleAlarm'; at: number | null }
  /** Wipe all room storage and close every remaining socket (also pre-hello ones). */
  | { type: 'deleteAll'; reason: CloseReason };

export interface ReduceResult {
  state: RoomState;
  effects: Effect[];
}

export type { CreateRoomRequest };

export function currentTask(state: RoomState): Task | null {
  return state.tasks.find((t) => t.id === state.currentTaskId) ?? null;
}

export function currentRound(state: RoomState): Round | null {
  const task = currentTask(state);
  return task?.rounds[task.rounds.length - 1] ?? null;
}

export function phaseOf(state: RoomState): Phase {
  const round = currentRound(state);
  if (round === null) return 'idle';
  return round.revealedAt === null ? 'voting' : 'revealed';
}

export function maxExpiresAt(state: RoomState): number {
  return state.createdAt + state.limits.maxLifetimeMs;
}

export function idleAt(state: RoomState): number {
  return state.lastActivityAt + state.limits.idleTimeoutMs;
}

/**
 * Fills in fields added after a room was stored (teams, team, voters), so state written by an
 * older build keeps working. Returns the input unchanged when nothing is missing.
 */
export function normalizeRoomState(state: RoomState): RoomState {
  const s = state as RoomState & { config: { teams?: Team[] } };
  const needs =
    s.config.teams === undefined ||
    s.participants.some((p) => p.team === undefined) ||
    s.tasks.some(
      (t) =>
        t.voters === undefined || t.rounds.some((r) => r.votes.some((x) => x.team === undefined)),
    );
  if (!needs) return state;
  const d = structuredClone(state);
  d.config.teams ??= [];
  for (const p of d.participants) p.team ??= null;
  for (const t of d.tasks) {
    t.voters ??= null;
    for (const r of t.rounds) for (const x of r.votes) x.team ??= null;
  }
  return d;
}

export function isFacilitator(p: Participant | undefined | null): boolean {
  return p != null && p.status === 'active' && p.authority !== 'none';
}
