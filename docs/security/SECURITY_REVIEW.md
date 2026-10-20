# Security review: checklist and results

Reviewer: A4 (security & privacy). Scope: all branches of the Phase B build. The live findings
table, with owners and status, is `coordination/A4.md`; this file is the checklist that was
applied and the summary of results. Re-run the checklist for every release.

Last pass: 2026-10-20 against main@afaa146, agent/backend@725121f, agent/frontend@d492e8c, agent/qa@8257d0f, agent/docs@cd2baea.

## Summary

| Severity | Open | Accepted | Fixed |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 (SEC-001, A1: ReDoS via `idPattern`) | 0 | 0 |
| Medium | 3 (SEC-003, SEC-004, SEC-010, A2) | 0 | 0 |
| Low | 4 (SEC-002 A1; SEC-005, SEC-006, SEC-007 A2) | 0 | 0 |
| Info | 1 (SEC-011, A2) | 2 (SEC-008, SEC-009) | 0 |

Definition of done (PLAN §8) requires no open High: **SEC-001 must be fixed before release.**

`pnpm audit` (dev + prod, every worktree, 2026-10-20): no known vulnerabilities.

## Checklist

Legend: ✅ verified, ⚠️ finding (ID), ⏳ not yet reviewable (code not written), — not applicable.

### Secrets and identifiers

| Check | Result |
|---|---|
| Secrets only in URL fragment; WS URL carries only roomId; secrets in first frame | ✅ `apps/web/src/lib/room/transport.ts`, `create.ts` |
| Server stores only SHA-256 of secrets; raw secrets never in state, effects or logs | ✅ ADR-0005, `packages/core/src/crypto.ts` |
| All secret comparisons constant-time, every comparison executed | ✅ `ctEqual`, `verifyHello` |
| Secrets from a CSPRNG (WebCrypto), ≥ 128 bit | ✅ `randomToken` (core), roomId `randomToken(16)` on Node |
| Resume token in `sessionStorage` only, rotated on every join | ✅ `apps/web/src/lib/room/storage.ts`, reducer `hello()` |
| Wrong join secret indistinguishable from unknown room | ✅ reducer + Node decoy room; ⚠️ SEC-005 (1013 oracle) |
| No secret in `Referer` (`no-referrer` header + meta), no third-party requests | ✅ |

### Input handling

| Check | Result |
|---|---|
| Size cap before parse on every frame and body | ✅ `ws` `maxPayload`, `parseClientMessage`, `bodyLimit(64 KiB)` |
| JSON.parse never throws out; strict schemas reject unknown keys incl. `__proto__`, `constructor` | ✅ fuzzed (`test/fuzz/client-message.test.ts`) |
| No prototype pollution from any input | ✅ fuzzed, `Object.prototype` checked after every case |
| String length caps, NFC, control/bidi/zero-width rejection on user-visible text | ✅ ⚠️ SEC-002 (lone surrogates, invisible fillers) |
| Task links: http(s) only, no credentials, allowlist suffix match, IDN refused on open policy | ✅ fuzzed with a 48-entry bypass corpus and generated URLs (`test/fuzz/tasks.test.ts`) |
| No ReDoS: no user-controlled regex without bounds; all fixed regexes linear | ⚠️ SEC-001 (High); fixed regexes reviewed: OK |
| CSV/spreadsheet formula injection neutralized in exports | ✅ `csvCell` (`=`, `+`, `-`, `@`, tab, CR prefixed with `'`), property-tested in core |
| Integers: reject non-integers, Infinity, unsafe ranges; env limits plain decimal only | ✅ schemas `int()`, `readLimits` |

### Authorization and privacy invariants

| Check | Result |
|---|---|
| No vote value of others before reveal, in any frame | ✅ core properties + end-to-end fuzz with real hashing |
| Non-facilitators cannot change admin state; admin-only actions limited to admin | ✅ core property (b) + fuzz with forgers/intruders |
| Unauthenticated sockets learn nothing (only `error`/`closed`) | ✅ fuzz (`test/fuzz/room.test.ts`) |
| Allowlist, lobby and passcode-lock state visible to facilitators only | ✅ `project()` + fuzz |
| Anonymous reveal cannot be undone; values unlinkable to names | ✅ reducer + projection (sorted by scale order) |
| Lifetime never exceeds max; expiry/idle emit `deleteAll` exactly once; later events only close | ✅ core property (c) + fuzz |
| Storage deleted on end (DO `deleteAll`; SQLite `secure_delete` + WAL truncate); overdue rooms expired on restart | ✅ Node; Worker: `deleteAlarm()` + `deleteAll()` ✅, but ⚠️ SEC-010 (constructor re-creates storage) |
| Only `project()`/`expandEffects` output ever sent | ✅ Node and Worker |

