# Architecture decision records

Short MADR-style records of decisions that shape Backlogfit. New ADRs take the next number;
accepted ADRs are not edited except to mark them superseded.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-pure-reducer-core.md) | Pure reducer in packages/core; backends are adapters | Accepted |
| [0002](0002-secrets-in-fragment.md) | Secrets in the URL fragment, sent in the first WS frame; server stores hashes only | Accepted |
| [0003](0003-full-snapshot-state.md) | Full-snapshot state messages, not patches | Accepted |
| [0004](0004-sqlite-storage.md) | Node uses built-in node:sqlite; Worker uses Durable Object SQLite storage | Accepted |
| [0005](0005-auth-split.md) | Authentication split: adapters hash, the reducer decides | Accepted |
| [0006](0006-strict-csp-static-sveltekit.md) | Strict CSP for the static SvelteKit build | Accepted |
| [0007](0007-in-memory-rate-limiting.md) | Rate limiting with in-memory token buckets, no persisted IPs | Accepted |
| [0008](0008-e2ee-task-content.md) | End-to-end encrypted task content | Accepted (Phase 2 design) |
| [0009](0009-self-hosted-fonts-assets.md) | Self-hosted fonts and assets, zero third-party requests | Accepted |
| [0010](0010-oidc-sso-self-hosted.md) | OIDC/SSO sign-in for self-hosted deployments | Accepted (Phase 2 design) |
| [0011](0011-shared-room-host.md) | One transport-agnostic room host for both backends | Accepted |
| [0012](0012-teams-and-per-task-voters.md) | Teams, team invite links and per-task voters | Accepted |

Template:

```md
# ADR-NNNN: Title

- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
