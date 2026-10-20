import type { Page, WebSocket } from '@playwright/test';
import { roomOf } from './privacy.ts';

export interface Wire {
  received: string[];
  sent: string[];
  sockets: WebSocket[];
  ofType(type: string): Record<string, unknown>[];
  lastRoom(): Record<string, unknown> | null;
  waitFor(pred: (frame: Record<string, unknown>) => boolean, timeoutMs?: number): Promise<void>;
}

function parse(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const text = (payload: string | Buffer): string =>
  typeof payload === 'string' ? payload : payload.toString('utf8');

/** Call before the page opens its socket (i.e. before goto). */
export function captureWire(page: Page): Wire {
  const wire: Wire = {
    received: [],
    sent: [],
    sockets: [],
    ofType(type) {
      return wire.received.map(parse).filter((f): f is Record<string, unknown> => f?.type === type);
    },
    lastRoom() {
      for (let i = wire.received.length - 1; i >= 0; i--) {
        const f = parse(wire.received[i] ?? '');
        const room = f ? roomOf(f as never) : null;
        if (room) return room as Record<string, unknown>;
      }
      return null;
    },
    async waitFor(pred, timeoutMs = 10_000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (
          wire.received.some((r) => {
            const f = parse(r);
            return f !== null && pred(f);
          })
        ) {
          return;
        }
        await page.waitForTimeout(50);
      }
      throw new Error('timed out waiting for a matching WebSocket frame');
    },
  };
  page.on('websocket', (ws) => {
    wire.sockets.push(ws);
    ws.on('framereceived', (f) => wire.received.push(text(f.payload)));
    ws.on('framesent', (f) => wire.sent.push(text(f.payload)));
  });
  return wire;
}

/** Values this page itself sent in `vote` messages. */
export function ownVotes(wire: Wire): Set<string> {
  const out = new Set<string>();
  for (const raw of wire.sent) {
    const f = parse(raw);
    if (f?.type === 'vote' && typeof f.value === 'string') out.add(f.value);
  }
  return out;
}
