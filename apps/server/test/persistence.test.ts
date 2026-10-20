import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RoomState } from '@backlogfit/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunningServer } from '../src/app.ts';
import { DB_FILE } from '../src/store.ts';
import { Client, createRoom, join as joinRoom, ORIGIN, start, tempDir } from './helpers.ts';

let server: RunningServer | undefined;
let dir: ReturnType<typeof tempDir>;

beforeEach(() => {
  dir = tempDir();
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  dir.cleanup();
});

function rows(): { id: string; state: string }[] {
  const db = new DatabaseSync(join(dir.path, DB_FILE), { readOnly: true });
  try {
    return db.prepare('SELECT id, state FROM rooms').all() as { id: string; state: string }[];
  } finally {
    db.close();
  }
}

function dbBytes(): string {
  let all = '';
  for (const f of [DB_FILE, `${DB_FILE}-wal`]) {
    try {
      all += readFileSync(join(dir.path, f)).toString('latin1');
    } catch {
      // file may not exist
    }
  }
  return all;
}

describe('sqlite persistence', () => {
  it('survives a restart and resumes participants', async () => {
    server = await start({ DATA_DIR: dir.path });
    const room = await createRoom(server);
    const admin = await joinRoom(server, room, 'Ada', { admin: true });
    admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-7 Persist me'] });
    await admin.c.next('state', (m) => m.room.tasks.length === 1);
    expect(rows().map((r) => r.id)).toEqual([room.roomId]);
    // No raw secrets on disk, only hashes.
    const stored = rows()[0]?.state ?? '';
    expect(stored).not.toContain(room.joinSecret);
    expect(stored).not.toContain(room.adminSecret);
    expect(stored).not.toContain(admin.welcome.you.resumeToken as string);
    await server.close();

    server = await start({ DATA_DIR: dir.path });
    const restored = server.registry.get(room.roomId);
    expect(restored).toBeDefined();
    // Connections do not survive a restart: everyone is marked disconnected.
    expect(restored?.state.participants.every((p) => p.conn === null)).toBe(true);

    const again = await joinRoom(server, room, 'Ada', {
      admin: true,
      resumeToken: admin.welcome.you.resumeToken as string,
    });
    expect(again.welcome.you.participantId).toBe(admin.welcome.you.participantId);
    expect(again.welcome.room.tasks.map((t) => t.key)).toEqual(['SCP-7']);
  });

  it('expires overdue rooms on startup and deletes their rows', async () => {
    server = await start({ DATA_DIR: dir.path });
    const room = await createRoom(server);
    await server.close();

    const db = new DatabaseSync(join(dir.path, DB_FILE));
    const state = JSON.parse(
      (db.prepare('SELECT state FROM rooms WHERE id = ?').get(room.roomId) as { state: string })
        .state,
    ) as RoomState;
    state.expiresAt = Date.now() - 1000;
    db.prepare('UPDATE rooms SET state = ? WHERE id = ?').run(JSON.stringify(state), room.roomId);
    db.close();

    server = await start({ DATA_DIR: dir.path });
    expect(server.registry.get(room.roomId)).toBeUndefined();
    expect(rows()).toEqual([]);
  });

  it('drops rows of an unknown state version on load', async () => {
    server = await start({ DATA_DIR: dir.path });
    const room = await createRoom(server);
    await server.close();
    const db = new DatabaseSync(join(dir.path, DB_FILE));
    const row = db.prepare('SELECT state FROM rooms WHERE id = ?').get(room.roomId) as {
      state: string;
    };
    const state = { ...(JSON.parse(row.state) as RoomState), v: 2 };
    db.prepare('UPDATE rooms SET state = ? WHERE id = ?').run(JSON.stringify(state), room.roomId);
    db.prepare('INSERT INTO rooms (id, state) VALUES (?, ?)').run('garbage', '{not json');
    db.close();

    server = await start({ DATA_DIR: dir.path });
    expect(server.registry.size).toBe(0);
    expect(rows()).toEqual([]);
  });

  it('hard expiry closes sockets and wipes storage (accelerated clock)', async () => {
    // 1 h lifetime at x3600 ≈ 1 s of wall time; idle timeout set longer than the lifetime.
    server = await start({
      DATA_DIR: dir.path,
      TEST_TIME_SCALE: '3600',
      IDLE_TIMEOUT_MINUTES: '120',
    });
    const room = await createRoom(server, { lifetimeHours: 1 });
    const admin = await joinRoom(server, room, 'Ada', { admin: true });
    admin.c.send({ type: 'admin.tasks.add', lines: ['SCP-42 Secret task title'] });
    await admin.c.next('state', (m) => m.room.tasks.length === 1);
    const lurker = await Client.open(server, room.roomId);

    expect(await admin.c.next('closed', () => true, 5000)).toEqual({
      type: 'closed',
      reason: 'expired',
    });
    expect((await admin.c.closed).code).toBe(4001);
    // Pre-hello sockets are closed too.
    expect(await lurker.next('closed')).toEqual({ type: 'closed', reason: 'expired' });
    expect(server.registry.get(room.roomId)).toBeUndefined();
    expect(rows()).toEqual([]);
    expect(dbBytes()).not.toContain('Secret task title');
  });

  it('idle timeout closes the room', async () => {
    server = await start({ TEST_TIME_SCALE: '120', IDLE_TIMEOUT_MINUTES: '1' });
    const room = await createRoom(server);
    const admin = await joinRoom(server, room, 'Ada', { admin: true });
    expect(await admin.c.next('closed', () => true, 5000)).toEqual({
      type: 'closed',
      reason: 'idle',
    });
    expect((await admin.c.closed).code).toBe(4002);
  });

  it('ignores TEST_TIME_SCALE outside NODE_ENV=test', async () => {
    const { readConfig } = await import('../src/config.ts');
    expect(
      readConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: ORIGIN, TEST_TIME_SCALE: '60' })
        .timeScale,
    ).toBe(1);
    expect(readConfig({ TEST_TIME_SCALE: '60' }).timeScale).toBe(1);
    expect(readConfig({ NODE_ENV: 'test', TEST_TIME_SCALE: '60' }).timeScale).toBe(60);
  });
});
