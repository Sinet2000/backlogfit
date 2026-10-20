# @backlogfit/core dependencies

Core is pure TypeScript shipped as source. It has exactly one runtime dependency.
All versions are pinned exactly in `packages/core/package.json`.

## Runtime

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `valibot` | 1.5.0 | MIT | Strict, length-capped schemas for every protocol message, `RoomConfig` and `RoomView`; typed parse results without exceptions (`safeParse`). | Zero dependencies, tree-shakeable, small in the browser bundle (Zod is several times larger), and runs unchanged in Workers, Node and browsers. Hand-written validators would be longer and easier to get wrong for nested strict objects. |

## Development

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `vitest` | 5.0.5 | MIT | Test runner (ESM + TypeScript natively, no transpile config). | Same runner as the frontend (Vite) and the Workers pool; Jest needs extra ESM/TS setup. `node:test` lacks the coverage/watch ergonomics and matcher set we use. |
| `@vitest/coverage-v8` | 5.0.5 | MIT | Line/branch coverage from V8, gate ≥ 90 % lines. | Uses V8's built-in coverage, no instrumentation step; Istanbul provider is slower. Must match the vitest version. |
| `fast-check` | 4.10.2 | MIT | Property tests: vote secrecy (non-interference), authorization, lifetime cap, determinism, stats invariants, parser robustness, CSV injection. | The de facto property-testing library for TS; single small dependency (`pure-rand`). No realistic alternative with shrinking of this quality. |

No other packages are used. Cryptography uses the platform WebCrypto (`globalThis.crypto`).
