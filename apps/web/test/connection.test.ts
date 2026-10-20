import { LoopbackEngine, presetScale } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import {
  BACKOFF_MAX_MS,
  backoffDelay,
  type ConnectionSnapshot,
  RoomConnection,
  type Timers,
} from '../src/lib/room/connection.ts';
import type { RoomLink } from '../src/lib/room/link.ts';
import { memoryStore, RoomSessionStore } from '../src/lib/room/storage.ts';
import { loopbackTransport, type TransportHandlers } from '../src/lib/room/transport.ts';

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

class FakeTimers implements Timers {
  t = 1_000_000;
  #seq = 0;
  jobs = new Map<number, { at: number; fn: () => void; every?: number }>();
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.#seq;
    this.jobs.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(id: unknown) {
    this.jobs.delete(id as number);
  }
  setInterval(fn: () => void, ms: number) {
    const id = ++this.#seq;
    this.jobs.set(id, { at: this.t + ms, fn, every: ms });
    return id;
  }
  clearInterval(id: unknown) {
    this.jobs.delete(id as number);
  }
  now() {
    return this.t;
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = [...this.jobs.entries()]
        .filter(([, j]) => j.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, job] = next;
      this.t = job.at;
      if (job.every) job.at += job.every;
      else this.jobs.delete(id);
      job.fn();
    }
    this.t = end;
  }
}

async function loopbackRoom(config = {}) {
  const now = () => Date.now();
  const r = await LoopbackEngine.create(
    { config: { scale: presetScale('fibonacci'), ...config } },
    { now },
  );
  const link: RoomLink = {
    roomId: r.roomId,
    joinSecret: r.joinSecret,
    adminSecret: null,
    contentKey: null,
  };
  const admin: RoomLink = { ...link, adminSecret: r.adminSecret };
  return { ...r, link, admin };
}

function connect(link: RoomLink, engine: LoopbackEngine | null, store = memoryStore()) {
  const snaps: ConnectionSnapshot[] = [];
  const errors: string[] = [];
  const conn = new RoomConnection({
    link,
    transport: loopbackTransport(() => engine),
    session: new RoomSessionStore(store, link.roomId),
    onChange: (s) => snaps.push(s),
    onServerError: (c) => errors.push(c),
  });
  return { conn, snaps, errors, store, last: () => snaps[snaps.length - 1] };
}

