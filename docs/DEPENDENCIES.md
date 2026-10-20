# Dependencies

Backlogfit keeps its dependency tree small. Every direct dependency is pinned to an exact
version and justified (purpose, license, why not an alternative) in a file owned by the
package that uses it. This page is the index.

| Package | Notes |
|---|---|
| `@backlogfit/core` (`packages/core`) | [dependencies/core.md](dependencies/core.md) |
| `@backlogfit/security` (`packages/security`) | [dependencies/security.md](dependencies/security.md) |
| `@backlogfit/host` (`packages/host`) | [dependencies/host.md](dependencies/host.md) |
| `@backlogfit/web` (`apps/web`) | [dependencies/web.md](dependencies/web.md) |
| `@backlogfit/worker` (`apps/worker`) | [dependencies/worker.md](dependencies/worker.md) |
| `@backlogfit/server` (`apps/server`) | [dependencies/server.md](dependencies/server.md) |
| `@backlogfit/e2e`, `@backlogfit/load` (`tests/e2e`, `tests/load`) | [dependencies/qa.md](dependencies/qa.md) |
| Workspace root (tooling) | see below |

## Workspace root

| Package | Version | License | Purpose |
|---|---|---|---|
| `@biomejs/biome` | 2.5.15 | MIT OR Apache-2.0 | Linting and formatting for TS, JS, JSON and CSS in one fast tool. |
| `typescript` | 6.0.3 | Apache-2.0 | Type checking (strict). |

## Vendored assets

| Asset | License | Location |
|---|---|---|
| Inter typeface | SIL OFL 1.1 | `apps/web/static/fonts/` (see [NOTICE](../NOTICE)) |

## CI and release tooling

GitHub Actions are pinned by commit SHA in [`.github/workflows`](../.github/workflows) and
updated by Dependabot. Tools downloaded in CI (gitleaks, Trivy, cosign) are pinned by version,
and gitleaks additionally by SHA-256. See [RELEASING.md](RELEASING.md).

## Policy

- Exact versions only, no ranges; `pnpm install --frozen-lockfile` in CI.
- Install scripts are disabled by default; only packages listed under `allowBuilds` in
  `pnpm-workspace.yaml` may run them.
- No UI, CSS or icon frameworks; no runtime requests to third-party hosts.
- New dependencies need an entry in the owning `docs/dependencies/<pkg>.md` file.
- OSV-Scanner, `pnpm audit --prod` and Dependabot run continuously; the release image is scanned
  with Trivy and ships with CycloneDX SBOMs.
