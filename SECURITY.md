# Security policy

Backlogfit is designed for teams in regulated environments, so we take vulnerability reports
seriously and handle them privately.

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub Security Advisories:

1. Go to <https://github.com/Sinet2000/backlogfit/security/advisories/new>
   (repository **Security** tab → **Report a vulnerability**).
2. Describe the issue, affected version or commit, deployment (backlogfit.com, Cloudflare
   Worker or container), steps to reproduce, and the impact you expect.

Do **not** open a public issue, pull request or discussion for security problems, and do not
include real room links (they contain secrets). We do not accept reports by email.

## What to expect

| Step | Target |
|---|---|
| Acknowledgement of your report | within 3 business days |
| Initial assessment and severity (CVSS) | within 7 days |
| Fix for Critical / High severity | within 30 days |
| Fix for Medium / Low severity | next scheduled release, within 90 days |
| Public advisory | after a fix is released, coordinated with you |

We will keep you updated in the advisory thread, credit you in the advisory if you wish, and
request a CVE where appropriate. If a deadline cannot be met, we will tell you why.

## Supported versions

| Version | Supported |
|---|---|
| Latest minor release (`0.1.x` today) | Yes |
| `main` branch / backlogfit.com | Yes |
| Older releases | No; please upgrade |

Container images are signed with cosign (keyless) and ship with a CycloneDX SBOM and build
provenance. See [docs/RELEASING.md](docs/RELEASING.md) for how to verify them.

## Scope

In scope: the web app, both backends (`apps/worker`, `apps/server`), `packages/*`, the
container image and the release pipeline. Of particular interest: leaking vote values before
reveal, bypassing room secrets or roles, secrets reaching servers or logs, CSP bypasses,
denial of service with small inputs, and supply-chain issues.

Out of scope: volumetric DDoS, findings that require a compromised device or browser, missing
hardening on a self-hosted instance that contradicts [docs/security/SELF_HOSTING.md](docs/security/SELF_HOSTING.md),
and reports produced by automated scanners without a demonstrated impact.

## Safe harbor

We will not pursue legal action for good-faith research that respects this policy: test only
against your own rooms or a local/self-hosted instance, do not access other people's data,
and do not degrade service for others.

Background reading: [Threat model](docs/security/THREAT_MODEL.md),
[Privacy](docs/security/PRIVACY.md).
