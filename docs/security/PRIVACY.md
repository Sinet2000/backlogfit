# Backlogfit privacy summary

One page for security and privacy reviewers. Details: [THREAT_MODEL.md](THREAT_MODEL.md),
[SELF_HOSTING.md](SELF_HOSTING.md), protocol in `docs/protocol/PROTOCOL.md`.

## In one paragraph

Backlogfit has no accounts, no cookies, no analytics and no third-party requests. A room
exists only for the meeting: it holds the display names people type, the task lines the
facilitator pastes, and the votes. It is deleted automatically after its lifetime (default 2 h,
hard maximum 8 h) or after 30 minutes without activity, or at once when the facilitator closes
it. Room secrets live in the link's `#fragment`, which browsers never send to a server; the
server stores only their SHA-256 hashes. The application does not store or log IP addresses or
user agents.

## What data exists

| Data | Who provides it | Where it lives | How long | Who can see it |
|---|---|---|---|---|
| Display name (any text, max 40 chars) | each participant | room state on the server; the participant's browser `localStorage` remembers the last name typed (on that device only) | room lifetime | everyone in the room |
| Role (voter/spectator), facilitator flag | participant / facilitator | room state | room lifetime | everyone in the room |
| Task lines (ticket ID, title, link) | facilitator | room state | room lifetime | everyone in the room |
| Votes | voters | room state | room lifetime | before reveal: only the voter; after reveal: everyone (without names if "anonymous reveal" is on) |
| Final estimates | facilitator | room state | room lifetime | everyone in the room |
| Room settings and deck | facilitator | room state; the browser may keep the last configuration draft in `localStorage` | room lifetime | everyone (allowlist: facilitators only) |
| Secret hashes (join, admin, resume, salted passcode) | browser/server | room state | room lifetime | nobody (never sent to clients) |
| Resume token, admin secret | browser/server | that browser tab's `sessionStorage` | until the tab closes | that tab |
| Exports (CSV/JSON/Markdown) | generated in the browser | the user's device, only if they download | user's choice | the user |

**Lifetime rules** (configurable by self-hosters, same names on both backends):
`DEFAULT_LIFETIME_HOURS=2`, `MAX_LIFETIME_HOURS=8` (extensions can never exceed it),
`IDLE_TIMEOUT_MINUTES=30`. At the deadline the room is closed, every connection receives
`closed`, and **all room storage is deleted** (Cloudflare: Durable Object `deleteAll()`;
self-hosted: SQLite row delete with `secure_delete` and WAL truncation, or memory only).

## What is never collected

- No accounts, e-mail addresses, phone numbers or SSO identities (v1).
- No cookies of any kind; no tracking pixels, analytics, fingerprinting, ads, CDNs, web fonts
  or other third-party resources (enforced by `Content-Security-Policy: default-src 'none'`
  with `'self'` only where needed).
- No IP addresses, user agents or request logs stored by the application. Rate limiting keeps
  a keyed hash of the client address in memory only, with a random key that changes on every
  restart.
- No room content in logs. Errors are reported as codes; user input is never echoed or logged.
- No secrets in URLs sent to servers: the WebSocket URL contains only the room ID; secrets are
  sent inside the encrypted connection in the first message.

## What any server necessarily sees

- **Network metadata.** Any web server sees the client IP address and TLS metadata while a
  connection is open. Backlogfit does not write it anywhere.
- **Cloudflare deployment.** TLS terminates at Cloudflare's edge, so Cloudflare's
  infrastructure processes the traffic (including room content inside it) and may keep its
  own operational data under its terms. Backlogfit disables Worker logs, traces, Logpush and
  tail workers, but cannot control the edge itself.
- **Self-hosted deployment.** The operator's reverse proxy sees the same metadata; disable or
  anonymize its access logs (see SELF_HOSTING.md). Self-hosting removes every third party:
  the container needs no outbound network access at all.

## Data flow

| Step | From → to | Content | Transport | Stored? |
|---|---|---|---|---|
| Open the app | browser → server | static files | HTTPS | no |
| Create a room | browser → `POST /api/rooms` | room settings, SHA-256 of join/admin secrets, optional salted passcode hash, lifetime | HTTPS | room state until expiry |
| Share link | facilitator → participants | `https://host/r#roomId.joinSecret` | user's channel (chat, mail, QR) | fragment never reaches the server |
| Join | browser → `wss://host/ws/<roomId>` | first frame: join secret, name, role, optional passcode/resume token | WSS | name in room state; secrets only as hashes |
| Vote, facilitate | browser ↔ server | votes, admin commands; server replies with the viewer's projected view | WSS | room state until expiry |
| End | server | — | — | everything deleted |

## Rights and requests

Because nothing outlives the room and nothing identifies a person beyond a self-chosen display
name, there is nothing to export, correct or delete after a session ends. During a session,
the facilitator can remove a participant (kick; their already revealed votes stay in the round
history under the name they used until the room ends) or close the room, which deletes
everything immediately.
