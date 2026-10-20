# Contributing to Backlogfit

Thanks for your interest in improving Backlogfit. This guide explains how to set up the
project, what we expect from a pull request, and the legal bits.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues must **not** be reported in public issues; see [SECURITY.md](SECURITY.md).

## Developer Certificate of Origin (DCO)

Every commit must be signed off. By signing off you certify the
[Developer Certificate of Origin 1.1](https://developercertificate.org/): that you wrote the
change or otherwise have the right to submit it under the project's license (Apache-2.0).

```sh
git commit -s -m "fix(core): handle empty scale"
```

This adds a `Signed-off-by: Your Name <you@example.com>` trailer using your git identity. CI
rejects pull requests containing commits without it. To fix the last commit, run
`git commit --amend -s --no-edit`; for several commits, `git rebase --signoff main`.

## Original work only

Do not copy code, text, card artwork or other assets from other planning poker or estimation
projects, whatever their license. Backlogfit is an independent implementation; contributions
must be your own work (or clearly attributed material under a compatible license, discussed in
the pull request first).

## Development setup

Requirements: Node 24 (see `.nvmrc`) and pnpm 11 (the exact version is in `package.json`
`packageManager`). Podman or Docker is optional, for the container image.

```sh
git clone https://github.com/Sinet2000/backlogfit.git
cd backlogfit
pnpm install
pnpm dev        # API server on :8080 + web app with hot reload on :5173
```

Before pushing:

```sh
pnpm verify     # biome lint + typecheck + unit tests
pnpm build
pnpm e2e        # Playwright end-to-end tests (install browsers once: pnpm exec playwright install --with-deps)
```

`pnpm test:all` runs all of it plus the visual snapshots in the Linux Playwright container.

`pnpm format` applies Biome formatting.

## Repository layout

| Path | Contents |
|---|---|
| `packages/core` | pure room logic: schemas, reducer, projections, stats, task parsing |
| `packages/security` | security headers/CSP, rate limiter, limits |
| `apps/web` | SvelteKit front end and content pages |
| `apps/worker` | Cloudflare Worker + Durable Object backend |
| `apps/server` | Node backend and Containerfile |
| `tests/e2e`, `tests/load` | Playwright and load tests |
| `docs/` | protocol, ADRs, security docs, guides |

Room behavior changes go through `packages/core` (see [ADR-0001](docs/adr/0001-pure-reducer-core.md));
the backends are thin adapters and must not re-implement rules.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`,
with a short, imperative, lower-case subject.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style`.
- Scopes (optional): `core`, `security`, `web`, `worker`, `server`, `e2e`, `deps`.
- Examples: `feat(web): add high-contrast theme`, `fix(server): close sockets on shutdown`.
- Keep commits small and focused. Mark breaking changes with `!` and a `BREAKING CHANGE:` footer.

## Pull requests

- One topic per pull request. Link the related issue.
- **Tests are required**: new behavior needs tests; bug fixes need a test that fails without
  the fix. Changes to room logic should include a property test where it makes sense.
- Keep the privacy invariants intact: no vote values before reveal, no secrets outside the URL
  fragment, no logging of request data, no third-party requests from the web app.
- New dependencies need a justification in the owning `docs/dependencies/<pkg>.md` (purpose,
  license, why not an alternative). Pin exact versions.
- Update docs and `CHANGELOG.md` (under "Unreleased") for user-visible changes.
- CI must be green: lint, typecheck, unit, build, e2e, DCO, CodeQL and security scans.

## Reporting bugs and requesting features

Use the issue forms on GitHub. Please include steps to reproduce, the browser, and whether you
use backlogfit.com or a self-hosted instance. Never paste room links: they contain secrets.

## License

Backlogfit is licensed under the [Apache License 2.0](LICENSE). Contributions are accepted
under the same license (inbound = outbound), as certified by your DCO sign-off.
