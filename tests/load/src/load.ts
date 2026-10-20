/**
 * Backlogfit WebSocket load test: N rooms × M clients running full voting rounds
 * (next → everyone votes → reveal). Reports connect time (socket open → welcome), broadcast
 * latency (admin action → each client sees the resulting state), vote round-trip, and errors.
 *
 *   node src/load.ts --url http://localhost:8080 --rooms 20 --clients 20 --rounds 3
 *
 * The server's per-address limits must be raised when all clients come from one machine:
 * ROOM_CREATE_PER_MIN (default 10), WS_UPGRADES_PER_MIN (default 120) and
 * MAX_CONNECTIONS_PER_CLIENT (default 50 concurrent sockets), e.g. all 100000.
 */
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { hashSecret, presetScale, randomToken } from '@backlogfit/core';
import WebSocket from 'ws';
import {
  fmtMs,
  type LoadOptions,
  parseOptions,
  type Summary,
  summarize,
  USAGE,
  wsUrl,
} from './stats.ts';

type Msg = Record<string, unknown> & { type?: string };
interface RoomLike {
  phase?: string;
  currentTaskId?: string | null;
  round?: number | null;
  myVote?: string | null;
  tasks?: {
    id: string;
    rounds: { n: number; revealed: boolean; voteCount: number; votes: unknown }[];
  }[];
  config?: { scale: { value: string; kind: string }[] };
}

const metrics = {
  connect: [] as number[],
  broadcastNext: [] as number[],
  broadcastReveal: [] as number[],
  voteAck: [] as number[],
  errors: new Map<string, number>(),
  privacyViolations: 0,
  roomsCompleted: 0,
};

function countError(key: string): void {
  metrics.errors.set(key, (metrics.errors.get(key) ?? 0) + 1);
}

/** Every client ever created, so nothing is left open when a room fails half-way. */
const allClients = new Set<Client>();

class Client {
  readonly ws: WebSocket;
  readonly log: { at: number; msg: Msg }[] = [];
  private waiters: { from: number; pred: (m: Msg) => boolean; resolve: (at: number) => void }[] =
    [];
  closedUnexpectedly = false;
  done = false;
  ownVotes = new Set<string>();

  constructor(url: string, origin: string) {
    this.ws = new WebSocket(url, { headers: { origin }, perMessageDeflate: false });
    allClients.add(this);
    this.ws.on('message', (data, isBinary) => {
      if (isBinary) return countError('binary_frame');
      let msg: Msg;
      try {
        msg = JSON.parse(data.toString()) as Msg;
      } catch {
        return countError('bad_json_from_server');
      }
      const at = performance.now();
      const idx = this.log.push({ at, msg }) - 1;
      if (msg.type === 'error') countError(`error:${String(msg.code)}`);
      if (msg.type === 'closed' && !this.done) countError(`closed:${String(msg.reason)}`);
      this.checkPrivacy(msg);
      this.waiters = this.waiters.filter((w) => {
        if (idx >= w.from && w.pred(msg)) {
          w.resolve(at);
          return false;
        }
        return true;
      });
    });
    this.ws.on('close', () => {
      if (!this.done) this.closedUnexpectedly = true;
    });
    this.ws.on('error', (e) =>
      countError(`socket:${(e as NodeJS.ErrnoException).code ?? e.message}`),
    );
  }

  private checkPrivacy(msg: Msg): void {
    if (msg.type !== 'state' && msg.type !== 'welcome') return;
    const room = msg.room as RoomLike | undefined;
    for (const t of room?.tasks ?? []) {
      for (const r of t.rounds) if (!r.revealed && r.votes !== null) metrics.privacyViolations++;
    }
    if (room?.myVote && !this.ownVotes.has(room.myVote)) metrics.privacyViolations++;
  }

  mark(): number {
    return this.log.length;
  }

  /** Resolve with the receive time of the first message at index ≥ from matching pred. */
  waitFor(
    pred: (m: Msg) => boolean,
    from: number,
    timeoutMs: number,
    what: string,
  ): Promise<number> {
    for (let i = from; i < this.log.length; i++) {
      const e = this.log[i];
      if (e && pred(e.msg)) return Promise.resolve(e.at);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        countError(`timeout:${what}`);
        reject(new Error(`timeout waiting for ${what}`));
      }, timeoutMs);
      this.waiters.push({
        from,
        pred,
        resolve: (at) => {
          clearTimeout(timer);
          resolve(at);
        },
      });
    });
  }

  send(msg: Msg): void {
    if (msg.type === 'vote' && typeof msg.value === 'string') this.ownVotes.add(msg.value);
    this.ws.send(JSON.stringify(msg));
  }

  lastRoom(): RoomLike | null {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const m = this.log[i]?.msg;
      if (m && (m.type === 'state' || m.type === 'welcome')) return m.room as RoomLike;
    }
    return null;
  }

  close(): void {
    this.done = true;
    if (this.ws.readyState === WebSocket.CONNECTING) this.ws.terminate();
    else this.ws.close(1000);
  }
}

