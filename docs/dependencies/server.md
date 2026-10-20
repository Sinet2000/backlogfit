# Dependencies: `@backlogfit/server` (apps/server)

The server runs its TypeScript sources directly with Node 24's built-in type stripping
(`node src/main.ts`), so there is no build step and no bundler. Persistence uses the built-in
`node:sqlite` module (ADR-0004), so there is no native addon.

## Runtime

| Package | Version | License | Purpose | Alternatives rejected |
|---|---|---|---|---|
| `hono` | 4.13.13 | MIT | HTTP routing, body-size limit middleware. The same router the Worker uses, so both backends share one routing style. | `node:http` by hand (more code to get right, for example body limits and HEAD handling); Express/Fastify (larger, Node-only, more transitive dependencies). |
| `@hono/node-server` | 2.1.5 | MIT | Adapts Hono's fetch handler to `node:http`. | Writing the Request/Response bridge ourselves. |
| `ws` | 8.22.0 | MIT | WebSocket server: `maxPayload` frame cap, protocol ping/pong heartbeat, `noServer` upgrade handling, so the Origin check runs before the upgrade. No runtime dependencies. | Node's built-in `WebSocket` (client only); `uWebSockets.js` (native binary, not on npm); `socket.io` (its own protocol, far larger). |
| `@backlogfit/core`, `@backlogfit/security`, `@backlogfit/host` | workspace | Apache-2.0 | Room logic, protocol schemas, headers, limits, rate limiter, the shared room host (ADR-0011). | n/a |

## Development only

| Package | Version | License | Purpose |
|---|---|---|---|
| `@types/node` | 26.6.5 | MIT | Node type definitions (`node:sqlite`, `node:http`). |
| `@types/ws` | 8.18.2 | MIT | Types for `ws`. |
| `vitest` | 5.0.5 | MIT | Test runner (same version as the rest of the workspace). |

## Container base images (apps/server/Containerfile)

| Image | Use | Why |
|---|---|---|
| `gcr.io/distroless/nodejs24-debian12:nonroot` (pinned by digest) | runtime | No shell, no package manager, runs as non-root UID 65532 by default, small attack surface. Node only, which is all the server needs. |
| `docker.io/library/node:24-alpine` (pinned by digest) | build stages only | Has a shell and npm, used to install pnpm 11.18.0 and production dependencies. Never shipped. |

`node:24-alpine` with a custom UID 10001 was considered for the runtime. We rejected it because
it ships a shell, `apk` and npm, which a compromised process could use. Distroless keeps the
runtime to Node and its libc. The healthcheck is a small Node script
(`src/healthcheck.ts`) because there is no curl.
