/**
 * Abuse test: one client opens many sockets into one room and sends far faster than the
 * per-connection limit allows. Run it next to load.ts to check that other rooms keep their
 * latency while the abuser is rate-limited and disconnected.
 *
 *   node src/flood.ts --url http://localhost:8080 --sockets 200 --rate 500 --seconds 30
 */
import { parseArgs } from 'node:util';
import { hashSecret, presetScale, randomToken } from '@backlogfit/core';
import WebSocket from 'ws';
import { wsUrl } from './stats.ts';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:8080' },
    sockets: { type: 'string', default: '200' },
    rate: { type: 'string', default: '500' },
    seconds: { type: 'string', default: '30' },
  },
  strict: true,
});
const url = new URL(values.url).origin;
const sockets = Number(values.sockets);
const rate = Number(values.rate);
const seconds = Number(values.seconds);
for (const [k, v] of Object.entries({ sockets, rate, seconds })) {
  if (!Number.isInteger(v) || v < 1) throw new Error(`--${k} must be a positive integer`);
}

const count = { sent: 0, pong: 0, rateLimited: 0, otherErrors: 0, refused: 0 };
const closes = new Map<number, number>();

const join = randomToken();
const res = await fetch(new URL('/api/rooms', url), {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: url },
  body: JSON.stringify({
    v: 1,
    config: { scale: presetScale('fibonacci'), maxParticipants: 500 },
    joinHash: await hashSecret(join),
    adminHash: await hashSecret(randomToken()),
    lifetimeHours: 1,
  }),
});
if (res.status !== 201) throw new Error(`POST /api/rooms → ${res.status}`);
const { roomId } = (await res.json()) as { roomId: string };

const endAt = Date.now() + seconds * 1000;
const done: Promise<void>[] = [];

for (let i = 0; i < sockets; i++) {
  done.push(
    new Promise<void>((resolve) => {
      const ws = new WebSocket(wsUrl(url, roomId), { origin: url });
      let timer: NodeJS.Timeout | undefined;
      ws.on('unexpected-response', (_req, r) => {
        count.refused++;
        r.resume();
        resolve();
      });
      ws.on('error', () => resolve());
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'hello',
            v: 1,
            joinSecret: join,
            name: `Flood ${i}`,
            role: 'voter',
          }),
        );
        const burst = Math.max(1, Math.round(rate / 100));
        timer = setInterval(() => {
          if (Date.now() > endAt || ws.readyState !== WebSocket.OPEN) {
            clearInterval(timer);
            ws.close();
            return;
          }
          for (let b = 0; b < burst; b++) {
            ws.send('{"type":"ping"}');
            count.sent++;
          }
        }, 10);
      });
      ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw)) as { type: string; code?: string };
        if (msg.type === 'pong') count.pong++;
        else if (msg.type === 'error' && msg.code === 'rate_limited') count.rateLimited++;
        else if (msg.type === 'error') count.otherErrors++;
      });
      ws.on('close', (code) => {
        clearInterval(timer);
        closes.set(code, (closes.get(code) ?? 0) + 1);
        resolve();
      });
    }),
  );
}

await Promise.all(done);
const accepted = count.pong;
console.log(`Backlogfit flood: ${sockets} sockets × ${rate} msg/s for ${seconds} s → ${url}`);
console.log(
  `sent ${count.sent}, answered ${accepted} (${((accepted / Math.max(count.sent, 1)) * 100).toFixed(2)}%)`,
);
console.log(
  `rate_limited ${count.rateLimited}, other errors ${count.otherErrors}, refused at upgrade ${count.refused}`,
);
console.log(`close codes ${JSON.stringify(Object.fromEntries(closes))}`);