const roomOf = (m: Msg): RoomLike | null =>
  m.type === 'state' || m.type === 'welcome' ? (m.room as RoomLike) : null;

async function createRoom(
  opts: LoadOptions,
): Promise<{ roomId: string; join: string; admin: string }> {
  const join = randomToken();
  const admin = randomToken();
  const res = await fetch(new URL('/api/rooms', opts.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: opts.origin },
    body: JSON.stringify({
      v: 1,
      config: {
        scale: presetScale('fibonacci'),
        autoReveal: false,
        maxParticipants: Math.max(opts.clients, 2),
      },
      joinHash: await hashSecret(join),
      adminHash: await hashSecret(admin),
      lifetimeHours: 1,
    }),
  });
  if (res.status !== 201) {
    countError(`create:${res.status}`);
    throw new Error(`POST /api/rooms → ${res.status} ${await res.text()}`);
  }
  const { roomId } = (await res.json()) as { roomId: string };
  return { roomId, join, admin };
}

async function connect(
  opts: LoadOptions,
  roomId: string,
  joinSecret: string,
  name: string,
  adminSecret?: string,
): Promise<Client> {
  const t0 = performance.now();
  const c = new Client(wsUrl(opts.url, roomId), opts.origin);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), opts.timeoutMs);
    let settled = false;
    const fail = (why: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      countError(`connect:${why}`);
      reject(new Error(`connect failed: ${why}`));
    };
    c.ws.once('open', () => {
      settled = true;
      clearTimeout(timer);
      resolve();
    });
    c.ws.once('unexpected-response', (_req, res) => {
      res.resume();
      fail(`http_${res.statusCode ?? 0}`);
    });
    c.ws.once('error', (e) => fail(e.message.slice(0, 40)));
    c.ws.once('close', (code) => fail(`close_${code}`));
  });
  const hello: Msg = { type: 'hello', v: 1, joinSecret, name, role: 'voter' };
  if (adminSecret) hello.adminSecret = adminSecret;
  c.send(hello);
  const at = await c.waitFor((m) => m.type === 'welcome', 0, opts.timeoutMs, 'welcome');
  metrics.connect.push(at - t0);
  return c;
}

