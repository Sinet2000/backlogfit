# ADR-0001: Pure reducer in packages/core; backends are adapters

- Status: Accepted
- Date: 2026-10-20

## Context

Backlogfit runs on two backends (Cloudflare Durable Objects and a self-hosted Node server) and
needs an offline demo plus component tests in the browser. Room rules (roles, lobby, voting,
reveal, lifetime) are where the security and privacy guarantees live. Duplicating them per
backend would let the implementations drift, and testing them through sockets is slow and flaky.

## Decision

All room logic is one pure, deterministic function in `@backlogfit/core`:
`reduce(state, event, ctx) → { state, effects }`, plus `project(state, viewerId) → RoomView`.

- No I/O, no `Date.now()`, no `Math.random()`: time and ids come from `ctx: { now, randomId }`.
- Inputs are never mutated (the reducer works on a `structuredClone` draft); unchanged or
  rejected events return the original state object, so adapters can skip persistence.
- Side effects are data: `send`, `broadcastState`, `close`, `scheduleAlarm`, `deleteAll`.
  `expandEffects()` turns them into per-socket frames so adapters stay a few dozen lines.
- State is plain JSON (arrays and records, no Maps/classes) so it can be stored as-is.
- The package ships TypeScript source (erasable syntax only) consumed directly by Vite, wrangler
  and Node 24 type stripping; no build step.
- `LoopbackEngine` is the reference adapter, used by the frontend and as a model for backends.

## Consequences

- Fast-check can drive thousands of random event sequences through the real logic and check
  invariants (vote secrecy, authorization, lifetime cap, determinism).
- Backends cannot "fix" behavior locally; protocol changes go through core and its tests.
- Async work (WebCrypto hashing) must happen before `reduce` (see ADR-0005).
- Whole-state cloning per event is O(state); fine for rooms of ≤ 50 people and ≤ 500 tasks.