describe('RoomConnection over the loopback engine', () => {
  it('joins, votes and sees the reveal', async () => {
    const { engine, link, admin } = await loopbackRoom({ autoReveal: false });
    const a = connect(admin, engine);
    a.conn.join({ name: 'Admin', role: 'voter' });
    await flush();
    expect(a.last()?.status).toBe('joined');
    expect(a.last()?.you?.isAdmin).toBe(true);

    const v = connect(link, engine);
    v.conn.join({ name: 'Vera', role: 'voter' });
    await flush();
    expect(v.last()?.you?.authority).toBe('none');

    a.conn.send({ type: 'admin.tasks.add', lines: ['SCP-1 First'] });
    await flush();
    a.conn.send({ type: 'admin.next' });
    await flush();
    const view = v.last()?.view;
    expect(view?.phase).toBe('voting');
    v.conn.send({
      type: 'vote',
      taskId: view?.currentTaskId ?? '',
      round: view?.round ?? 1,
      value: '5',
    });
    await flush();
    expect(v.last()?.view?.myVote).toBe('5');
    // Before reveal the admin sees that Vera voted, never what.
    const before = a.last()?.view;
    expect(before?.participants.find((p) => p.name === 'Vera')?.hasVoted).toBe(true);
    expect(JSON.stringify(before?.tasks)).not.toContain('"5"');

    a.conn.send({ type: 'admin.reveal' });
    await flush();
    const round = a.last()?.view?.tasks[0]?.rounds[0];
    expect(round?.revealed).toBe(true);
    expect(round?.votes?.[0]).toMatchObject({ name: 'Vera', value: '5' });
  });

  it('stores the resume token and resumes as the same participant', async () => {
    const { engine, link } = await loopbackRoom();
    const store = memoryStore();
    const first = connect(link, engine, store);
    first.conn.join({ name: 'Rui', role: 'voter' });
    await flush();
    const id = first.last()?.you?.participantId;
    expect(new RoomSessionStore(store, link.roomId).resumeToken).toBeTruthy();
    first.conn.dispose();
    await flush();

    const again = connect(link, engine, store);
    again.conn.join({ name: 'Rui', role: 'voter' });
    await flush();
    expect(again.last()?.you?.participantId).toBe(id);
  });

  it('returns to the form on a wrong passcode', async () => {
    const now = () => Date.now();
    const r = await LoopbackEngine.create(
      { config: { scale: presetScale('fibonacci') }, passcode: 'open sesame' },
      { now },
    );
    const link = {
      roomId: r.roomId,
      joinSecret: r.joinSecret,
      adminSecret: null,
      contentKey: null,
    };
    const c = connect(link, r.engine);
    c.conn.join({ name: 'Pat', role: 'voter', passcode: 'wrong' });
    await flush();
    expect(c.last()).toMatchObject({ status: 'idle', joinError: 'bad_passcode' });
    c.conn.join({ name: 'Pat', role: 'voter', passcode: 'open sesame' });
    await flush();
    expect(c.last()?.status).toBe('joined');
  });

  it('waits in the lobby until approved', async () => {
    const { engine, link, admin } = await loopbackRoom({ lobby: true });
    const a = connect(admin, engine);
    a.conn.join({ name: 'Host', role: 'spectator' });
    await flush();
    const g = connect(link, engine);
    g.conn.join({ name: 'Guest', role: 'voter' });
    await flush();
    expect(g.last()?.status).toBe('lobby');
    const waiting = a.last()?.view?.lobby[0];
    expect(waiting?.name).toBe('Guest');
    a.conn.send({ type: 'admin.lobby', participantId: waiting?.id ?? '', decision: 'approve' });
    await flush();
    expect(g.last()?.status).toBe('joined');
  });

  it('ends with a reason when kicked and forgets the session', async () => {
    const { engine, link, admin } = await loopbackRoom();
    const a = connect(admin, engine);
    a.conn.join({ name: 'Host', role: 'voter' });
    const k = connect(link, engine);
    k.conn.join({ name: 'Kim', role: 'voter' });
    await flush();
    const kim = a.last()?.view?.participants.find((p) => p.name === 'Kim');
    a.conn.send({ type: 'admin.kick', participantId: kim?.id ?? '' });
    await flush();
    expect(k.last()).toMatchObject({ status: 'ended', ended: 'kicked' });
    expect(new RoomSessionStore(k.store, link.roomId).resumeToken).toBeNull();
  });

  it('reports not_found for unknown rooms', async () => {
    const link = {
      roomId: 'ZZZZZZZZZZZZZZZZZZZZZZ',
      joinSecret: 'jjjjjjjjjjjjjjjjjjjjjj',
      adminSecret: null,
      contentKey: null,
    };
    const c = connect(link, null);
    c.conn.join({ name: 'X', role: 'voter' });
    await flush();
    expect(c.last()).toMatchObject({ status: 'ended', ended: 'not_found' });
  });

  it('reports the admin close to everyone', async () => {
    const { engine, link, admin } = await loopbackRoom();
    const a = connect(admin, engine);
    a.conn.join({ name: 'Host', role: 'voter' });
    const v = connect(link, engine);
    v.conn.join({ name: 'Val', role: 'voter' });
    await flush();
    a.conn.send({ type: 'admin.close' });
    await flush();
    expect(v.last()).toMatchObject({ status: 'ended', ended: 'closed' });
    expect(a.last()).toMatchObject({ status: 'ended', ended: 'closed' });
  });

  it('forwards non-join errors', async () => {
    const { engine, link } = await loopbackRoom();
    const v = connect(link, engine);
    v.conn.join({ name: 'Val', role: 'voter' });
    await flush();
    v.conn.send({ type: 'admin.reveal' });
    await flush();
    expect(v.errors).toContain('forbidden');
  });
});