async function runRoom(opts: LoadOptions, index: number): Promise<void> {
  if (opts.rampMs > 0) await new Promise((r) => setTimeout(r, (opts.rampMs * index) / opts.rooms));
  let created: Awaited<ReturnType<typeof createRoom>>;
  try {
    created = await createRoom(opts);
  } catch {
    return; // counted as create:<status>
  }
  const { roomId, join, admin } = created;
  const clients: Client[] = [];
  try {
    clients.push(await connect(opts, roomId, join, 'Admin', admin));
    const others = await Promise.all(
      Array.from({ length: opts.clients - 1 }, (_, i) =>
        connect(opts, roomId, join, `Voter ${i + 1}`),
      ),
    );
    clients.push(...others);
    const [adminClient] = clients;
    if (!adminClient) return;
    const scale = (adminClient.lastRoom()?.config?.scale ?? [])
      .filter((c) => c.kind !== 'special')
      .map((c) => c.value);

    const mark = adminClient.mark();
    adminClient.send({
      type: 'admin.tasks.add',
      lines: Array.from({ length: opts.rounds }, (_, i) => `LOAD-${i + 1}`),
    });
    await adminClient.waitFor(
      (m) => (roomOf(m)?.tasks?.length ?? 0) >= opts.rounds,
      mark,
      opts.timeoutMs,
      'tasks',
    );

    for (let r = 0; r < opts.rounds; r++) {
      // next → every client sees the new current task in voting phase.
      const prev = adminClient.lastRoom()?.currentTaskId ?? null;
      const marks = clients.map((c) => c.mark());
      const t0 = performance.now();
      adminClient.send({ type: 'admin.next' });
      const seen = await Promise.all(
        clients.map((c, i) =>
          c.waitFor(
            (m) => {
              const room = roomOf(m);
              return room?.phase === 'voting' && room.currentTaskId !== prev;
            },
            marks[i] ?? 0,
            opts.timeoutMs,
            'next',
          ),
        ),
      );
      for (const at of seen) metrics.broadcastNext.push(at - t0);

      const room = adminClient.lastRoom();
      const taskId = room?.currentTaskId ?? '';
      const round = room?.round ?? 1;
      // Everyone votes; measure the round-trip to the voter's own state.
      await Promise.all(
        clients.map(async (c) => {
          const value = scale[Math.floor(Math.random() * scale.length)] ?? '1';
          const m = c.mark();
          const s = performance.now();
          c.send({ type: 'vote', taskId, round, value });
          const at = await c.waitFor((x) => roomOf(x)?.myVote === value, m, opts.timeoutMs, 'vote');
          metrics.voteAck.push(at - s);
        }),
      );
      await adminClient.waitFor(
        (m) => {
          const t = roomOf(m)?.tasks?.find((x) => x.id === taskId);
          return (t?.rounds.find((x) => x.n === round)?.voteCount ?? 0) >= clients.length;
        },
        0,
        opts.timeoutMs,
        'all-voted',
      );

      const rmarks = clients.map((c) => c.mark());
      const t1 = performance.now();
      adminClient.send({ type: 'admin.reveal' });
      const revealed = await Promise.all(
        clients.map((c, i) =>
          c.waitFor(
            (m) => roomOf(m)?.phase === 'revealed',
            rmarks[i] ?? 0,
            opts.timeoutMs,
            'reveal',
          ),
        ),
      );
      for (const at of revealed) metrics.broadcastReveal.push(at - t1);
    }
    metrics.roomsCompleted++;
  } catch (e) {
    countError(`room:${(e as Error).message.slice(0, 60)}`);
  } finally {
    for (const c of clients) {
      if (c.closedUnexpectedly) countError('unexpected_close');
      c.close();
    }
  }
}

function row(name: string, s: Summary): string {
  return `${name.padEnd(22)} n=${String(s.n).padStart(6)}  p50 ${fmtMs(s.p50).padStart(10)}  p95 ${fmtMs(s.p95).padStart(10)}  p99 ${fmtMs(s.p99).padStart(10)}  max ${fmtMs(s.max).padStart(10)}`;
}

async function main(): Promise<void> {
  const parsed = parseOptions(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(USAGE);
    return;
  }
  const opts = parsed;
  console.log(
    `Backlogfit load: ${opts.rooms} rooms × ${opts.clients} clients × ${opts.rounds} rounds → ${opts.url}`,
  );
  const started = performance.now();
  await Promise.all(Array.from({ length: opts.rooms }, (_, i) => runRoom(opts, i)));
  const elapsed = performance.now() - started;

  const report = {
    target: opts.url,
    rooms: opts.rooms,
    clientsPerRoom: opts.clients,
    rounds: opts.rounds,
    durationMs: Math.round(elapsed),
    roomsCompleted: metrics.roomsCompleted,
    connect: summarize(metrics.connect),
    broadcastNext: summarize(metrics.broadcastNext),
    broadcastReveal: summarize(metrics.broadcastReveal),
    broadcastAll: summarize([...metrics.broadcastNext, ...metrics.broadcastReveal]),
    voteAck: summarize(metrics.voteAck),
    privacyViolations: metrics.privacyViolations,
    errors: Object.fromEntries(metrics.errors),
  };
  console.log(row('connect (open→welcome)', report.connect));
  console.log(row('broadcast next', report.broadcastNext));
  console.log(row('broadcast reveal', report.broadcastReveal));
  console.log(row('broadcast (all)', report.broadcastAll));
  console.log(row('vote round-trip', report.voteAck));
  console.log(
    `rooms completed ${report.roomsCompleted}/${opts.rooms} in ${(elapsed / 1000).toFixed(1)} s; privacy violations ${report.privacyViolations}`,
  );
  console.log(`errors: ${metrics.errors.size === 0 ? 'none' : JSON.stringify(report.errors)}`);
  if (opts.json) await writeFile(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  if (
    metrics.errors.size > 0 ||
    report.privacyViolations > 0 ||
    report.roomsCompleted < opts.rooms
  ) {
    process.exitCode = 1;
  }
}

await main();
for (const c of allClients) if (!c.done) c.close();
// Pending per-step timers must not keep the process alive after the report.
process.exit();
