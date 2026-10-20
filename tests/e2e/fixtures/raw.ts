/**
 * Raw protocol clients that live inside a real page (so the browser sets a genuine Origin and the
 * CSP applies). Used by the protocol specs to exercise server behaviour the UI never triggers.
 */
import type { Page } from '@playwright/test';

export interface RawFrame {
  type?: string;
  code?: string;
  reason?: string;
  [k: string]: unknown;
}

interface Slot {
  frames: string[];
  close: { code: number; reason: string } | null;
  open: boolean;
}

declare global {
  interface Window {
    __bfRaw?: Record<string, { ws: WebSocket; slot: Slot }>;
  }
}

let counter = 0;

export class RawClient {
  readonly key: string;
  private readonly page: Page;

  private constructor(page: Page, key: string) {
    this.page = page;
    this.key = key;
  }

  static async open(page: Page, roomId: string): Promise<RawClient> {
    const key = `c${++counter}`;
    await page.evaluate(
      ({ key, roomId }) => {
        window.__bfRaw ??= {};
        const url = new URL(`/ws/${roomId}`, location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(url);
        const slot = { frames: [] as string[], close: null as Slot['close'], open: false };
        ws.onopen = () => {
          slot.open = true;
        };
        ws.onmessage = (e) => slot.frames.push(String(e.data));
        ws.onclose = (e) => {
          slot.close = { code: e.code, reason: e.reason };
        };
        window.__bfRaw[key] = { ws, slot };
        return new Promise<void>((resolve) => {
          ws.addEventListener('open', () => resolve());
          ws.addEventListener('close', () => resolve());
        });
      },
      { key, roomId },
    );
    return new RawClient(page, key);
  }

  send(msg: unknown): Promise<void> {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    return this.page.evaluate(
      ({ key, data }) => {
        window.__bfRaw?.[key]?.ws.send(data);
      },
      { key: this.key, data },
    );
  }

  async frames(): Promise<RawFrame[]> {
    const raw = await this.page.evaluate(
      (key) => window.__bfRaw?.[key]?.slot.frames ?? [],
      this.key,
    );
    return raw.map((r) => {
      try {
        return JSON.parse(r) as RawFrame;
      } catch {
        return { type: '__unparseable', raw: r };
      }
    });
  }

  /** Wait for a frame satisfying pred; returns it. */
  async waitFor(pred: (f: RawFrame) => boolean, timeoutMs = 5_000): Promise<RawFrame> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hit = (await this.frames()).find(pred);
      if (hit) return hit;
      await this.page.waitForTimeout(25);
    }
    throw new Error(`no matching frame; got ${JSON.stringify(await this.frames()).slice(0, 600)}`);
  }

  waitType(type: string, timeoutMs?: number): Promise<RawFrame> {
    return this.waitFor((f) => f.type === type, timeoutMs);
  }

  async waitClose(timeoutMs = 5_000): Promise<{ code: number; reason: string }> {
    const handle = await this.page.waitForFunction(
      (key) => window.__bfRaw?.[key]?.slot.close ?? null,
      this.key,
      { timeout: timeoutMs },
    );
    return (await handle.jsonValue()) as { code: number; reason: string };
  }

  close(): Promise<void> {
    return this.page.evaluate((key) => window.__bfRaw?.[key]?.ws.close(1000), this.key);
  }
}

export function hello(joinSecret: string, name: string, extra: Record<string, unknown> = {}) {
  return { type: 'hello', v: 1, joinSecret, name, role: 'voter', ...extra };
}
