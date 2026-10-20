import { CONTRACT_ENV, roomContract, type WireHarness } from '@backlogfit/host/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { Client, createRoom, sleep, start } from './helpers.ts';

let server: RunningServer;

beforeAll(async () => {
  server = await start({
    ...CONTRACT_ENV,
    MAX_CONNECTIONS_PER_CLIENT: '1000',
    WS_UPGRADES_PER_MIN: '10000',
    ROOM_CREATE_PER_MIN: '100',
  });
});

afterAll(async () => {
  await server.close();
});

const harness: WireHarness = {
  async createRoom(opts = {}) {
    return createRoom(server, { config: { lobby: opts.lobby ?? false, teams: opts.teams ?? [] } });
  },
  async open(roomId) {
    const c = await Client.open(server, roomId);
    return {
      frames: c.frames,
      messages: c.messages,
      closed: c.closed.then((e) => e.code),
      send: (msg) => c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
      next: (type, pred) => c.next(type, pred),
      close: () => c.close(),
    };
  },
  elapse: sleep,
};

roomContract('node server', { describe, it, expect }, () => harness);
