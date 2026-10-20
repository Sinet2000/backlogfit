# Backlogfit FAQ

This file mirrors the FAQ page at <https://backlogfit.com/faq>.

## General

### What is Backlogfit?

Backlogfit is a free, open-source tool for story point estimation. A facilitator creates a
room, shares a link, and the team votes on backlog items with cards, reveals the votes together
and agrees on a final estimate. It supports the planning poker technique as well as T-shirt
sizing and custom scales.

### Is it really free? What is the catch?

It is free and open source under the Apache-2.0 license. There are no paid tiers, no ads and no
data collection. You can use backlogfit.com or run your own copy.

### Do participants need an account or to sign up?

No. Nobody signs up, including the facilitator. Participants open the join link, type a
display name and start voting.

### How many people can join a room?

Up to 50 participants by default. Self-hosted instances can change the limit with
`MAX_PARTICIPANTS`.

### Which card decks are available?

Fibonacci (0, 1, 2, 3, 5, 8, 13, 21…), modified Fibonacci (0, ½, 1, 2, 3, 5, 8, 13, 20, 40,
100), powers of two (0, 1, 2, 4 … 64), linear 1–10, T-shirt sizes (XS–XXL) and fully custom
decks. Optional special cards:
`?` (not sure), coffee (I need a break) and `∞` (too big to estimate).

### Is Backlogfit a scrum poker or planning poker app?

It is an estimation tool that supports the same idea: everyone estimates privately, then
all estimates are revealed at once to avoid anchoring. "Planning poker" is the name of the
technique; Backlogfit is an independent implementation with extra facilitation and privacy
features.

## Privacy and security

### What data does Backlogfit store?

Only what a live room needs: the room settings, the task list, display names and votes. The
room secrets are stored as hashes. When a room expires or the facilitator closes it, all of
it is deleted. There are no accounts, cookies, analytics or third-party scripts.

### How long does a room last?

The facilitator chooses 1, 2, 4 or 8 hours (default 2 hours). A room also closes after 30
minutes without activity. The facilitator can extend it up to the maximum.

### Can the facilitator or the server see my vote before the reveal?

No. Until the votes are revealed, the server only tells others *that* you voted, never *what*
you voted. This is enforced in one place in the code and checked with automated property tests.

### Why do links look like `/r#…`?

The part after `#` is the URL fragment. Browsers never send it to servers, so the room secrets
in it do not show up in server logs, proxies or `Referer` headers. Treat a join link like a
meeting password, and keep the admin link to yourself.

### Is it suitable for banks and other regulated companies?

It was designed for strict environments: no accounts, no personal data beyond a display name,
no third-party requests, strict Content Security Policy, short-lived rooms with automatic
deletion, signed container images with SBOMs, and a public threat model. Many teams in
regulated industries self-host it inside their own network. Your security team can review the
[threat model](security/THREAT_MODEL.md) and [privacy notes](security/PRIVACY.md).

### Can I paste Jira or other tracker links?

Yes. The facilitator chooses a link policy: task IDs only (for example `PROJ-123`), any links,
or only links to an allowlist of your own hosts. Links are never fetched by Backlogfit; only
the text you paste is shown.

## Self-hosting

### Can I self-host Backlogfit?

Yes. Run the container image `ghcr.io/sinet2000/backlogfit` with Podman or Docker, or deploy the
Cloudflare Worker version to your own account. See [SELF_HOSTING.md](security/SELF_HOSTING.md).

### Does the self-hosted version need a database?

No. It uses the SQLite engine built into Node.js, which keeps rooms in memory by default;
set `DATA_DIR` (for example to a `/data` volume) if rooms should survive restarts. Nothing else is required.

### Does it work offline or in an air-gapped network?

The container makes no outbound requests and serves its own fonts and assets, so it works in
isolated networks as long as participants can reach the server.

## Using it

### What happens when votes are split?

Backlogfit shows the distribution, median and a consensus indicator. A good practice is to let
the people with the highest and lowest estimates explain their reasoning, then re-vote. Each
round is kept in the history.

### Can someone join only to watch?

Yes, as a spectator, unless the facilitator has disabled spectators.

### Can I export the results?

Yes, as CSV, JSON, Markdown or a plain-text summary. Exports are created in your browser.

### Is Backlogfit accessible?

It supports full keyboard use (number keys to vote, Space to reveal, N for the next task),
screen readers, light, dark and high-contrast modes, and reduced motion.
