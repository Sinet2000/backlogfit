/**
 * End-to-end smoke check against a running server (Node or Worker):
 *   node scripts/smoke.ts [baseUrl] [origin]
 * Creates a room, joins an admin and a voter, votes, reveals, sets a final estimate and closes
 * the room. Exits non-zero on the first failure.
 */
import {
  type ClientMessageInput,
  hashSecret,
  parseServerMessage,
  presetScale,
  randomToken,
  type ServerMessage,
} from '@backlogfit/core';
import { WebSocket } from 'ws';

const baseUrl = new URL(process.argv[2] ?? 'http://localhost:8080');
const origin = process.argv[3] ?? baseUrl.origin;
const TIMEOUT_MS = 10_000;

function step(msg: string): void {
  console.log(`ok - ${msg}`);
}

function fail(msg: string): never {
  console.error(`not ok - ${msg}`);
  process.exit(1);
}

class Peer {
  readonly ws: WebSocket;
  readonly inbox: ServerMessage[] = [];
  #wake: (() => void) | null = null;
  readonly closed: Promise<number>;

  constructor(roomId: string) {
    const wsUrl = new URL(`/ws/${roomId}`, baseUrl);
    wsUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(wsUrl, { origin });
    this.ws.on('message', (d) => {
      const parsed = parseServerMessage(d.toString());
      if (!parsed.ok) fail('server sent a message that does not match the protocol');
      this.inbox.push(parsed.msg);
      this.#wake?.();
    });
    this.ws.on('unexpected-response', (_q, r) => fail(`upgrade refused: HTTP ${r.statusCode}`));
    this.closed = new Promise((resolve) => this.ws.on('close', (code) => resolve(code)));
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  send(msg: ClientMessageInput): void {
    this.ws.send(JSON.stringify(msg));
  }

  async expect<T extends ServerMessage['type']>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + TIMEOUT_MS;
    for (;;) {
      const i = this.inbox.findIndex(
        (m) => m.type === type && pred(m as Extract<ServerMessage, { type: T }>),
      );
      if (i >= 0) {
        const [m] = this.inbox.splice(0, i + 1).slice(-1);
        return m as Extract<ServerMessage, { type: T }>;
      }
      const left = deadline - Date.now();
      if (left <= 0) fail(`timed out waiting for ${type}`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, left);
        this.#wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
    }
  }
}

const health = await fetch(new URL('/api/health', baseUrl)).catch(() => null);
if (health?.ok) step('GET /api/health');
else console.log('# /api/health not available (expected on the Worker)');

const joinSecret = randomToken();
const adminSecret = randomToken();
const res = await fetch(new URL('/api/rooms', baseUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({
    v: 1,
    config: { scale: presetScale('fibonacci') },
    joinHash: await hashSecret(joinSecret),
    adminHash: await hashSecret(adminSecret),
    lifetimeHours: 1,
  }),
});
if (res.status !== 201) fail(`POST /api/rooms returned ${res.status}`);
const { roomId } = (await res.json()) as { roomId: string };
step('POST /api/rooms');

const admin = new Peer(roomId);
const voter = new Peer(roomId);
await Promise.all([admin.open(), voter.open()]);
admin.send({ type: 'hello', v: 1, joinSecret, adminSecret, name: 'Admin', role: 'voter' });
const aw = await admin.expect('welcome');
if (!aw.you.isAdmin) fail('admin was not recognised');
voter.send({ type: 'hello', v: 1, joinSecret, name: 'Voter', role: 'voter' });
await voter.expect('welcome');
step('two clients joined');

admin.send({ type: 'admin.tasks.add', lines: ['SMOKE-1 Smoke test'] });
const withTask = await admin.expect('state', (m) => m.room.tasks.length === 1);
const taskId = withTask.room.tasks[0]?.id ?? fail('task missing');
admin.send({ type: 'admin.next' });
await voter.expect('state', (m) => m.room.phase === 'voting');
step('task added and voting started');

admin.send({ type: 'vote', taskId, round: 1, value: '8' });
const seen = await voter.expect('state', (m) =>
  m.room.participants.some((p) => p.name === 'Admin' && p.hasVoted),
);
if (seen.room.tasks[0]?.rounds[0]?.votes !== null) fail('vote leaked before reveal');
step('no vote values visible before reveal');

voter.send({ type: 'vote', taskId, round: 1, value: '5' });
const revealed = await admin.expect('state', (m) => m.room.phase === 'revealed');
const values = revealed.room.tasks[0]?.rounds[0]?.votes?.map((v) => v.value).sort();
if (JSON.stringify(values) !== '["5","8"]') fail('revealed votes are wrong');
step('auto-reveal with both votes');

admin.send({ type: 'admin.final', taskId, value: '8' });
await voter.expect('state', (m) => m.room.tasks[0]?.final === '8');
step('final estimate broadcast');

admin.send({ type: 'admin.close' });
await voter.expect('closed', (m) => m.reason === 'closed');
const code = await voter.closed;
if (code !== 4003) fail(`expected close code 4003, got ${code}`);
await admin.closed;
step('room closed (4003)');
console.log('smoke: all checks passed');
process.exit(0);
