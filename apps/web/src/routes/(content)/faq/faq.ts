/** FAQ content. Rendered on /faq and used for its FAQPage JSON-LD. Mirrors docs/FAQ.md. */
export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ: FaqGroup[] = [
  {
    id: 'general',
    title: 'General',
    items: [
      {
        q: 'What is Backlogfit?',
        a: 'Backlogfit is a free, open-source tool for story point estimation. A facilitator creates a room, shares a link, and the team votes on backlog items with cards, reveals the votes together and agrees on a final estimate. It supports the planning poker technique as well as T-shirt sizing and custom scales.',
      },
      {
        q: 'Is it really free? What is the catch?',
        a: 'It is free and open source under the Apache-2.0 license. There are no paid tiers, no ads and no data collection. You can use backlogfit.com or run your own copy.',
      },
      {
        q: 'Do participants need an account or to sign up?',
        a: 'No. Nobody signs up, including the facilitator. Participants open the join link, type a display name and start voting.',
      },
      {
        q: 'How many people can join a room?',
        a: 'Up to 50 participants by default. Self-hosted instances can change the limit with the MAX_PARTICIPANTS setting.',
      },
      {
        q: 'Which card decks are available?',
        a: 'Fibonacci (0, 1, 2, 3, 5, 8, 13, 21), modified Fibonacci (0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100), powers of two, linear 1–10, T-shirt sizes (XS to XXL) and fully custom decks. Optional special cards: ? (not sure), coffee (I need a break) and ∞ (too big to estimate).',
      },
      {
        q: 'Is Backlogfit a scrum poker or planning poker app?',
        a: 'It is an estimation tool built around the same idea: everyone estimates privately, then all estimates are revealed at once to avoid anchoring. Planning poker is the name of the technique; Backlogfit is an independent implementation with extra facilitation and privacy features.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and security',
    items: [
      {
        q: 'What data does Backlogfit store?',
        a: 'Only what a live room needs: the room settings, the task list, display names and votes. Room secrets are stored as hashes. When a room expires or the facilitator closes it, all of it is deleted. There are no accounts, cookies, analytics or third-party scripts.',
      },
      {
        q: 'How long does a room last?',
        a: 'The facilitator chooses 1, 2, 4 or 8 hours (default 2 hours). A room also closes after 30 minutes without activity. The facilitator can extend it up to the maximum.',
      },
      {
        q: 'Can the facilitator or the server see my vote before the reveal?',
        a: 'No. Until the votes are revealed, the server only tells others that you voted, never what you voted. This is enforced in one place in the code and checked with automated property tests.',
      },
      {
        q: 'Why do room links contain a # sign?',
        a: 'The part after # is the URL fragment. Browsers never send it to servers, so the room secrets in it do not show up in server logs, proxies or Referer headers. Treat a join link like a meeting password, and keep the admin link to yourself.',
      },
      {
        q: 'Is it suitable for banks and other regulated companies?',
        a: 'It was designed for strict environments: no accounts, no personal data beyond a display name, no third-party requests, a strict Content Security Policy, short-lived rooms with automatic deletion, signed container images with SBOMs, and a public threat model. Teams in regulated industries can also self-host it inside their own network.',
      },
      {
        q: 'Can I paste Jira or other tracker links?',
        a: 'Yes. The facilitator chooses a link policy: task IDs only (for example PROJ-123), any links, or only links to an allowlist of your own hosts. Backlogfit never fetches the links; it only shows the text you paste.',
      },
    ],
  },
  {
    id: 'self-hosting',
    title: 'Self-hosting',
    items: [
      {
        q: 'Can I self-host Backlogfit?',
        a: 'Yes. Run the container image ghcr.io/sinet2000/backlogfit with Podman or Docker, or deploy the Cloudflare Worker version to your own account.',
      },
      {
        q: 'Does the self-hosted version need a database?',
        a: 'No. It uses the SQLite engine built into Node.js, stored in the /data volume of the container (DATA_DIR), or only in memory if DATA_DIR is empty. Nothing else is required.',
      },
      {
        q: 'Does it work in an air-gapped network?',
        a: 'The container makes no outbound requests and serves its own fonts and assets, so it works in isolated networks as long as participants can reach the server.',
      },
    ],
  },
  {
    id: 'using',
    title: 'Using it',
    items: [
      {
        q: 'What happens when votes are split?',
        a: 'Backlogfit shows the distribution, median and a consensus indicator. A good practice is to let the people with the highest and lowest estimates explain their reasoning, then re-vote. Each round is kept in the history.',
      },
      {
        q: 'Can someone join only to watch?',
        a: 'Yes, as a spectator, unless the facilitator has disabled spectators.',
      },
      {
        q: 'Can I export the results?',
        a: 'Yes, as CSV, JSON, Markdown or a plain-text summary. Exports are created in your browser.',
      },
      {
        q: 'Is Backlogfit accessible?',
        a: 'It supports full keyboard use (number keys to vote, Space to reveal, N for the next task), screen readers, light, dark and high-contrast modes, and reduced motion.',
      },
    ],
  },
];
