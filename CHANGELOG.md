# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Prepare the task list in the configurator and put it in order before the session starts.
- Reorder tasks by drag and drop in the room, estimate any task right away, and add a task
  with "Add and estimate now" during the discussion.

### Changed

- Session rules are grouped into Time, Voting and Who can join; field heights are aligned.

## [0.1.0] - 2026-10-20

First public release.

### Added

- Estimation rooms without accounts: share a join link or QR code, vote privately, reveal
  together, vote again with history, and record a final estimate.
- Card decks: Fibonacci, modified Fibonacci, T-shirt sizes, powers of two, linear 1–10 and
  custom decks, with `?`, coffee and `∞` cards and a colorblind-safe palette.
- Four-step session configurator with live preview and preset files (save/load, local only).
- Host controls: task list from IDs or links with a link policy (IDs only, any links, or an
  allowlist), next task, automatic reveal, timer, co-hosts, spectators, approval before joining,
  passcode, lock, remove participant, extend and end session.
- Statistics (median, most common, average, range, distribution, agreement) and CSV, JSON,
  Markdown, summary and print exports generated in the browser.
- Privacy model: secrets only in the URL fragment, hashes only on the server, no vote values sent
  before the reveal, anonymous results option, automatic deletion on expiry or idle timeout.
- Security: strict CSP without inline code, security headers, rate and connection limits, origin
  checks, strict message validation.
- Backends: Cloudflare Worker with one Durable Object per room, and a Node 24 server
  (`node:sqlite`, in memory by default) shipped as a distroless, non-root container image.
- Accessibility: keyboard shortcuts, screen-reader support, light, dark and high-contrast modes,
  reduced motion.
- Content pages, FAQ, guides and Manager Guide; threat model, privacy and self-hosting docs.
- CI: lint, typecheck, unit, Playwright end-to-end, accessibility and visual tests, CodeQL,
  OSV-Scanner, gitleaks, `pnpm audit`, OpenSSF Scorecard; signed releases with SBOMs and
  provenance.

[Unreleased]: https://github.com/Sinet2000/backlogfit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Sinet2000/backlogfit/releases/tag/v0.1.0
