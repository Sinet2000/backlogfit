import { afterEach, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { Client, createRoom, join, sleep, start } from './helpers.ts';

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
    // Unknown rooms count against the same budget.
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

  it('serves all unknown room ids from one unstored decoy', async () => {
    server = await start({ DATA_DIR: '' });
    const clients = await Promise.all(
      Array.from({ length: 20 }, (_, i) => Client.open(server, `probe${i}abcdefghijklmnop`)),
    );
    expect(server.registry.size).toBe(0);
    expect(server.store.persistent).toBe(false);
    const a = server.registry.decoy();
    expect(server.registry.decoy()).toBe(a);
    expect(a.connectionCount).toBe(20);
    for (const c of clients) c.close();
  });
});

describe('room capacity and existence (SEC-005)', () => {
  it('pre-hello sockets do not use up room capacity', async () => {
    // The old per-room cap was 2 × MAX_PARTICIPANTS + 20 = 24 sockets.
    server = await start({ MAX_PARTICIPANTS: '2', MAX_CONNECTIONS_PER_CLIENT: '100' });
    const room = await createRoom(server);
    const squatters = await Promise.all(
      Array.from({ length: 30 }, () => Client.open(server, room.roomId)),
    );
    const admin = await join(server, room, 'Ada', { admin: true });
    const bob = await join(server, room, 'Bob');
    expect(bob.welcome.room.participants).toHaveLength(2);
    // Real capacity is still enforced by the reducer on hello.
    const carol = await Client.open(server, room.roomId);
    carol.send({ type: 'hello', v: 1, joinSecret: room.joinSecret, name: 'Carol', role: 'voter' });
    expect(await carol.next('error')).toMatchObject({ type: 'error', code: 'room_full' });
    for (const s of squatters) s.close();
    admin.c.close();
  });

  it('a hello with the wrong secret gets the same frames from real and unknown rooms', async () => {
    server = await start();
    const room = await createRoom(server);
    const hello = { type: 'hello', v: 1, joinSecret: 'B'.repeat(22), name: 'Eve', role: 'voter' };
    const real = await Client.open(server, room.roomId);
    const fake = await Client.open(server, 'unknownRoomId12345678');
    real.send(hello);
    fake.send(hello);
    const [r, f] = await Promise.all([real.closed, fake.closed]);
    expect(f.code).toBe(r.code);
    expect(fake.frames).toEqual(real.frames);
  });
});
