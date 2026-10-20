#!/bin/sh
# Run Playwright inside the official Linux image (same as CI), with the app server started inside
# the container from the mounted repo. Linux snapshots for the visual project come from here.
#
#   tests/e2e/scripts/in-container.sh --project=visual                       # compare
#   tests/e2e/scripts/in-container.sh --project=visual --update-snapshots    # regenerate
#
# Requires: podman (or CONTAINER=docker), a host `pnpm install`, and a web build
# (`pnpm --filter @backlogfit/web build`, done here unless E2E_SKIP_BUILD=1).
set -eu

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
IMAGE=${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-noble}
ENGINE=${CONTAINER:-podman}

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  (cd "$ROOT" && pnpm --filter @backlogfit/web build)
fi

exec "$ENGINE" run --rm --ipc=host \
  -v "$ROOT":/work -w /work/tests/e2e \
  -e CI="${CI:-}" \
  -e E2E_SKIP_BUILD=1 \
  -e E2E_NO_FAST="${E2E_NO_FAST:-1}" \
  -e E2E_SERVER_CMD="node --disable-warning=ExperimentalWarning /work/apps/server/src/main.ts" \
  "$IMAGE" \
  node node_modules/@playwright/test/cli.js test "$@"
