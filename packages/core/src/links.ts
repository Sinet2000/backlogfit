/**
 * Room link fragments (ADR-0002, ADR-0008). Everything secret lives after `#`, which browsers
 * never send to servers:
 *
 *   join:  #<roomId>.<joinSecret>[~<contentKey>][@<teamId>]
 *   admin: #<roomId>.<joinSecret>.<adminSecret>[~<contentKey>]
 *
 * `contentKey` is the Phase 2 E2EE key; v1 links never have it. `teamId` is a team hint for
 * the join form: not a secret and not an authorization. `.`, `~` and `@` are outside the
 * base64url alphabet, so the parts cannot be confused.
 */
import { TEAM_ID_PATTERN } from './teams.ts';

export interface RoomLink {
  roomId: string;
  joinSecret: string;
  adminSecret: string | null;
  contentKey: string | null;
  /** Team hint; only present on team invite links. */
  team?: string;
}

const ROOM_ID = /^[A-Za-z0-9_-]{16,64}$/;
const SECRET = /^[A-Za-z0-9_-]{16,128}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

/** Parse a fragment (with or without the leading `#`). Returns null for anything malformed. */
export function parseRoomFragment(fragment: string): RoomLink | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (raw.length > 512) return null;
  const at = raw.split('@');
  if (at.length > 2) return null;
  const [body = '', team] = at;
  if (team !== undefined && !TEAM_ID_PATTERN.test(team)) return null;
  const tilde = body.split('~');
  if (tilde.length > 2) return null;
  const [head = '', key] = tilde;
  const parts = head.split('.');
  if (parts.length < 2 || parts.length > 3) return null;
  const [roomId = '', joinSecret = '', adminSecret] = parts;
  if (!ROOM_ID.test(roomId) || !SECRET.test(joinSecret)) return null;
  if (adminSecret !== undefined && !SECRET.test(adminSecret)) return null;
  if (key !== undefined && !KEY.test(key)) return null;
  if (team !== undefined && adminSecret !== undefined) return null;
  return {
    roomId,
    joinSecret,
    adminSecret: adminSecret ?? null,
    contentKey: key ?? null,
    ...(team !== undefined ? { team } : {}),
  };
}

/** Build a fragment without the leading `#`. Throws on malformed parts. */
export function formatRoomFragment(link: RoomLink): string {
  const out = [link.roomId, link.joinSecret];
  if (link.adminSecret !== null) out.push(link.adminSecret);
  const s =
    out.join('.') +
    (link.contentKey === null ? '' : `~${link.contentKey}`) +
    (link.team === undefined ? '' : `@${link.team}`);
  if (parseRoomFragment(s) === null) throw new TypeError('invalid room link');
  return s;
}

/** The general join link for any link: no admin secret, no team hint. */
export function joinLinkOf(link: RoomLink): RoomLink {
  const { team: _team, ...rest } = link;
  return { ...rest, adminSecret: null };
}

/** The invite link for one team (or the general join link for null). */
export function teamLinkOf(link: RoomLink, team: string | null): RoomLink {
  const join = joinLinkOf(link);
  return team === null ? join : { ...join, team };
}
