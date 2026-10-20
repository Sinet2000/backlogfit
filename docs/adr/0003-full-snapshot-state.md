# ADR-0003: Full-snapshot state messages, not patches

- Status: Accepted
- Date: 2026-10-20

## Context

Clients need to stay in sync through reconnects and hibernation. Patches are smaller but need
sequence tracking, resync logic, and, crucially, a per-viewer diff of *projected* data; a patch
computed from raw state could leak a vote value that the projection would hide.

## Decision

After every state change the server sends each connection `state{ rev, room }`, where `room` is
the full `project(state, viewerId)` output. `rev` increases monotonically per broadcast.
`welcome` carries the same snapshot.

## Consequences

- Privacy is enforced in one place (`project`) and verified by property tests; there is no
  second code path for diffs.
- Clients replace their room model on each message; reconnect needs no special handling.
- Payloads are a few KB for ≤ 50 participants; with 500 tasks and many rounds they grow, which is
  acceptable for the target rooms. Patches can be added later behind a protocol version bump.
