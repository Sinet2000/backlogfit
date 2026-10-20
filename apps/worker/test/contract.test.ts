import { roomContract, type WireHarness } from '@backlogfit/host/contract';
import { describe, expect, it } from 'vitest';
import { Client, createRoom } from './helpers.ts';

const harness: WireHarness = {
  createRoom: (opts = {}) => createRoom(opts.lobby ?? false),
  async open(roomId) {
    const c = await Client.open(roomId);
    return {
      frames: c.frames,
      messages: c.messages,
      closed: c.closed,
      send: (msg) => c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
      next: (type, pred) => c.next(type, pred),
      close: () => c.ws.close(),
    };
  },
  elapse: (ms) => new Promise((r) => setTimeout(r, ms)),
};

roomContract('worker', { describe, it, expect }, () => harness);
