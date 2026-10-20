# Releasing Backlogfit

Releases are cut from `main` by pushing a signed, annotated tag `vX.Y.Z`. Everything after the
tag push is automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## 1. Prepare

1. Make sure `main` is green (CI, CodeQL, security scans) and there are no open High/Critical
   security findings.
2. Update `CHANGELOG.md`: move the entries under `## [Unreleased]` into a new section
   `## [X.Y.Z] - YYYY-MM-DD`, and update the compare links at the bottom. The release workflow
   fails if the section for the tagged version is missing; its body becomes the release notes.
3. Bump `version` in the workspace `package.json` files if needed.
4. Commit: `git commit -s -m "chore: release vX.Y.Z"` and merge it to `main` through a pull request.

## 2. Tag

```sh
git switch main && git pull --ff-only
git tag -s vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Tags containing `-` (for example `v0.2.0-rc.1`) are published as pre-releases and do not move
the `latest` image tag.

## 3. What the workflow does

1. Installs with `pnpm install --frozen-lockfile`, runs `pnpm verify` and `pnpm build`.
2. Generates a CycloneDX SBOM of the pnpm workspace with Trivy (`backlogfit-workspace.cdx.json`).
3. Builds the container image from `apps/server/Containerfile` (context: repository root) for
   `linux/amd64` and scans it with Trivy. **Any fixable HIGH or CRITICAL vulnerability fails
   the release** before anything is pushed.
4. Builds and pushes `ghcr.io/sinet2000/backlogfit` for `linux/amd64` and `linux/arm64`, tagged
   `X.Y.Z`, `X.Y` and `latest`, with BuildKit provenance (`mode=max`) and SBOM attestations.
5. Generates a CycloneDX SBOM of the pushed image (`backlogfit-image.cdx.json`).
6. Creates GitHub artifact attestations for build provenance and the image SBOM
   (`actions/attest-build-provenance`, `actions/attest-sbom`), pushed to the registry.
7. Signs the image digest with cosign keyless signing (Sigstore, GitHub OIDC).
8. Creates the GitHub release with the CHANGELOG section as notes and both SBOMs attached.

## 4. Verify a release

```sh
IMAGE=ghcr.io/sinet2000/backlogfit
DIGEST=sha256:...   # from the release notes

# Signature
cosign verify "$IMAGE@$DIGEST" \
  --certificate-identity-regexp '^https://github.com/Sinet2000/backlogfit/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# Provenance attestation
gh attestation verify "oci://$IMAGE@$DIGEST" --repo Sinet2000/backlogfit
```

Always deploy by digest (`$IMAGE@sha256:...`) in regulated environments.

## 5. If something fails

- Trivy finds a vulnerability: update the base image or dependency on `main`, then tag a new
  patch version. Never re-use or move a published tag.
- The workflow fails after pushing the image: fix the cause and re-run the failed job; image
  pushes are idempotent for the same digest. If the release must be abandoned, delete the
  draft release (if any) and publish the next patch version instead.

## Supply-chain notes

- All third-party actions are pinned by full commit SHA with a `# vX.Y.Z` comment; Dependabot
  proposes updates weekly.
- Every job declares least-privilege `permissions`; checkout never persists credentials.
- The Trivy version used by `trivy-action` is pinned in the workflow (`TRIVY_VERSION`).
