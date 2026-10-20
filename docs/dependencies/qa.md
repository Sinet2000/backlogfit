# QA dependencies (`@backlogfit/e2e`, `@backlogfit/load`)

Test-only packages; nothing here ships to users. All versions are pinned exactly.

## `@backlogfit/e2e` (tests/e2e)

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `@playwright/test` | 1.64.1 | Apache-2.0 | Multi-browser e2e runner (Chromium, Firefox, WebKit), multiple isolated browser contexts per test (one per participant), WebSocket frame inspection (`framereceived`), downloads, clipboard permissions, `toHaveScreenshot` visual regression, the `webServer` launcher, and the screenshot/OG image generator. | Cypress cannot drive several isolated browsers in one test and has no WebSocket frame API; Puppeteer is Chromium-first and has no test runner or snapshot assertions. One tool covers e2e, visual and screenshots, so no extra image tooling is needed. |
| `@axe-core/playwright` | 4.14.0 | MPL-2.0 | Runs axe-core accessibility rules inside Playwright pages; specs fail on serious/critical violations. | The official Deque integration; hand-injecting axe-core needs a CSP exception for an inline script, which our strict CSP forbids (the integration injects via the driver instead). |
| `@types/node` | 24.19.1 | MIT | Types for `node:fs`, `node:test`, `process` used by fixtures and unit tests. | Required by TypeScript for Node APIs; matches the Node 24 runtime. |

Workspace: `@backlogfit/core` (hashing, scale presets, the same secrets as the browser).

Browsers are installed with `pnpm --filter @backlogfit/e2e install-browsers`
(`playwright install chromium firefox webkit`); they are downloaded by Playwright, not npm.

## `@backlogfit/load` (tests/load)

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `ws` | 8.22.0 | MIT | WebSocket client with custom `Origin` header (the server checks Origin) for hundreds of concurrent clients. | Node's built-in `WebSocket` (undici) cannot set the `Origin` header; k6/artillery are large external tools with their own runtimes. `ws` is already used by the server, so no new code enters the tree. |
| `@types/ws` | 8.18.2 | MIT | Types for `ws`. | `ws` ships no types. |
| `@types/node` | 24.19.1 | MIT | Node API types (`node:util` `parseArgs`, `perf_hooks`). | As above. |

Workspace: `@backlogfit/core` (room creation request, hashing, scale presets).
No other dependencies: percentile maths and reporting are a few lines of local code.