describe('reconnect with backoff', () => {
  it('backoff grows exponentially, is jittered and capped', () => {
    expect(backoffDelay(0, () => 1)).toBe(500);
    expect(backoffDelay(1, () => 1)).toBe(1000);
    expect(backoffDelay(3, () => 1)).toBe(4000);
    expect(backoffDelay(3, () => 0)).toBe(2000);
    expect(backoffDelay(30, () => 1)).toBe(BACKOFF_MAX_MS);
  });

  function fakeServer() {
    const sockets: { h: TransportHandlers; sent: string[]; open: boolean }[] = [];
    const factory = (_roomId: string, h: TransportHandlers) => {
      const s = { h, sent: [] as string[], open: true };
      sockets.push(s);
      return {
        send: (d: string) => void s.sent.push(d),
        close: () => {
          s.open = false;
        },
      };
    };
    const welcome = (token: string) =>
      JSON.stringify({
        type: 'welcome',
        v: 1,
        you: {
          participantId: 'p1',
          role: 'voter',
          authority: 'none',
          isAdmin: false,
          resumeToken: token,
        },
        room: null,
        serverTime: 0,
      });
    return { sockets, factory, welcome };
  }

  it('reconnects after a drop and sends the resume token', async () => {
    const { engine, link } = await loopbackRoom();
    // Real welcome payload from the engine, replayed by a fake socket.
    const probe = engine.connect();
    await probe.send({
      type: 'hello',
      v: 1,
      joinSecret: link.joinSecret,
      name: 'Probe',
      role: 'voter',
    });
    const realWelcome = probe.last('welcome');
    expect(realWelcome).toBeDefined();

    const timers = new FakeTimers();
    const srv = fakeServer();
    const store = memoryStore();
    const snaps: ConnectionSnapshot[] = [];
    const conn = new RoomConnection({
      link,
      transport: srv.factory,
      session: new RoomSessionStore(store, link.roomId),
      timers,
      random: () => 1,
      onChange: (s) => snaps.push(s),
    });
    conn.join({ name: 'Rae', role: 'voter' });
    srv.sockets[0]?.h.onOpen();
    expect(JSON.parse(srv.sockets[0]?.sent[0] ?? '{}')).toMatchObject({
      type: 'hello',
      name: 'Rae',
    });
    srv.sockets[0]?.h.onMessage(
      JSON.stringify({
        ...realWelcome,
        you: { ...realWelcome?.you, resumeToken: 'tok_tok_tok_tok_tok_1' },
      }),
    );
    expect(conn.snapshot.status).toBe('joined');

    // Keep-alive ping.
    timers.advance(25_000);
    expect(srv.sockets[0]?.sent.at(-1)).toBe('{"type":"ping"}');

    // Network drop: reconnecting, then a new socket after the backoff.
    srv.sockets[0]?.h.onClose(1006);
    expect(conn.snapshot.status).toBe('reconnecting');
    expect(conn.send({ type: 'ping' })).toBe(false);
    timers.advance(499);
    expect(srv.sockets).toHaveLength(1);
    timers.advance(1);
    expect(srv.sockets).toHaveLength(2);
    srv.sockets[1]?.h.onOpen();
    const hello = JSON.parse(srv.sockets[1]?.sent[0] ?? '{}');
    expect(hello.resumeToken).toBe('tok_tok_tok_tok_tok_1');

    // Second drop before welcome: longer delay.
    srv.sockets[1]?.h.onClose(1006);
    timers.advance(999);
    expect(srv.sockets).toHaveLength(2);
    timers.advance(1);
    expect(srv.sockets).toHaveLength(3);
    srv.sockets[2]?.h.onMessage(JSON.stringify(realWelcome));
    expect(conn.snapshot).toMatchObject({ status: 'joined', attempt: 0 });
    void srv.welcome;
  });

  it('gives up with "unreachable" when it never connected', () => {
    const timers = new FakeTimers();
    const srv = fakeServer();
    const link = {
      roomId: 'AAAAAAAAAAAAAAAAAAAAAA',
      joinSecret: 'jjjjjjjjjjjjjjjjjjjjjj',
      adminSecret: null,
      contentKey: null,
    };
    const conn = new RoomConnection({
      link,
      transport: srv.factory,
      session: new RoomSessionStore(memoryStore(), link.roomId),
      timers,
      random: () => 1,
      maxInitialAttempts: 3,
      onChange: () => undefined,
    });
    conn.join({ name: 'X', role: 'voter' });
    for (let i = 0; i < 3; i++) {
      srv.sockets.at(-1)?.h.onClose(1006);
      timers.advance(60_000);
    }
    expect(conn.snapshot).toMatchObject({ status: 'ended', ended: 'unreachable' });
    conn.retry();
    expect(conn.snapshot.status).toBe('connecting');
  });

  it('maps close codes to reasons when no closed message arrived', () => {
    const timers = new FakeTimers();
    const srv = fakeServer();
    const link = {
      roomId: 'AAAAAAAAAAAAAAAAAAAAAA',
      joinSecret: 'jjjjjjjjjjjjjjjjjjjjjj',
      adminSecret: null,
      contentKey: null,
    };
    const conn = new RoomConnection({
      link,
      transport: srv.factory,
      session: new RoomSessionStore(memoryStore(), link.roomId),
      timers,
      onChange: () => undefined,
    });
    conn.join({ name: 'X', role: 'voter' });
    srv.sockets[0]?.h.onClose(4001);
    expect(conn.snapshot).toMatchObject({ status: 'ended', ended: 'expired' });
  });

  it('ignores malformed server frames', () => {
    const srv = fakeServer();
    const link = {
      roomId: 'AAAAAAAAAAAAAAAAAAAAAA',
      joinSecret: 'jjjjjjjjjjjjjjjjjjjjjj',
      adminSecret: null,
      contentKey: null,
    };
    const conn = new RoomConnection({
      link,
      transport: srv.factory,
      session: new RoomSessionStore(memoryStore(), link.roomId),
      timers: new FakeTimers(),
      onChange: () => undefined,
    });
    conn.join({ name: 'X', role: 'voter' });
    srv.sockets[0]?.h.onMessage('not json');
    srv.sockets[0]?.h.onMessage(srv.welcome('x')); // room: null is invalid
    expect(conn.snapshot.status).toBe('connecting');
  });
});
