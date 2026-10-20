# ADR-0011: One transport-agnostic room host for both backends

- Status: Accepted
- Date: 2026-10-20

## Context

ADR-0001 keeps room rules in a pure reducer, but everything around it was written twice: the
Node room actor (`apps/server/src/rooms.ts`) and the Durable Object (`apps/worker/src/room-do.ts`)
each had their own frame checks, rate limits, strikes, serial queue, hello authentication,
effect expansion, decoy rooms, reconcile after restart and alarm handling. Review found that
the copies had drifted:

- the Worker closed the oldest pending sockets per room; Node did not;
- the Worker sent close reasons; Node sent none;
- the Worker swallowed queue errors silently, and its alarm logic ignored `scheduleAlarm`
  effects while Node used them;
- Node served every unknown room id from one shared decoy, so rate limits on one unknown id
  could be observed through another, and decoys could answer `closed{expired}` when the idle
  timeout was longer than the decoy's lifetime;
- the Worker parsed timeouts leniently while Node refused bad values, and the two validated
  stored rows differently;
- neither backend closed half-open sockets of joined participants (no pong deadline), and the
  Worker had no heartbeat at all.

## Decision

A new package, `@backlogfit/host` (`packages/host`, TypeScript source like the other packages),
holds one `RoomHost` class per room. It owns the receive pipeline (size cap, per-connection and
per-room buckets, strikes, parse), the serial queue, `toEvent` and `reduce` against the current
state, effect expansion, storage calls, the room alarm, the hello deadline, the dead-socket
deadline and the pending-socket limit. Decoys are `RoomHost.decoy(roomId)` instances without a
storage port; they renew their state well before any deadline.

Adapters implement small ports: `HostSocket` (send, close, optional remember), `RoomStorage`
(save, wipe), `Wakeup` (one wake-up per room), `HostClock` (wall time and room time) and a
CSPRNG `randomId`. Node uses `ws`, `node:sqlite` and `setTimeout`. The Durable Object uses
Hibernation sockets with the connection info in the attachment, one SQLite row, the storage
alarm for real rooms, and an in-memory timer for decoys so that probes never write storage.

Both backends read the same limits with `readLimits` and turn them into host options with
`hostOptions`. A shared contract suite (`@backlogfit/host/contract`) runs the same scenarios
against fake ports, the Node server and the Worker.

Liveness is one rule for both: every inbound frame counts, and a joined socket silent for
`SOCKET_TIMEOUT_SECONDS` is closed with 1001 and shown as disconnected. Node keeps its
protocol-level ping as an extra transport check; Hibernation cannot send protocol pings.
`MAX_ROOMS` and the connection caps stay Node-only: a Durable Object holds one room, and the
Worker bounds upgrades with a rate-limit binding.

`LoopbackEngine` in core stays as it is. It must stay dependency-free for the browser demo, and
it has no sockets, rate limits or timers to share.

## Consequences

- `rooms.ts` and `room-do.ts` become thin adapters; behaviour changes land once, in one place.
- Node now has a decoy per unknown id. Memory is bounded by the connection caps, and a decoy is
  dropped with its last socket.
- The host arms the earliest of all deadlines, so a Durable Object with connected sockets gets
  an alarm about once per socket timeout. Clients already wake it with pings every 25 s.
- The protocol gains an optional `leave` message and the `left` close reason (4007), and `ping`
  works in the lobby, so waiting participants keep their socket alive.
