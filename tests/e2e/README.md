# Backlogfit end-to-end tests

Playwright (multi-user, wire privacy, protocol, security), axe accessibility, visual regression,
and the screenshot/OG image generator. The WebSocket load test lives in `tests/load`.

## Run

```sh
pnpm install
pnpm --filter @backlogfit/e2e install-browsers   # chromium, firefox, webkit (once)
pnpm e2e                                         # = pnpm --filter @backlogfit/e2e e2e
```

`playwright.config.ts` builds the web app (`pnpm --filter @backlogfit/web build`) and starts two
Node servers, or reuses them if they are already listening:

| URL | env | used by |
|---|---|---|
| `http://localhost:8080` | `NODE_ENV=test PUBLIC_ORIGIN=http://localhost:8080 ROOM_CREATE_PER_MIN=10000 MAX_ROOMS=5000` | all specs |
| `http://localhost:8081` | same + `TEST_TIME_SCALE=60` (1 room minute per second) | idle / hard expiry specs |

Useful subsets:

```sh
pnpm --filter @backlogfit/e2e e2e:chromium            # everything except visual, Chromium
pnpm --filter @backlogfit/e2e e2e:smoke               # @smoke subset in Firefox + WebKit
pnpm --filter @backlogfit/e2e exec playwright test specs/privacy.spec.ts
pnpm --filter @backlogfit/e2e test                    # unit tests of the fixtures (no browser)
```

On a shared machine (other agents/devs running Backlogfit on :8080), use private ports so a
foreign server is not reused:
`E2E_BASE_URL=http://localhost:18080 E2E_FAST_URL=http://localhost:18081 pnpm e2e`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:8080` | app under test |
| `E2E_FAST_URL` | `http://localhost:8081` | fast-clock server |
| `E2E_FAST_TIME_SCALE` | `60` | must match the fast server's `TEST_TIME_SCALE` |
| `E2E_NO_SERVER=1` | | do not start servers (testing a running deployment) |
| `E2E_NO_FAST=1` | | no fast server; expiry specs skip |
| `E2E_SKIP_BUILD=1` | | start the server without building the web app first |
| `E2E_BUILD_CMD` / `E2E_SERVER_CMD` | pnpm filters | override build/start commands |
| `E2E_STRICT_CSP=1` | | also fail on CSP violations from known, filed bugs (see `fixtures/test.ts`) |
| `E2E_VISUAL=1` | | run the visual project on a non-Linux host (snapshots will not match) |

## What every spec checks implicitly

The `guard` fixture (fixtures/test.ts) watches every browser context a spec opens (the default
page and each participant): any request to an origin other than the app's, or any
`securitypolicyviolation`, fails the spec at teardown. Each participant gets a **new browser
context** (`people.join(link, name)`), so sessionStorage, resume tokens and secrets are isolated.

## Layout

| Path | Contents |
|---|---|
| `fixtures/api.ts` | `createRoomApi()`: fast room creation via `POST /api/rooms` with `@backlogfit/core` hashing |
| `fixtures/ui.ts` | `createRoom(page, opts)` via the `/new` configurator, `submitJoin`, card/participant helpers (only `data-testid`s from apps/web/TESTIDS.md) |
| `fixtures/test.ts` | `test` with `guard`, `people` (one context per participant) and `wire` fixtures |
| `fixtures/wire.ts`, `fixtures/privacy.ts` | WebSocket frame capture and the structural "no foreign vote before reveal" checker (unit tested in `unit/`) |
| `fixtures/raw.ts` | raw protocol clients running inside a page (real Origin, real CSP) |
| `specs/` | session, privacy, voting, access, lifecycle, tasks, security, protocol |
| `a11y/` | axe (serious/critical = fail) per page/state × theme × mode, keyboard-only flows, reduced motion |
| `visual/` | `toHaveScreenshot` for deck, selected card, revealed card, reveal panel × theme × mode × desktop/375 px |
| `screenshots/` | `pnpm --filter @backlogfit/e2e screenshots` → `artifacts/screenshots/*.png` (1440×900, light Corporate) and `artifacts/og/*.png` (1200×630 from `og/template.html`) |

## Visual snapshots

Snapshots are platform-specific and are generated **only** in the official Linux image, so they
match CI. The `visual` project exists only on Linux (or with `E2E_VISUAL=1`). Snapshots live
next to the spec in `visual/__snapshots__/cards.spec.ts/*-linux.png`.

```sh
# compare (as CI does)
tests/e2e/scripts/in-container.sh --project=visual
# regenerate after an intended UI change, then review the PNG diff in git
tests/e2e/scripts/in-container.sh --project=visual --update-snapshots
```

The script builds the web app on the host, mounts the repo into
`mcr.microsoft.com/playwright:v1.64.1-noble` (Podman by default, `CONTAINER=docker` works) and
starts the server inside the container. Animations are disabled and data is fixed (names, task,
votes), so snapshots are deterministic. Note: snapshots generated on an arm64 host (Apple Silicon)
can differ from x86_64 CI by a few anti-aliased pixels; `maxDiffPixelRatio` is 0.002. If CI
reports diffs that are pure anti-aliasing, regenerate in CI (see below) and commit the artifacts.

## CI (GitHub Actions, for A6)

Two jobs. Pin actions by SHA as for the rest of the workflows.

```yaml
e2e:
  runs-on: ubuntu-24.04
  container:
    image: mcr.microsoft.com/playwright:v1.64.1-noble
    options: --ipc=host
  env:
    CI: "1"
  steps:
    - uses: actions/checkout@<sha>
    - uses: pnpm/action-setup@<sha>          # reads packageManager from package.json
    - uses: actions/setup-node@<sha>
      with: { node-version-file: .nvmrc, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm e2e                          # chromium + firefox/webkit smoke + visual (linux)
    - if: failure()
      uses: actions/upload-artifact@<sha>
      with: { name: playwright-report, path: tests/e2e/playwright-report, retention-days: 7 }

load:
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@<sha>
    - uses: pnpm/action-setup@<sha>
    - uses: actions/setup-node@<sha>
      with: { node-version-file: .nvmrc, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: |
        NODE_ENV=test PUBLIC_ORIGIN=http://localhost:8080 ROOM_CREATE_PER_MIN=10000 \
          pnpm --filter @backlogfit/server start &
        until curl -fs http://localhost:8080/api/health; do sleep 1; done
        pnpm --filter @backlogfit/load load -- --rooms 20 --clients 20 --json load.json
```

Browsers are already in the image (`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`), so no
`playwright install` step is needed inside the container. Outside the container use
`pnpm --filter @backlogfit/e2e exec playwright install --with-deps chromium firefox webkit`
and set `E2E_VISUAL` unset (the visual project then still runs on Linux runners, but snapshots
were made in the image, so prefer the container job).

To refresh snapshots from CI: run the job with
`pnpm --filter @backlogfit/e2e exec playwright test --project=visual --update-snapshots` and
download `tests/e2e/visual/__snapshots__` as an artifact.

## Screenshots and OG images

```sh
pnpm --filter @backlogfit/e2e screenshots
```

Writes `artifacts/screenshots/` (landing, configurator steps, voter, reveal, admin views,
results) and `artifacts/og/` (`og-default.png`, `og-planning-poker-alternative.png`,
`og-guide.png`, `og-faq.png`, `og-story-points.png`). OG text lives in
`screenshots/og.shot.ts`; the template is `og/template.html` (self-contained, no external fonts).
