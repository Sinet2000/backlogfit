/**
 * Room links. Secrets live only in the URL fragment, which browsers never send to servers.
 * Parsing and formatting come from core (`#roomId.join[.admin][~key]`); the Phase 2 `~key`
 * part is accepted and ignored for now.
 */
import { formatRoomFragment, joinLinkOf, parseRoomFragment, type RoomLink } from '@backlogfit/core';

export type { RoomLink };

export const parseFragment = parseRoomFragment;

/** Absolute links for sharing. `query` is only ever non-secret (e.g. "demo"). */
export function roomUrls(
  origin: string,
  link: RoomLink,
  query = '',
): { join: string; admin: string | null } {
  const path = `${origin}/r${query ? `?${query}` : ''}#`;
  return {
    join: path + formatRoomFragment(joinLinkOf(link)),
    admin: link.adminSecret ? path + formatRoomFragment(link) : null,
  };
}
