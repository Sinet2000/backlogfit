# ADR-0009: Self-hosted fonts and assets, zero third-party requests

- Status: Accepted
- Date: 2026-10-20

## Context

Loading fonts or icons from a CDN (Google Fonts, jsDelivr) leaks every visitor's IP address and
the page they open to a third party, needs `font-src`/`style-src` exceptions in the CSP
(ADR-0006), and makes the app depend on that CDN being reachable (air-gapped self-hosting).

## Decision

- Fonts (Inter, SIL OFL-1.1) are vendored as WOFF2 files in the web app's static assets, with
  their license text, subset to Latin + Latin Extended, and declared with `@font-face` in a
  bundled stylesheet using `font-display: swap`. A system font stack is the fallback.
- Icons are inline SVG Svelte components; no icon font or icon library.
- The QR code is generated locally (`qrcode-generator`), never through an image API.
- OG images and guide screenshots are pre-rendered files in the repository.
- The CSP stays `'self'`-only for fonts, images, scripts and styles; any third-party URL in
  the build output is a bug. A build check greps the output for absolute `http(s)://` asset
  references outside an allowlist (canonical links, documentation links).

## Consequences

- Zero third-party requests on page load; the self-hosted image works fully offline.
- Font updates are manual (download, subset, commit, update NOTICE). That is rare and reviewed.
- The repository carries a few hundred KB of binary font files.
