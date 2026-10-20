# Security review: checklist and results

Reviewer: A4 (security & privacy). Scope: the integrated build (all six branches merged). The
findings table with evidence per item is `coordination/A4.md` ("Phase C final review"); this
file is the checklist that was applied and the summary. Re-run it for every release.

Final pass: 2026-10-20 against main@ddc222a (Phase C). Earlier pass: Phase B branches.

## Summary

| Severity | Open | Accepted | Fixed |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 1 (SEC-001) |
| Medium | 0 | 0 | 3 (SEC-003, SEC-004, SEC-010) |
| Low | 2 (SEC-014 A3: admin secret stays in the address bar; SEC-015 A6: gitleaks false positives fail CI) | 0 | 4 (SEC-002, SEC-005, SEC-006, SEC-007) |
| Info | 3 (SEC-012, SEC-013 A2; SEC-016 A6) | 2 (SEC-008, SEC-009) | 1 (SEC-011) |

**Release gate (no open Critical or High): passed.** Recommended before tagging: SEC-015
(otherwise the Security workflow is red) and SEC-014. Known open item tracked by A3 and not
re-filed: the SvelteKit route announcer's inline `style` is blocked by CSP.

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
| Wrong join secret indistinguishable from unknown room | ✅ reducer + Node decoy room, Worker same DO for real/unknown ids (SEC-005 fixed) |
| No secret in `Referer` (`no-referrer` header + meta), no third-party requests | ✅ |

### Input handling

| Check | Result |
|---|---|
| Size cap before parse on every frame and body | ✅ `ws` `maxPayload`, `parseClientMessage`, `bodyLimit(64 KiB)` |
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
| Only `project()`/`expandEffects` output ever sent | ✅ Node and Worker |

### Transport and HTTP

| Check | Result |
|---|---|
| Origin allowlist, exact canonical match, on WS upgrade and POST | ✅ (`isAllowedOrigin` hardened against userinfo/port/case/trailing-dot/path lookalikes) |
| Rate limits: per connection, per room, room creation | ✅ (SEC-003 fixed: `clientIp` + `parseTrustProxy` on both backends) |
| Connection limits per client and global | ✅ (SEC-004 fixed: Node global/per-client caps + upgrade bucket; Worker upgrade rate-limit binding) |
| Invalid-frame strikes → 1008; hello timeout | ✅ |
| Security headers on every response (CSP, HSTS, nosniff, no-referrer, Permissions-Policy, COOP, COEP, CORP, OAC, XFO) | ✅ `applySecurityHeaders` on both backends, `_headers` for Worker assets (SEC-006, SEC-011 fixed) |
| Errors as codes only, no stack traces, no `X-Powered-By`/`Server` | ✅ |
| No logging of IP, UA, path parameters or content | ✅ Node (`reportError` only); ✅ Worker (no `console.*`, observability/logs/Logpush disabled in wrangler.jsonc) |
| IPs not stored; in-memory keys hashed | ✅ keyed SipHash in memory only |

### Browser

| Check | Result |
|---|---|
| No `{@html}`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` | ✅ grep on agent/frontend + `test/source-hygiene.test.ts` (A3); Trusted Types enforce it at runtime |
| No inline scripts/styles/handlers in built HTML | ✅ build-time check (`apps/web/scripts/externalize.ts`) |
| External links `rel="noopener noreferrer"`; task links rendered as text, http(s) only | ✅ `room-ui/CurrentTask.svelte` (http(s) re-check, `noopener noreferrer`, host shown) |
| Secrets never in `localStorage`; only name/theme/draft there | ✅ |
| Admin secret not left in the address bar / history | ⚠️ SEC-014 |
| Exports built from the projected view, downloaded locally; clipboard gets the summary only | ✅ `lib/download.ts`, `ResultsPanel.svelte` |
| Preset import size-capped and schema-validated | ✅ 64 KiB + `parsePreset` (fuzzed) |
| Source maps not served in production | ✅ none emitted; ⚠️ SEC-012 (trailing-slash bypass of the hide rule) |
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
| Actions SHA-pinned, least-privilege tokens, no credential persistence | ✅ agent/docs |
| SAST/SCA/secret scanning/Scorecard/Dependabot | ✅; root pnpm policies applied; ⚠️ SEC-016 (cooldown, egress block, PR Trivy) and SEC-015 (gitleaks ignore) |
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

The two bugs tracked as `it.fails` (SEC-001, SEC-002) are fixed and the tests are now plain
`it`. Phase C added `preset-idpattern.test.ts`: preset import fuzzing and a differential test of
the regex-free ID matcher against RegExp.
