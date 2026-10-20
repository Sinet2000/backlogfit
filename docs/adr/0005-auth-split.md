# ADR-0005: Authentication split: adapters hash, the reducer decides

- Status: Accepted
- Date: 2026-10-20

## Context

The reducer must stay synchronous and pure (ADR-0001), but checking a `hello` requires SHA-256
of the presented secrets, and WebCrypto `subtle.digest` is async. Letting the reducer receive raw
secrets would also put them into an event log/state path where they do not belong.

## Decision

- Core exports async helpers that adapters call **before** `reduce`:
  `hashSecret`, `hashPasscode`, `ctEqual`, `randomToken`, `secretsOf(state)`,
  `verifyHello(secrets, hello) → HelloAuth`, and the convenience `toEvent(state, conn, msg)`.
- `HelloAuth = { joinOk, adminOk, passcodeOk: boolean|null, resumeParticipantId, resume: { token, hash } }`.
  `verifyHello` always performs every comparison (constant-time, no early exit) and mints the
  next resume token; only its hash enters state, the token goes out in `welcome`/`lobby`.
- The reducer trusts only these booleans and applies all policy itself (lock, lobby, capacity,
  passcode attempt counting, resume semantics). A `hello` without `auth` is rejected.
- The reducer re-validates `resumeParticipantId` against current state, so interleaving between
  the await and `reduce` (possible on Durable Objects) is safe.

## Consequences

- Policy stays in one tested place; crypto stays in a small, separately tested module that is
  the only code in core touching `globalThis.crypto`.
- An adapter that forges `HelloAuth` bypasses authentication. This is inherent (the adapter is
  trusted code) and is called out for security review.
- Raw secrets never reach `RoomState`, effects, or logs produced from them.
