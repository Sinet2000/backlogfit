import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { RoomState } from '@backlogfit/core';

export const DB_FILE = 'backlogfit.sqlite';

/**
 * One row per room holding the reducer's RoomState as JSON (ADR-0004). Deleted rows are
 * overwritten (secure_delete) and the WAL is truncated so ended rooms leave nothing on disk.
 */
export class RoomStore {
  readonly #db: DatabaseSync;
  readonly #put: StatementSync;
  readonly #del: StatementSync;
  readonly #all: StatementSync;
  readonly persistent: boolean;

  constructor(dataDir: string | null) {
    this.persistent = dataDir !== null;
    let path = ':memory:';
    if (dataDir !== null) {
      mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      path = join(dataDir, DB_FILE);
    }
    this.#db = new DatabaseSync(path);
    if (this.persistent) this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec(`
      PRAGMA synchronous = NORMAL;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY NOT NULL,
        state TEXT NOT NULL
      ) STRICT;
    `);
    this.#put = this.#db.prepare(
      'INSERT INTO rooms (id, state) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state',
    );
    this.#del = this.#db.prepare('DELETE FROM rooms WHERE id = ?');
    this.#all = this.#db.prepare('SELECT id, state FROM rooms');
  }

  put(state: RoomState): void {
    this.#put.run(state.roomId, JSON.stringify(state));
  }

  delete(roomId: string): void {
    this.#del.run(roomId);
    if (this.persistent) this.#db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }

  /** All stored rooms. Rows that fail to parse are dropped (and deleted). */
  loadAll(): RoomState[] {
    const out: RoomState[] = [];
    for (const row of this.#all.all() as { id: string; state: string }[]) {
      try {
        const state = JSON.parse(row.state) as RoomState;
        if (state.v === 1 && state.roomId === row.id) {
          out.push(state);
          continue;
        }
      } catch {
        // fall through: unreadable row
      }
      this.delete(row.id);
    }
    return out;
  }

  close(): void {
    if (this.#db.isOpen) this.#db.close();
  }
}
