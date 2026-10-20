# ADR-0004: Node uses built-in node:sqlite; Worker uses Durable Object SQLite storage

- Status: Accepted
- Date: 2026-10-20

## Context

Room state must survive process restarts (Node) and Durable Object hibernation/eviction
(Workers) for the room's short lifetime, then be deleted completely. Native addons
(`better-sqlite3`) complicate distroless/read-only containers and add supply-chain surface.

## Decision

- Node: built-in `node:sqlite` in `DATA_DIR` (or `:memory:` when unset). One row per room
  holding the JSON-serialized `RoomState`; delete + `VACUUM` on close.
- Workers: Durable Object SQLite-backed storage, one object per room, `ctx.storage.deleteAll()`
  plus alarm deletion on close.
- The persisted value is exactly the reducer's `RoomState` (plain JSON, see ADR-0001). Adapters
  persist only when `reduce` returns a new object, and never after a `deleteAll` effect.

## Consequences

- Zero native dependencies; the same state shape on both platforms.
- `node:sqlite` is not yet marked stable (release-candidate stability in Node 24); we pin Node 24 and keep usage to
  a tiny surface (one table, prepared statements).
- No migrations: rooms live ≤ 24 h, so a state-shape change is handled by `v` in `RoomState`
  and closing incompatible rooms.
