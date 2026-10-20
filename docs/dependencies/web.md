# @backlogfit/web dependencies

All versions are pinned exactly in `apps/web/package.json`. No UI kit, no CSS framework, no icon
library (icons are inline SVG components), no analytics, no runtime CDN. Fonts are vendored.

## Runtime (shipped to the browser)

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `@backlogfit/core` | workspace | Apache-2.0 | Schemas, scales, stats, exports, task parsing, `LoopbackEngine` for the offline demo. | Shared with the backends so client and server agree byte for byte. |
| `svelte` | 5.57.2 | MIT | Component compiler and runes reactivity. Compiles away; small runtime. | React/Vue ship larger runtimes and need more glue for the same result. |
| `qrcode-generator` | 2.0.4 | MIT | Encodes the join link as a QR matrix; we render the modules as SVG `<rect>` elements ourselves (no `data:` URLs, no canvas). | Zero dependencies, ~20 KB, stable for a decade. `qrcode` pulls in several deps and favours canvas/data URLs, which `img-src 'self'` would block. |

## Development / build only

| Package | Version | License | Purpose | Why not an alternative |
|---|---|---|---|---|
| `@sveltejs/kit` | 3.1.0 | MIT | Routing, prerendering, client router. | The standard Svelte app framework; prerender + client-only routes in one build. |
| `@sveltejs/adapter-static` | 4.0.0 | MIT | Writes plain static files to `build/`, served by the Node server or any static host. | No server runtime needed for the frontend. |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | MIT | Svelte compilation inside Vite (peer of Kit). | Required by Kit. |
| `vite` | 8.3.4 | MIT | Dev server (with `/api` and `/ws` proxy) and bundler. | Required by Kit. |
| `svelte-check` | 4.7.7 | MIT | Type checking of `.svelte` and `.ts` files (`pnpm typecheck`). | Only tool that type-checks Svelte templates. |
| `typescript` | 6.0.3 | Apache-2.0 | Type system (peer of Kit and svelte-check). | Workspace standard. |
| `vitest` | 5.0.5 | MIT | Unit tests of the plain TS logic modules. | Workspace standard, shares Vite config. |
| `@types/node` | 24.19.1 | MIT | Types for the build scripts (`scripts/*.ts`, run with Node's type stripping). | Needed for `node:fs` etc. in strict TS. |
| `@backlogfit/security` | workspace | Apache-2.0 | `securityHeaders()` for `scripts/serve.ts` (serve the build under the production CSP). | Same headers as production. |

Deliberately not used: `@testing-library/svelte`/jsdom (UI is covered by Playwright in
`tests/e2e`, logic lives in plain TS modules that are unit-tested without a DOM).

## Vendored assets

| Asset | Version | License | Source |
|---|---|---|---|
| Inter variable font (latin + latin-ext, `wght` axis, woff2) | 4.x via `@fontsource-variable/inter` 5.3.0 | OFL-1.1 (`apps/web/static/fonts/OFL.txt`) | `npm pack @fontsource-variable/inter`, files `inter-latin-wght-normal.woff2` and `inter-latin-ext-wght-normal.woff2`, renamed. Not an npm dependency. |
