# ADR-0002: Secrets in the URL fragment, sent in the first WS frame; server stores hashes only

- Status: Accepted
- Date: 2026-10-20

## Context

Join and admin links must be shareable by copy/paste, yet strict-policy organizations log
request lines, proxies record URLs, and `Referer` headers leak paths and queries. A server
breach must not hand out working room links.

## Decision

- The browser generates `joinSecret` and `adminSecret` (128-bit, WebCrypto) and puts them only
  in the URL fragment (`/r#roomId.join[.admin]`), which browsers never send to servers.
- `POST /api/rooms` carries only `joinHash`/`adminHash` (SHA-256 hex). The server generates
  `roomId`.
- The WebSocket URL contains only `roomId`. Secrets travel in the first frame (`hello`) over TLS.
- Per-participant `resumeToken`s are minted by the server, delivered once, stored as hashes, and
  rotated on every successful hello.
- Optional passcodes are stored as salted SHA-256 with a room-wide attempt limit
  (`PASSCODE_MAX_ATTEMPTS`); unlocking the room resets the counter.
- All comparisons are digest vs digest with a constant-time compare (`ctEqual`).
- A wrong join secret is answered exactly like an unknown room (`closed{not_found}`).

## Consequences

- Stored state and logs contain nothing that grants access.
- A lost admin link cannot be recovered; the UI shows it once with a warning.
- Passcodes are low-entropy; the salted hash protects only against casual disclosure, the
  attempt limit is the real protection. A join-link holder can exhaust the attempts (DoS),
  which the admin can reset.
