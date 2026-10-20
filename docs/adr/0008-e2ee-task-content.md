# ADR-0008: End-to-end encrypted task content (Phase 2 design)

- Status: Accepted (design; implementation in Phase 2)
- Date: 2026-10-20

## Context

Task lines often carry confidential company data: ticket titles, customer names, internal URLs.
In v1 the server stores them in plaintext for the room's lifetime. Some teams want the operator
(including us, on the hosted service) to be unable to read them. Votes, the scale and room
mechanics must keep working server-side: the reducer validates votes against the scale,
computes reveal stats, and runs auto-reveal (ADR-0001).

## Decision

**What is encrypted.** Only task content. Each pasted backlog line is encrypted as typed, as one
`{ t: 'enc', iv, ct }` value (`EncryptedContentSchema`, PLAN §3.6 `Task.content` union).

**Key.** A 256-bit AES-GCM key generated in the browser (`generateContentKey`) and carried only
in the link fragment after `~` (`#roomId.joinSecret[.adminSecret]~key`, `parseRoomFragment`).
It never goes to the server, not even hashed. Anyone holding the join link can decrypt; that is
the trust model (same as joining).

**Cipher.** WebCrypto AES-256-GCM, a fresh random 96-bit IV per task (`encryptTaskLine`), and
additional data `backlogfit:e2ee:v1:<roomId>` so a ciphertext cannot be moved into another
room. With at most `MAX_TASKS` (500) encryptions per key, random IV collisions are negligible.
Plaintext is padded (0x80 + zeros, ISO/IEC 7816-4) to a multiple of 256 bytes, max 4096 bytes.

**Server role.** The server treats `enc` values as opaque. It checks shape and size only: IV
exactly 16 base64url characters, ciphertext canonical base64url whose decoded length is
`k × 256 + 16` with padded plaintext ≤ 4096 bytes (`ENC_CT_MAX_CHARS`), no extra keys. The
frame cap (`MAX_MESSAGE_BYTES`) still applies, so clients batch `admin.tasks.addEncrypted`.

**Link policy moves to the client.** The server cannot parse encrypted lines, so in encrypted
rooms the ID/link/allowlist policy (`parseTaskLine`) runs on every client after decryption
(`decryptTask`). A line that fails is shown as "hidden: does not match this room's link
policy", never as a link. Only facilitators can add tasks, so the worst case is a facilitator
adding a link others refuse to render. Undecryptable items fail closed (`undecryptable`).

**Display names stay plaintext.** Decision: names are not encrypted in Phase 2.
- Names are chosen per room by the participant, can be pseudonyms, and the join screen says so.
  Ticket content is third-party company data that users cannot choose to anonymize.
- Server-side name hygiene (length, NFC, no bidi/zero-width/control characters) protects lobby
  approval, kick and co-admin promotion from spoofing. With encrypted names this control would
  depend on every client implementing it correctly.
- Votes are plaintext anyway (needed for stats and auto-reveal), so encrypting names would not
  hide who participated: participant ids, join times and vote timing remain visible.
- An encrypted name can be added later as an additive optional field if demand appears.

**What the server can still see** (documented in PRIVACY.md by A4): number of tasks, their
order, which one is current, ciphertext size buckets (256-byte steps), timing of every action,
votes, final estimates, stats, the scale, settings, display names, participant count, and
transport metadata (IP addresses in memory only, ADR-0007).

**Key rotation is not supported.** The key is the link. A leaked link means a leaked key; the
remedy is to create a new room (rooms last at most 8 hours). No re-encryption protocol, no
multiple key ids.

**Interfaces now, behaviour later.** Core exports the schemas and helpers
(`EncryptedContentSchema`, `TaskContentSchema`, `EncryptedTasksAddSchema`,
`parseEncryptedContent`, `encryptTaskLine`, `decryptTaskLine`, `decryptTask`,
`generateContentKey`, `parseRoomFragment`/`formatRoomFragment`). None is wired into the v1
reducer or `ClientMessageSchema`; plaintext rooms are unchanged, which tests assert.

## Consequences

- An operator or a database leak exposes no task text in encrypted rooms.
- Exports are generated client-side from decrypted views (already the case: exports take a
  `RoomView`).
- Phase 2 needs these protocol changes, each additive and only visible in encrypted rooms:
  `RoomConfig.content: 'plain' | 'e2ee'` (default `plain`), `admin.tasks.addEncrypted`,
  and `TaskView.content` for encrypted tasks. Because `RoomViewSchema` is strict, a v1 client
  would reject an encrypted room's view; encrypted rooms therefore require an updated client
  (they are created by one, so this is acceptable).
- Size buckets and timing still leak coarse information; padding to 256 bytes is a deliberate
  trade-off between leakage and frame budget.