### Transport and HTTP

| Check | Result |
|---|---|
| Origin allowlist, exact canonical match, on WS upgrade and POST | ✅ (`isAllowedOrigin` hardened against userinfo/port/case/trailing-dot/path lookalikes) |
| Rate limits: per connection, per room, room creation | ✅; ⚠️ SEC-003 (spoofable creation key behind proxy) |
| Connection limits per client and global | ⚠️ SEC-004 |
| Invalid-frame strikes → 1008; hello timeout | ✅ |
| Security headers on every response (CSP, HSTS, nosniff, no-referrer, Permissions-Policy, COOP, COEP, CORP, OAC, XFO) | ✅ via `securityHeaders`; ⚠️ SEC-006 (`/r`, `/new` cache + robots) |
| Errors as codes only, no stack traces, no `X-Powered-By`/`Server` | ✅ |
| No logging of IP, UA, path parameters or content | ✅ Node (`reportError` only); ✅ Worker (no `console.*`, observability/logs/Logpush disabled in wrangler.jsonc) |
| IPs not stored; in-memory keys hashed | ⚠️ SEC-003 (raw IP as key on Node; `clientIp()` available) |

### Browser

| Check | Result |
|---|---|
| No `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` | ✅ grep on agent/frontend + `test/source-hygiene.test.ts` (A3); Trusted Types enforce it at runtime |
| No inline scripts/styles/handlers in built HTML | ✅ build-time check (`apps/web/scripts/externalize.ts`) |
| External links `rel="noopener noreferrer"`; task links rendered as text, http(s) only | ✅ footer; ⏳ room UI task links |
| Secrets never in `localStorage`; only name/theme/draft there | ✅ |
| `/r`, `/new` `noindex` | ✅ meta (externalize.ts) + robots.txt; ⚠️ SEC-006 header on Node |
| QR code without data: URLs or inline styles | ✅ SVG path (`apps/web/src/lib/qr.ts`, uncommitted) |

### Container, deployment, supply chain

| Check | Result |
|---|---|
| Non-root, distroless, digest-pinned base images | ✅ `apps/server/Containerfile` |
| Read-only root FS compatible, tmpfs `/tmp`, cap-drop ALL, no-new-privileges, limits | ✅ compose example; guide in SELF_HOSTING.md |
| Memory-only default | ⚠️ SEC-007 |
| No outbound network needed | ✅ (documented egress deny) |
| Dependencies pinned exactly, lockfile frozen, each justified | ✅ `docs/dependencies/*.md` |
| pnpm build scripts allowlisted minimally | ✅ `allowBuilds` (esbuild, workerd; sharp denied) |
| Actions SHA-pinned, least-privilege tokens, no credential persistence | ✅ agent/docs |
| SAST/SCA/secret scanning/Scorecard/Dependabot | ✅ agent/docs; deltas proposed (cooldown, egress block, minimumReleaseAge) |
| Signed images, provenance, SBOM | ✅ release workflow |

## How the fuzz suite works

`packages/security/test/fuzz` (fast-check, deterministic seeds printed on failure):

- `client-message.test.ts`: arbitrary text and bytes, `fc.jsonValue`, 5 000 mutations of valid
  messages of every type (hostile values, prototype keys, type confusion), hostile number
  literals (`1e400`, 30-digit integers), nesting up to 100 000 levels, oversized frames; accepted
  messages must be a fixed point of serialize/parse and satisfy all field invariants.
- `tasks.test.ts`: every policy × ID-pattern × template combination against arbitrary strings,
  a corpus of 48 known URL/allowlist bypasses, and 10 000 generated URLs from hostile parts;
  room-creation requests with nested mutations (including `__proto__` via JSON text).
- `room.test.ts`: 1 000 random sessions through `LoopbackEngine` (real SHA-256 verification)
  with seven actors (admin, members, spectator, intruder with a wrong join secret, a socket that
  never says hello, a forger with a wrong admin secret), raw garbage frames, extra-key
  injection, reconnects and clock jumps; invariants checked on every frame delivered.

Two tracked bugs are kept as `it.fails` (SEC-001, SEC-002): when fixed, the tests fail and must
be flipped to `it`.
