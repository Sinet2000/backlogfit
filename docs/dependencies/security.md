# Dependencies: @backlogfit/security

`packages/security` is pure TypeScript with **no third-party runtime dependency**. Everything it
needs (URL parsing, TextEncoder, WebCrypto `getRandomValues`, BigInt for SipHash) is built into
Node 24 and the Workers runtime.

| Package | Version | Kind | Why | Alternatives considered |
|---|---|---|---|---|
| `@backlogfit/core` | workspace | runtime | `ctEqual` is re-exported from core instead of being duplicated (one constant-time compare in the codebase); the fuzz tests drive core's parsers and reducer. | Copying `ctEqual`: two implementations would drift. |
| `vitest` | 5.0.5 | dev | Test runner used by every package in the workspace. | None (workspace standard). |
| `fast-check` | 4.10.2 | dev | Property-based tests and fuzzing (rate-limiter bound, origin lookalikes, parser fuzzing, random room sessions). Zero dependencies, MIT, already used by core. | Hand-written random loops: no shrinking, no reproducible seeds. |

Decisions

- SipHash-2-4 for client-IP keys is implemented in ~40 lines (checked against the reference
  test vectors) rather than pulling a hashing library; `crypto.subtle` HMAC would have made
  `clientIp()` async, which the upgrade/rate-limit path does not need.
- No `ipaddr.js`/`proxy-addr`: IPv4/IPv6 parsing is limited to what rate-limit bucketing needs
  and is fuzzed (`test/client-ip.test.ts`).
