# ADR-0007: Rate limiting with in-memory token buckets, no persisted IPs

- Status: Accepted
- Date: 2026-10-20

## Context

Two things need throttling: room creation (`POST /api/rooms`) and WebSocket message floods
inside a room. The privacy promise is that the service keeps no personal data beyond the room's
lifetime, and IP addresses are personal data in most jurisdictions. Persistent counters (a
database table, KV, logs) would contradict that promise and add a storage dependency.

## Decision

- Use the token bucket from `packages/security` (`createRateLimiter`): `take(key, now, cost)`,
  bounded key count with oldest-first eviction, state held in a `Map` only.
- **Per connection** (key = connection id): `RATE_MSGS_PER_SEC` refill, `RATE_BURST` capacity.
  Excess frames get `error{rate_limited}`; sustained abuse (or repeated invalid frames) closes
  with 1008. Lives in the room actor (Durable Object or Node room), so it disappears with it.
- **Per room**: a second bucket keyed by room bounds total fan-out work (each accepted message
  can trigger a broadcast to up to 50 sockets).
- **Room creation**: `ROOM_CREATE_PER_MIN` per client address, kept in memory only. On Node the
  address comes from the socket, or from `X-Forwarded-For` only when `TRUST_PROXY=true`. On
  Workers the Cloudflare rate-limiting binding is used (keyed in memory at the edge); no
  address is written to storage or logs. `MAX_ROOMS` caps concurrent rooms on Node.
- Limits are read from env (`readLimits`), the same names on both backends.
- No IP, user agent or connection metadata is ever written to room storage or logs. Reducer
  state contains no transport metadata (ADR-0001).

## Consequences

- Restarting a Node process or evicting a Worker isolate resets the counters. This is accepted:
  the goal is to blunt floods and brute force, not to enforce quotas.
- Limits are per instance; a horizontally scaled self-hosted deployment multiplies them.
  Operators who need global limits put a reverse proxy in front (documented in SELF_HOSTING).
- Brute force of room secrets is not what rate limiting protects against (128-bit secrets);
  passcode guessing is bounded room-wide by the reducer (`PASSCODE_MAX_ATTEMPTS`).
