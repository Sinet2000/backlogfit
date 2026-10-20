import {
  type ClientMessage,
  type Ctx,
  createRoom,
  DEFAULT_LIMITS,
  type Effect,
  expandEffects,
  type HelloAuth,
  type Limits,
  parseCreateRoomRequest,
  presetScale,
  type ReduceResult,
  type RoomConfigInput,
  type RoomEvent,
  type RoomState,
  reduce,
  type ServerMessage,
} from '../src/index.ts';

export const T0 = 1_700_000_000_000;
export const HASH = (c: string) => c.repeat(64).slice(0, 64);

export function counterIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export interface Sim {
  state: RoomState;
  now: number;
  ids: () => string;
  log: Effect[][];
}

export function newRoom(
  config: Partial<RoomConfigInput> = {},
  opts: { limits?: Partial<Limits>; passcode?: boolean; lifetimeHours?: number } = {},
): Sim {
  const parsed = parseCreateRoomRequest({
    v: 1,
    config: { scale: presetScale('fibonacci'), ...config },
    joinHash: HASH('a'),
    adminHash: HASH('b'),
    lifetimeHours: opts.lifetimeHours ?? 2,
    ...(opts.passcode ? { passcode: { salt: '0'.repeat(32), hash: HASH('c') } } : {}),
  });
  if (!parsed.ok) throw new Error(`bad config: ${parsed.code}`);
  const ids = counterIds('p');
  const { state } = createRoom(
    parsed.msg,
    'room1',
    { now: T0, randomId: ids },
    {
      ...DEFAULT_LIMITS,
      ...opts.limits,
    },
  );
  return { state, now: T0, ids, log: [] };
}

export function ctx(sim: Sim): Ctx {
  return { now: sim.now, randomId: sim.ids };
}

export function step(sim: Sim, event: RoomEvent): ReduceResult {
  const r = reduce(sim.state, event, ctx(sim));
  sim.state = r.state;
  sim.log.push(r.effects);
  return r;
}

export function auth(over: Partial<HelloAuth> = {}): HelloAuth {
  return {
    joinOk: true,
    adminOk: false,
    passcodeOk: null,
    resumeParticipantId: null,
    resume: { token: 'tok_tok_tok_tok_tok', hash: HASH('d') },
    ...over,
  };
}

export function hello(
  name: string,
  over: Partial<Extract<ClientMessage, { type: 'hello' }>> = {},
): Extract<ClientMessage, { type: 'hello' }> {
  return { type: 'hello', v: 1, joinSecret: 'j'.repeat(22), name, role: 'voter', ...over };
}

/** Join and return the new participant id. */
export function join(
  sim: Sim,
  conn: string,
  name: string,
  opts: {
    admin?: boolean;
    role?: 'voter' | 'spectator';
    auth?: Partial<HelloAuth>;
    resumeHash?: string;
  } = {},
): string {
  const msg = hello(name, {
    role: opts.role ?? 'voter',
    ...(opts.admin ? { adminSecret: 'a'.repeat(22) } : {}),
  });
  step(sim, {
    type: 'message',
    conn,
    msg,
    auth: auth({
      adminOk: opts.admin ?? false,
      resume: { token: `tok-${conn}-xxxxxxxxxxxx`, hash: opts.resumeHash ?? HASH('e') },
      ...opts.auth,
    }),
  });
  const p = sim.state.participants.find((x) => x.conn === conn);
  if (!p) throw new Error(`join failed for ${name}`);
  return p.id;
}

export function send(sim: Sim, conn: string, msg: ClientMessage): ReduceResult {
  return step(sim, { type: 'message', conn, msg });
}

/** Messages the reducer's effects would deliver to `conn` (after projection). */
export function outbox(r: ReduceResult, conn: string): ServerMessage[] {
  return expandEffects(r.state, r.effects)
    .filter((o): o is Extract<typeof o, { type: 'send' }> => o.type === 'send' && o.to === conn)
    .map((o) => o.msg);
}

export function errorsOf(r: ReduceResult): string[] {
  return r.effects.flatMap((e) =>
    e.type === 'send' && e.msg.type === 'error' ? [e.msg.code] : [],
  );
}

export function current(sim: Sim) {
  const t = sim.state.tasks.find((x) => x.id === sim.state.currentTaskId);
  const r = t?.rounds[t.rounds.length - 1];
  return { taskId: t?.id ?? '', round: r?.n ?? 0, task: t, r };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
