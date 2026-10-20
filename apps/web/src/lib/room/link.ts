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

/** Minimal storage needed to keep the admin secret for this tab (sessionStorage in the app). */
export interface SecretStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const adminKey = (roomId: string) => `bf:admin:${roomId}`;

/**
 * SEC-014: keep the host link out of the address bar (history, history sync, screen shares).
 * - Host link opened: remember the admin secret for this tab and return the join-link fragment
 *   to show instead (`replace`).
 * - Join link opened in a tab that already holds the admin secret (reload, reconnect): restore it.
 * The admin link itself is shown once on /new and can be copied there again.
 */
export function settleAdminSecret(
  link: RoomLink,
  store: SecretStore,
): { link: RoomLink; replace: string | null } {
  if (link.adminSecret) {
    store.setItem(adminKey(link.roomId), link.adminSecret);
    return { link, replace: `#${formatRoomFragment(joinLinkOf(link))}` };
  }
  const saved = store.getItem(adminKey(link.roomId));
  if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) {
    return { link: { ...link, adminSecret: saved }, replace: null };
  }
  return { link, replace: null };
}
