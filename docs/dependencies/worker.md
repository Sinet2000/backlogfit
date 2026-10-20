# Dependencies: `@backlogfit/worker` (apps/worker)

## Runtime (bundled into the Worker)

| Package | Version | License | Purpose | Alternatives rejected |
|---|---|---|---|---|
| `hono` | 4.13.13 | MIT | Router and body-size limit for `/api/*` and `/ws/:roomId`. Same router as the Node server. No dependencies, built for Workers. | A hand-written `fetch` switch (more code to get right); `itty-router` (would mean a second router style in the repo). |
| `@backlogfit/core`, `@backlogfit/security`, `@backlogfit/host` | workspace | Apache-2.0 | Room logic, schemas, headers, limits, rate limiter, the shared room host (ADR-0011). | n/a |

The Durable Object, WebSocket Hibernation, SQLite storage, alarms, static assets and the
Rate Limiting binding are platform features and need no npm packages.

## Development only

| Package | Version | License | Purpose | Notes |
|---|---|---|---|---|
| `wrangler` | 4.151.1 | MIT OR Apache-2.0 | `wrangler dev` (local workerd + miniflare). Never used to log in or deploy from this repo. | 4.151.3 was requested, but it was published on 2026-10-20 and fails the workspace's pnpm `minimumReleaseAge` policy. 4.151.1 is the newest version that passes. Bump to 4.151.3 once it is old enough (after 2026-10-21 12:05 UTC) or when root config excludes it. |
| `@cloudflare/vitest-plugin` | 1.4.4 | MIT | Runs Vitest inside workerd: `SELF`, `runInDurableObject`, `runDurableObjectAlarm`, `evictDurableObject`. | This is the renamed successor of `@cloudflare/vitest-pool-workers`. 0.23.0 of the old name is deprecated and only supports vitest ^4.1. The plugin supports vitest ^4.1 \|\| ^5, so this package uses the workspace's vitest 5.0.5. 1.4.4 pairs with wrangler 4.151.1. Use 1.4.6 together with wrangler 4.151.3. |
| `@cloudflare/workers-types` | 5.20261019.1 | MIT OR Apache-2.0 | Types for the Workers runtime. | |
| `vitest` | 5.0.5 | MIT | Test runner (workspace version). | |
| `@types/node` | 26.6.5 | MIT | Types for the small Node scripts in `scripts/`. | |
