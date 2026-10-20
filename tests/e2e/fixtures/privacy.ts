/**
 * Structural checks on server → client frames. Pure (no Playwright import) so it is unit tested
 * in `pnpm test`.
 *
 * The invariant (PROTOCOL.md §6): before reveal, a frame received by viewer V may contain no vote
 * value except V's own `myVote`. We check the structure, not substrings: card values such as "5"
 * legitimately appear in `config.scale`.
 */

export interface FrameViolation {
  frameIndex: number;
  path: string;
  detail: string;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const PARTICIPANT_KEYS = new Set([
  'id',
  'name',
  'role',
  'authority',
  'team',
  'connected',
  'hasVoted',
]);
const ROUND_KEYS = new Set(['n', 'revealed', 'anonymous', 'voteCount', 'votes', 'stats', 'teams']);
/** Keys that carry a vote value somewhere in a RoomView. */
const VOTE_CARRIERS = new Set(['votes', 'myVote', 'vote', 'value', 'distribution', 'stats']);

function isObj(x: Json | undefined): x is { [k: string]: Json } {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Return the RoomView carried by a frame (welcome/state), or null. */
export function roomOf(frame: Json): { [k: string]: Json } | null {
  if (!isObj(frame)) return null;
  if ((frame.type === 'welcome' || frame.type === 'state') && isObj(frame.room)) return frame.room;
  return null;
}

/**
 * Check one RoomView. `ownVotes` are the values the viewer itself cast (any round); `myVote`
 * may only ever be one of those (or null).
 */
export function checkRoomView(
  room: { [k: string]: Json },
  ownVotes: ReadonlySet<string>,
  frameIndex = 0,
): FrameViolation[] {
  const out: FrameViolation[] = [];
  const bad = (path: string, detail: string) => out.push({ frameIndex, path, detail });

  const myVote = room.myVote;
  if (myVote !== null && myVote !== undefined) {
    if (typeof myVote !== 'string' || !ownVotes.has(myVote)) {
      bad('myVote', `myVote ${JSON.stringify(myVote)} is not a vote this viewer cast`);
    }
  }

  const participants = room.participants;
  if (Array.isArray(participants)) {
    participants.forEach((p, i) => {
      if (!isObj(p)) return;
      for (const k of Object.keys(p)) {
        if (!PARTICIPANT_KEYS.has(k)) bad(`participants[${i}].${k}`, 'unexpected participant key');
      }
    });
  }

  const tasks = room.tasks;
  if (Array.isArray(tasks)) {
    tasks.forEach((t, ti) => {
      if (!isObj(t) || !Array.isArray(t.rounds)) return;
      t.rounds.forEach((r, ri) => {
        if (!isObj(r)) return;
        const path = `tasks[${ti}].rounds[${ri}]`;
        for (const k of Object.keys(r)) {
          if (!ROUND_KEYS.has(k)) bad(`${path}.${k}`, 'unexpected round key');
        }
        if (r.revealed === true) return;
        if (r.votes !== null) bad(`${path}.votes`, 'votes present before reveal');
        if (r.stats !== null) bad(`${path}.stats`, 'stats present before reveal');
        if (r.teams !== null && r.teams !== undefined) {
          bad(`${path}.teams`, 'team summary present before reveal');
        }
      });
    });
  }

  // Anything else that smells like a vote outside the known places.
  const walk = (node: Json, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((x, i) => {
        walk(x, `${path}[${i}]`);
      });
      return;
    }
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (p === 'config' || p === 'myVote' || /^tasks\[\d+\]\.rounds$/.test(p)) continue;
      if (VOTE_CARRIERS.has(k) && v !== null) bad(p, `unexpected vote-like key "${k}"`);
      walk(v, p);
    }
  };
  walk(room, '');
  return out;
}

/** Check every frame a viewer received. Unparseable frames are reported too. */
export function checkFrames(
  frames: readonly string[],
  ownVotes: ReadonlySet<string>,
): FrameViolation[] {
  const out: FrameViolation[] = [];
  frames.forEach((raw, i) => {
    let parsed: Json;
    try {
      parsed = JSON.parse(raw) as Json;
    } catch {
      out.push({ frameIndex: i, path: '', detail: 'frame is not JSON' });
      return;
    }
    const room = roomOf(parsed);
    if (room) out.push(...checkRoomView(room, ownVotes, i));
  });
  return out;
}

/** All vote values visible to the viewer in revealed rounds, by name (for post-reveal checks). */
export function revealedVotes(room: {
  [k: string]: Json;
}): { task: string; round: number; name: string | null; value: string }[] {
  const out: { task: string; round: number; name: string | null; value: string }[] = [];
  if (!Array.isArray(room.tasks)) return out;
  for (const t of room.tasks) {
    if (!isObj(t) || !Array.isArray(t.rounds)) continue;
    for (const r of t.rounds) {
      if (!isObj(r) || r.revealed !== true || !Array.isArray(r.votes)) continue;
      for (const v of r.votes) {
        if (!isObj(v)) continue;
        out.push({
          task: String(t.id),
          round: Number(r.n),
          name: typeof v.name === 'string' ? v.name : null,
          value: String(v.value),
        });
      }
    }
  }
  return out;
}
