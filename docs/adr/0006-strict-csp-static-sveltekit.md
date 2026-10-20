# ADR-0006: Strict CSP for the static SvelteKit build

- Status: Accepted
- Date: 2026-10-20

## Context

The web app is a SvelteKit site built with `adapter-static` and served as plain files by the
Worker, the Node server, or any static host. We want the strictest practical policy:
`script-src 'self'; style-src 'self'` with no `'unsafe-inline'`, no nonces and no hashes.

- Nonces need a server to rewrite every response; prerendered HTML has no per-request step.
- Hashes (`kit.csp.mode: 'hash'`) work for scripts but must be recomputed on every build and
  copied into every host's header configuration, and `style-src` hashes do not cover `style=`
  attributes at all (that needs `'unsafe-hashes'`).
- SvelteKit emits one inline `<script>` per page that boots the client, and Vite may inline
  small CSS files into `<style>` blocks.

## Decision

- **Externalize the bootstrap script.** A post-build step (owned by the frontend) moves each
  page's inline bootstrap `<script>` into a content-hashed file under `_app/immutable/` and
  replaces it with `<script type="module" src="…">`. The build fails if any inline `<script>`
  remains in the output.
- **No inline styles.** `kit.inlineStyleThreshold: 0` so all CSS ships as files. Components set
  dynamic values (card colors, progress widths) through classes or CSSOM
  (`element.style.setProperty`, which CSP does not block), never through `style="…"` in markup
  or `{@html}`. The build check also rejects `<style>` elements and `style=` attributes in
  prerendered HTML.
- **One header set everywhere.** The policy comes from `packages/security`
  (`contentSecurityPolicy()`): `default-src 'none'` plus `'self'` for script, style, img, font,
  connect and manifest; `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`, `worker-src 'none'`. The Worker, the Node server and the generated
  `_headers` file all use it.
- `connect-src` lists only `'self'` (plus an explicitly configured WebSocket origin when the API
  lives elsewhere).

## Consequences

- XSS through injected markup cannot execute script or load third-party resources even if an
  escaping bug slips through; injected `style=` attributes are inert.
- The build gains a small post-processing step and a check that must stay in CI.
- Libraries that inject `<style>` at runtime are ruled out; this matches the "no UI framework"
  decision.
- Upgrading SvelteKit can change the bootstrap markup; the build check catches regressions.
