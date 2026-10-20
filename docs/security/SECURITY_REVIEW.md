# Security review: checklist and results

Reviewers: the security maintainers. Scope: the integrated build. This file holds the checklist
that was applied, the summary and the [findings table](#findings) that code and tests refer to
as `SEC-0xx`. Re-run it for every release.

Last full pass: 2026-10-20. Findings updated: 2026-10-20 (shared room host).

## Summary

| Severity | Open | Accepted | Fixed |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 1 (SEC-001) |
| Medium | 0 | 0 | 3 (SEC-003, SEC-004, SEC-010) |
| Low | 0 | 0 | 6 (SEC-002, SEC-005, SEC-006, SEC-007, SEC-014, SEC-015) |
| Info | 1 (SEC-016) | 2 (SEC-008, SEC-009) | 3 (SEC-011, SEC-012, SEC-013) |

**Release gate (no open Critical or High): passed.** Known open item, not filed as a finding: the
SvelteKit route announcer's inline `style` is blocked by CSP.

Scans (2026-10-20, integrated tree):

| Tool | Scope | Result |
|---|---|---|
| `pnpm audit` | dev + prod dependencies | no known vulnerabilities |
| OSV-Scanner v2.7.0 (podman) | `pnpm-lock.yaml`, 223 packages | no issues found |
| gitleaks v8.30.1 (podman) | all refs (133 commits) + working tree | 2 false positives (RFC 6455 sample key in an e2e spec; example secret in an old PROTOCOL.md revision); see SEC-015 |
| fast-check fuzz suite | `packages/security/test/fuzz` | all invariants hold; both former `it.fails` now pass |

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
| Wrong join secret indistinguishable from unknown room | ✅ reducer + a decoy `RoomHost` per unknown id on both backends, checked by the shared contract suite (SEC-005 fixed) |
| No secret in `Referer` (`no-referrer` header + meta), no third-party requests | ✅ |

### Input handling

| Check | Result |
|---|---|
| Size cap before parse on every frame and body | ✅ `ws` `maxPayload`, `frameTooLarge` in `RoomHost`, `parseClientMessage`, `bodyLimit(64 KiB)` |
| JSON.parse never throws out; strict schemas reject unknown keys incl. `__proto__`, `constructor` | ✅ fuzzed (`test/fuzz/client-message.test.ts`) |
| No prototype pollution from any input | ✅ fuzzed, `Object.prototype` checked after every case |
| String length caps, NFC, control/bidi/zero-width rejection on user-visible text | ✅ (SEC-002 fixed: surrogates, fillers, tag chars rejected; names need a visible character) |
| Task links: http(s) only, no credentials, allowlist suffix match, IDN refused on open policy | ✅ fuzzed with a 48-entry bypass corpus and generated URLs (`test/fuzz/tasks.test.ts`) |
| No ReDoS: no user-controlled regex without bounds; all fixed regexes linear | ✅ SEC-001 fixed: admin patterns run on a regex-free matcher with hard budgets, differential-tested against RegExp; no `new RegExp` in app code |
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
| Storage deleted on end (DO `deleteAll`; SQLite `secure_delete` + WAL truncate); overdue rooms expired on restart | ✅ Node and Worker (SEC-010 fixed: no storage for unknown/ended ids) |
| Only `project()`/`expandEffects` output ever sent | ✅ `RoomHost`, shared by Node and Worker |

### Transport and HTTP

| Check | Result |
|---|---|
| Origin allowlist, exact canonical match, on WS upgrade and POST | ✅ (`isAllowedOrigin` hardened against userinfo/port/case/trailing-dot/path lookalikes) |
| Rate limits: per connection, per room, room creation | ✅ (SEC-003 fixed: `clientIp` + `parseTrustProxy` on both backends) |
| Connection limits per client and global | ✅ (SEC-004 fixed: Node global/per-client caps + upgrade bucket; Worker upgrade rate-limit binding) |
| Invalid-frame strikes → 1008; hello timeout → 1008; silent sockets → 1001 | ✅ one implementation in `packages/host` for both backends |
| Security headers on every response (CSP, HSTS, nosniff, no-referrer, Permissions-Policy, COOP, COEP, CORP, OAC, XFO) | ✅ `applySecurityHeaders` on both backends, `_headers` for Worker assets (SEC-006, SEC-011 fixed) |
| Errors as codes only, no stack traces, no `X-Powered-By`/`Server` | ✅ |
| No logging of IP, UA, path parameters or content | ✅ both backends log only internal error names and messages (`reportError`); Worker observability, logs and Logpush disabled in wrangler.jsonc |
| IPs not stored; in-memory keys hashed | ✅ keyed SipHash in memory only |

### Browser

| Check | Result |
|---|---|
| No `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` | ✅ grep on `apps/web/src` + `test/source-hygiene.test.ts`; Trusted Types enforce it at runtime |
| No inline scripts/styles/handlers in built HTML | ✅ build-time check (`apps/web/scripts/externalize.ts`) |
| External links `rel="noopener noreferrer"`; task links rendered as text, http(s) only | ✅ `room-ui/CurrentTask.svelte` (http(s) re-check, `noopener noreferrer`, host shown) |
| Secrets never in `localStorage`; only name/theme/draft there | ✅ |
| Admin secret not left in the address bar / history | ✅ (SEC-014 fixed) |
| Exports built from the projected view, downloaded locally; clipboard gets the summary only | ✅ `lib/download.ts`, `ResultsPanel.svelte` |
| Preset import size-capped and schema-validated | ✅ 64 KiB + `parsePreset` (fuzzed) |
| Source maps not served in production | ✅ none emitted; hidden by the static handler (SEC-012 fixed) |
| Test-only switches cannot turn on in production | ✅ `TEST_TIME_SCALE` only with `NODE_ENV=test`; image pins production |
| Workflows: SHA pins, least privilege, no `pull_request_target`, no `${{ }}` in `run:` | ✅ |
| `/r`, `/new` `noindex` | ✅ meta + robots.txt + `X-Robots-Tag` header |
| QR code without data: URLs or inline styles | ✅ SVG path (`apps/web/src/lib/qr.ts`); QR encodes the join link only |

### Container, deployment, supply chain

| Check | Result |
|---|---|
| Non-root, distroless, digest-pinned base images | ✅ `apps/server/Containerfile` |
| Read-only root FS compatible, tmpfs `/tmp`, cap-drop ALL, no-new-privileges, limits | ✅ compose example; guide in SELF_HOSTING.md |
| Memory-only default | ✅ (SEC-007 fixed: `DATA_DIR=` in the image) |
| No outbound network needed | ✅ (documented egress deny) |
| Dependencies pinned exactly, lockfile frozen, each justified | ✅ `docs/dependencies/*.md` |
| pnpm build scripts allowlisted minimally | ✅ `allowBuilds` (esbuild, workerd; sharp denied) |
| Actions SHA-pinned, least-privilege tokens, no credential persistence | ✅ `.github/workflows` |
| SAST/SCA/secret scanning/Scorecard/Dependabot | ✅; root pnpm policies and Dependabot cooldown applied; ⚠️ SEC-016 (egress block, PR Trivy) |
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

`preset-idpattern.test.ts` fuzzes preset import and runs a differential test of the regex-free ID
matcher against RegExp.

## Findings

Every finding from the reviews with its current status. New findings take the next number; fixed
findings stay listed.

| ID | Severity | Area | Status | Finding | Resolution |
|---|---|---|---|---|---|
| SEC-001 | High | core | fixed | An admin-supplied `idPattern` ran as a RegExp; chains of overlapping quantifiers (`a*a*…a*b`) took over a minute of CPU per task line and blocked the server. | Patterns run on a regex-free matcher with hard budgets (`packages/core/src/idpattern.ts`): at most 24 atoms, 6 quantified, tokens up to 64 chars, no backtracking. Differential and timing tests in `packages/security/test/fuzz`. |
| SEC-002 | Low | core | fixed | Names, titles and final values accepted lone surrogates, invisible fillers, soft hyphen, ALM and tag characters, so a name could look blank or identical to another. | `isUnsafeCodePoint` rejects them and names need a visible character (`packages/core/src/text.ts`). |
| SEC-003 | Medium | backends | fixed | Behind a proxy the room-creation rate-limit key was the client-controlled leftmost `X-Forwarded-For` entry, and raw IPs were limiter keys. | `clientIp` + `parseTrustProxy` take the entry the trusted proxy appended and hash it (`packages/security/src/client-ip.ts`), on both backends. |
| SEC-004 | Medium | backends | fixed | No per-client or global cap on WebSocket connections; unknown room ids bypassed the per-room cap. On Workers every upgrade wakes a Durable Object. | Node: global and per-client socket caps plus an upgrade bucket before the handshake (`apps/server/src/app.ts`). Worker: `UPGRADE_LIMITER` binding with an in-memory fallback (`apps/worker/src/index.ts`). |
| SEC-005 | Low | backends | fixed | Room-existence oracle and slot squatting: only real rooms answered "full", and pre-hello sockets used up room capacity. | Unknown and ended ids get a decoy host per id that runs the same pipeline; capacity is enforced on hello; the oldest pending socket is closed when a room has too many (`packages/host/src/room-host.ts`). |
| SEC-006 | Low | backends | fixed | `/r` and `/new`, whose fragments carry secrets, were cacheable and indexable; source maps would have been served. | `applySecurityHeaders` on every response: `no-store` and `noindex` for those pages; `.map` hidden in production. |
| SEC-007 | Low | container | fixed | The image wrote room content to a volume by default. | `DATA_DIR=` (memory only) in the image; persistence is opt-in. |
| SEC-008 | Info | core | accepted | Passcodes use one salted SHA-256, so a stolen room row allows offline guessing of a short passcode. | Accepted: the passcode only guards a leaked link, and a slow server-side KDF would be a CPU lever. See THREAT_MODEL §5. |
| SEC-009 | Info | backends | accepted | `POST /api/rooms` without an `Origin` header is accepted. | Accepted: browsers always send `Origin` on these requests; other clients are rate-limited. |
| SEC-010 | Medium | worker | fixed | The Durable Object created its table in the constructor, so every probed or ended room id left stored data behind. | Read-only probe in the constructor, table created on the first save, everything deleted on end; decoys get no storage port at all (`apps/worker/src/room-do.ts`). |
| SEC-011 | Info | worker | fixed | `_headers` had a duplicated `/_app/immutable/*` block, so Cloudflare joined two `Cache-Control` values. | `write-headers.ts` writes `headersFile()` only. |
| SEC-012 | Info | server | fixed | Source-map hiding checked the raw path, so a trailing slash still served a `.map` file. | The check uses the last normalized path segment (`apps/server/src/static.ts`). |
| SEC-013 | Info | worker | fixed | Default Worker vars were development values. | A `production` environment in `wrangler.jsonc`; deploy with `--env production`. |
| SEC-014 | Low | web | fixed | The admin link stayed in the address bar, browser history and screen shares. | The web app takes the admin secret out of the address bar after parsing. |
| SEC-015 | Low | CI | fixed | gitleaks failed on two known false positives. | `.gitleaksignore` lists them. |
| SEC-016 | Info | CI | open | Supply-chain hardening not fully applied: harden-runner egress is `audit`, not `block`, and Trivy runs on releases only. | Dependabot cooldown and the root pnpm policies are applied; the rest stays open here. |
