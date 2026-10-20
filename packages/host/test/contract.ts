import type { ServerMessage } from '@backlogfit/core';
import type { describe as Describe, expect as Expect, it as It } from 'vitest';

export interface WireClient {
  readonly frames: string[];
  readonly messages: ServerMessage[];
  readonly closed: Promise<number>;
  send(msg: Record<string, unknown> | string): void;
  next<T extends ServerMessage['type']>(
    type: T,
    pred?: (m: Extract<ServerMessage, { type: T }>) => boolean,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  close(): void;
}

export interface WireRoom {
  roomId: string;
  joinSecret: string;
  adminSecret: string;
}

export interface WireRoomOptions {
  lobby?: boolean;
  teams?: { id: string; name: string }[];
}

/** One backend under test, started with CONTRACT_ENV and no per-client upgrade limit. */
export interface WireHarness {
  createRoom(opts?: WireRoomOptions): Promise<WireRoom>;
  open(roomId: string): Promise<WireClient>;
  elapse(ms: number): Promise<void>;
}

export const CONTRACT_ENV = {
  MAX_MESSAGE_BYTES: '1024',
  MAX_PARTICIPANTS: '2',
  HELLO_TIMEOUT_SECONDS: '1',
} as const;

const HELLO_TIMEOUT_MS = 1000;
const PENDING_LIMIT = 2 * 2 + 20;
const WRONG = 'A'.repeat(22);

interface Api {
  describe: typeof Describe;
  it: typeof It;
  expect: typeof Expect;
}

/** Registers the scenarios every backend must pass, against the given harness. */
export function roomContract(name: string, api: Api, harness: () => WireHarness): void {
  const { describe, it, expect } = api;

  function hello(room: WireRoom, name: string, extra: Record<string, unknown> = {}) {
    return { type: 'hello', v: 1, joinSecret: room.joinSecret, name, role: 'voter', ...extra };
  }

  async function join(
    room: WireRoom,
    name: string,
    admin = false,
    extra: Record<string, unknown> = {},
  ) {
    const c = await harness().open(room.roomId);
    c.send(hello(room, name, { ...(admin ? { adminSecret: room.adminSecret } : {}), ...extra }));
    const welcome = await c.next('welcome');
    return { c, welcome };
  }

  const TEAMS = [
    { id: 'dev', name: 'Dev' },
    { id: 'qa', name: 'QA' },
  ];

  function unknownId(): string {
    return `unknownRoom${Math.random().toString(36).slice(2, 12)}`;
  }

  describe(`room contract: ${name}`, () => {
    it('runs a full session and wipes the room on close', async () => {
      const h = harness();
      const room = await h.createRoom();
      const admin = await join(room, 'Ada', true);
      expect(admin.welcome.you.isAdmin).toBe(true);
      const bob = await join(room, 'Bob');
      admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-1 Login'] });
      const added = await admin.c.next('state', (m) => m.room.tasks.length === 1);
      const taskId = added.room.tasks[0]?.id as string;
      admin.c.send({ type: 'admin.next' });
      await bob.c.next('state', (m) => m.room.phase === 'voting');
      admin.c.send({ type: 'vote', taskId, round: 1, value: '13' });
      const seen = await bob.c.next('state', (m) =>
        m.room.participants.some((p) => p.name === 'Ada' && p.hasVoted),
      );
      expect(seen.room.tasks[0]?.rounds[0]?.votes).toBeNull();
      expect(seen.room.myVote).toBeNull();
      bob.c.send({ type: 'vote', taskId, round: 1, value: '5' });
      const revealed = await admin.c.next('state', (m) => m.room.phase === 'revealed');
      expect(revealed.room.tasks[0]?.rounds[0]?.votes?.map((v) => v.value).sort()).toEqual([
        '13',
        '5',
      ]);
      bob.c.send({ type: 'admin.close' });
      expect(await bob.c.next('error')).toEqual({
        type: 'error',
        code: 'forbidden',
        ref: 'admin.close',
      });
      admin.c.send({ type: 'admin.close' });
      expect(await bob.c.next('closed')).toEqual({ type: 'closed', reason: 'closed' });
      expect(await bob.c.closed).toBe(4003);
      expect(await admin.c.closed).toBe(4003);

      const late = await h.open(room.roomId);
      late.send(hello(room, 'Late'));
      expect(await late.next('closed')).toEqual({ type: 'closed', reason: 'not_found' });
      expect(await late.closed).toBe(4404);
    });

    it('answers a wrong join secret exactly like an unknown room', async () => {
      const h = harness();
      const room = await h.createRoom();
      const real = await h.open(room.roomId);
      const fake = await h.open(unknownId());
      for (const c of [real, fake]) c.send(hello({ ...room, joinSecret: WRONG }, 'Eve'));
      expect(await real.closed).toBe(4404);
      expect(await fake.closed).toBe(4404);
      expect(fake.frames).toEqual(real.frames);
    });

    it('treats real and unknown rooms alike before hello', async () => {
      const h = harness();
      const room = await h.createRoom();
      const real = await h.open(room.roomId);
      const fake = await h.open(unknownId());
      for (const c of [real, fake]) {
        c.send({ type: 'ping' });
        c.send('{');
      }
      await real.next('error', (m) => m.code === 'bad_json');
      await fake.next('error', (m) => m.code === 'bad_json');
      await h.elapse(HELLO_TIMEOUT_MS + 300);
      expect(await real.closed).toBe(1008);
      expect(await fake.closed).toBe(1008);
      expect([...fake.frames].sort()).toEqual([...real.frames].sort());
    });

    it('closes an oversized frame with 1009 and an invalid flood with 1008', async () => {
      const h = harness();
      const room = await h.createRoom();
      const big = await h.open(room.roomId);
      big.send('x'.repeat(1025));
      expect(await big.closed).toBe(1009);
      const flood = await h.open(room.roomId);
      flood.send('not json');
      expect(await flood.next('error')).toEqual({ type: 'error', code: 'bad_json' });
      for (let i = 0; i < 20; i++) flood.send('{');
      expect(await flood.closed).toBe(1008);
    });

    it('resumes a participant and replaces the old socket', async () => {
      const h = harness();
      const room = await h.createRoom();
      const first = await join(room, 'Ada', true);
      const second = await h.open(room.roomId);
      second.send(hello(room, 'Ada', { resumeToken: first.welcome.you.resumeToken }));
      const welcome = await second.next('welcome');
      expect(welcome.you.participantId).toBe(first.welcome.you.participantId);
      expect(await first.c.next('closed')).toEqual({ type: 'closed', reason: 'replaced' });
      expect(await first.c.closed).toBe(4006);
    });

    it('marks a participant disconnected when the socket goes away', async () => {
      const room = await harness().createRoom();
      const admin = await join(room, 'Ada', true);
      const bob = await join(room, 'Bob');
      bob.c.close();
      const s = await admin.c.next(
        'state',
        (m) => m.room.participants.find((p) => p.name === 'Bob')?.connected === false,
      );
      expect(s.room.participants).toHaveLength(2);
    });

    it('removes a participant who sends leave', async () => {
      const room = await harness().createRoom();
      const admin = await join(room, 'Ada', true);
      const bob = await join(room, 'Bob');
      bob.c.send({ type: 'leave' });
      expect(await bob.c.next('closed')).toEqual({ type: 'closed', reason: 'left' });
      expect(await bob.c.closed).toBe(4007);
      const s = await admin.c.next('state', (m) => m.room.participants.length === 1);
      expect(s.room.participants.map((p) => p.name)).toEqual(['Ada']);
    });

    it('answers pings in the lobby', async () => {
      const h = harness();
      const room = await h.createRoom({ lobby: true });
      await join(room, 'Ada', true);
      const bob = await h.open(room.roomId);
      bob.send(hello(room, 'Bob'));
      await bob.next('lobby', (m) => m.status === 'waiting');
      bob.send({ type: 'ping' });
      expect((await bob.next('pong')).serverTime).toBeTypeOf('number');
    });

    it('enforces room capacity on hello and evicts the oldest pending sockets', async () => {
      const h = harness();
      const room = await h.createRoom();
      const squatters: WireClient[] = [];
      for (let i = 0; i < PENDING_LIMIT + 6; i++) squatters.push(await h.open(room.roomId));
      const admin = await join(room, 'Ada', true);
      const bob = await join(room, 'Bob');
      expect(bob.welcome.room.participants).toHaveLength(2);
      const carol = await h.open(room.roomId);
      carol.send(hello(room, 'Carol'));
      expect(await carol.next('error')).toMatchObject({ code: 'room_full' });
      expect(await squatters[0]?.closed).toBe(1008);
      admin.c.close();
    });
    it('limits a team task to its team and acknowledges added tasks', async () => {
      const room = await harness().createRoom({ teams: TEAMS });
      const admin = await join(room, 'Ada', true);
      const quinn = await join(room, 'Quinn', false, { team: 'ops' });
      expect(quinn.welcome.room.config.teams).toEqual(TEAMS);
      expect(quinn.welcome.room.participants.find((p) => p.name === 'Quinn')?.team).toBeNull();
      admin.c.send({
        type: 'admin.participant',
        participantId: quinn.welcome.you.participantId,
        team: 'qa',
      });
      await quinn.c.next('state', (m) => m.room.participants.some((p) => p.team === 'qa'));
      admin.c.send({
        type: 'admin.tasks.add',
        lines: ['SCP-1 Test plan #qa', 'SCP-2 Build'],
        requestId: 'r1',
      });
      const ack = await admin.c.next('tasks.added');
      expect(ack.requestId).toBe('r1');
      expect(ack.taskIds).toHaveLength(2);
      const taskId = ack.taskIds[0];
      admin.c.send({ type: 'admin.select', taskId });
      const voting = await quinn.c.next('state', (m) => m.room.phase === 'voting');
      expect(voting.room.tasks[0]?.voters).toEqual(['qa']);
      admin.c.send({ type: 'vote', taskId, round: 1, value: '5' });
      expect(await admin.c.next('error')).toEqual({
        type: 'error',
        code: 'not_eligible',
        ref: 'vote',
      });
      quinn.c.send({ type: 'vote', taskId, round: 1, value: '3' });
      const revealed = await admin.c.next('state', (m) => m.room.phase === 'revealed');
      expect(revealed.room.tasks[0]?.rounds[0]?.votes?.map((x) => x.name)).toEqual(['Quinn']);
    });

    it('moves people between roles and shows a per-team summary', async () => {
      const room = await harness().createRoom({ teams: TEAMS });
      const admin = await join(room, 'Ada', true, { team: 'dev' });
      const quinn = await join(room, 'Quinn', false, { team: 'qa' });
      const pid = quinn.welcome.you.participantId;
      admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-1'] });
      const [taskId] = (await admin.c.next('tasks.added')).taskIds;
      admin.c.send({ type: 'admin.next' });
      await quinn.c.next('state', (m) => m.room.phase === 'voting');
      quinn.c.send({ type: 'vote', taskId, round: 1, value: '8' });
      await admin.c.next('state', (m) => m.room.participants.some((p) => p.hasVoted));
      admin.c.send({ type: 'admin.participant', participantId: pid, role: 'spectator' });
      const moved = await quinn.c.next('state', (m) => m.room.me?.role === 'spectator');
      expect(moved.room.tasks[0]?.rounds[0]?.voteCount).toBe(0);
      admin.c.send({ type: 'admin.participant', participantId: pid, role: 'voter' });
      await quinn.c.next('state', (m) => m.room.me?.role === 'voter');
      quinn.c.send({ type: 'vote', taskId, round: 1, value: '3' });
      await admin.c.next('state', (m) => m.room.participants.some((p) => p.hasVoted));
      admin.c.send({ type: 'vote', taskId, round: 1, value: '5' });
      const revealed = await quinn.c.next('state', (m) => m.room.phase === 'revealed');
      expect(revealed.room.tasks[0]?.rounds[0]?.teams).toEqual({
        hidden: false,
        groups: [
          { team: 'dev', count: 1, median: '5' },
          { team: 'qa', count: 1, median: '3' },
        ],
      });
    });
  });
}
