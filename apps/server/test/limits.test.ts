import { afterEach, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { Client, createRoom, sleep, start } from './helpers.ts';

let server: RunningServer;

afterEach(async () => {
  await server?.close();
});

const refused = (p: Promise<unknown>, status: number) =>
  expect(p).rejects.toThrow(`unexpected-response ${status}`);

async function waitFor(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) await sleep(20);
  expect(cond()).toBe(true);
}

describe('WebSocket connection limits (SEC-004)', () => {
  it('caps concurrent connections per client and frees slots on close', async () => {
    server = await start({ MAX_CONNECTIONS_PER_CLIENT: '3' });
    const room = await createRoom(server);
    const open = await Promise.all([1, 2, 3].map(() => Client.open(server, room.roomId)));
    await refused(Client.open(server, room.roomId), 429);
    await refused(Client.open(server, 'unknownRoomId12345678'), 429);
    open[0]?.close();
    await waitFor(() => server.connections === 2);
    (await Client.open(server, room.roomId)).close();
  });

  it('caps connections globally', async () => {
    server = await start({ MAX_CONNECTIONS: '2' });
    const room = await createRoom(server);
    await Client.open(server, room.roomId);
    await Client.open(server, 'unknownRoomId12345678');
    await refused(Client.open(server, room.roomId), 503);
    expect(server.connections).toBe(2);
  });

  it('rate-limits upgrades per client', async () => {
    server = await start({ WS_UPGRADES_PER_MIN: '3' });
    for (let i = 0; i < 3; i++) (await Client.open(server, `unknownRoomId1234567${i}`)).close();
    await refused(Client.open(server, 'unknownRoomId12345679'), 429);
  });

  it('gives each unknown room id an unstored decoy that goes with its last socket', async () => {
    server = await start({ DATA_DIR: '' });
    const clients = await Promise.all(
      Array.from({ length: 20 }, (_, i) => Client.open(server, `probe${i}abcdefghijklmnop`)),
    );
    expect(server.registry.size).toBe(0);
    expect(server.store.persistent).toBe(false);
    expect(server.registry.decoyCount).toBe(20);
    expect(server.registry.route('probe0abcdefghijklmnop').connectionCount).toBe(1);
    for (const c of clients) c.close();
    await waitFor(() => server.registry.decoyCount === 0);
  });
});
