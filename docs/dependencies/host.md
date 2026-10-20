# Dependencies: `@backlogfit/host` (packages/host)

The room host is TypeScript source with no build step, like core and security. It has no
third-party runtime dependency.

## Runtime

| Package | Version | License | Purpose | Alternatives rejected |
|---|---|---|---|---|
| `@backlogfit/core` | workspace | Apache-2.0 | Reducer, schemas, `toEvent`, `expandEffects`, `reconcileConnections`. | n/a |
| `@backlogfit/security` | workspace | Apache-2.0 | Rate limiter, strike counter, frame size check, close codes, env limits. | Copying them into the host: two implementations would drift. |

## Development only

| Package | Version | License | Purpose |
|---|---|---|---|
| `vitest` | 5.0.5 | MIT | Test runner, the workspace standard. |
| `@vitest/coverage-v8` | 5.0.5 | MIT | Coverage for `pnpm --filter @backlogfit/host test:coverage` (gate ≥ 90 % lines). |
