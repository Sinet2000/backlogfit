/**
 * Transport abstraction: the room UI talks to a `Transport` and does not care whether it is a
 * real WebSocket to the server or the in-memory LoopbackEngine (offline demo, tests).
 */
import { closeCodeFor, type LoopbackEngine } from '@backlogfit/core';

export interface TransportHandlers {
  onOpen(): void;
  /** One raw text frame from the server. */
  onMessage(data: string): void;
  /** Socket closed (by either side). `code` is the WebSocket close code (1006 = dropped). */
  onClose(code: number): void;
}

export interface Transport {
  send(data: string): void;
  close(): void;
}

export type TransportFactory = (roomId: string, handlers: TransportHandlers) => Transport;

/** URL of the room socket. Only the roomId (not a secret) appears in the request line. */
export function socketUrl(loc: { protocol: string; host: string }, roomId: string): string {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${loc.host}/ws/${encodeURIComponent(roomId)}`;
}

export const webSocketTransport =
  (loc: { protocol: string; host: string } = globalThis.location): TransportFactory =>
  (roomId, h) => {
    let closed = false;
    const ws = new WebSocket(socketUrl(loc, roomId));
    const finish = (code: number) => {
      if (closed) return;
      closed = true;
      h.onClose(code);
    };
    ws.addEventListener('open', () => h.onOpen());
    ws.addEventListener('message', (e) => {
      if (typeof e.data === 'string') h.onMessage(e.data);
    });
    ws.addEventListener('close', (e) => finish(e.code));
    ws.addEventListener('error', () => finish(1006));
    return {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      },
      close: () => {
        try {
          ws.close(1000);
        } catch {
          // already closing
        }
        finish(1000);
      },
    };
  };

/** In-memory transport over a LoopbackEngine (same parse → reduce → project pipeline). */
export const loopbackTransport =
  (getEngine: (roomId: string) => LoopbackEngine | null): TransportFactory =>
  (roomId, h) => {
    const engine = getEngine(roomId);
    let done = false;
    const finish = (code: number) => {
      if (done) return;
      done = true;
      queueMicrotask(() => h.onClose(code));
    };
    if (!engine || engine.closed) {
      // Behave like the server for an unknown room.
      queueMicrotask(() => {
        h.onOpen();
        h.onMessage(JSON.stringify({ type: 'closed', reason: 'not_found' }));
        finish(closeCodeFor('not_found'));
      });
      return { send: () => undefined, close: () => finish(1000) };
    }
    const client = engine.connect();
    client.onMessage((msg) => {
      if (done) return;
      h.onMessage(JSON.stringify(msg));
      if (msg.type === 'closed') finish(closeCodeFor(msg.reason));
    });
    queueMicrotask(() => h.onOpen());
    return {
      send: (data) => {
        if (!done) void client.send(data);
      },
      close: () => {
        if (done) return;
        void client.disconnect();
        finish(1000);
      },
    };
  };
