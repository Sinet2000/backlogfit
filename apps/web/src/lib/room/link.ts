// Room secrets live only in the URL fragment, which browsers never send to servers.
import { formatRoomFragment, joinLinkOf, parseRoomFragment, type RoomLink } from '@backlogfit/core';
import { STORAGE_KEYS } from '../storage-keys.ts';

export type { RoomLink };

export const parseFragment = parseRoomFragment;

/** Absolute share links. `query` must never carry a secret (only e.g. "demo"). */
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

export interface SecretStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Keeps the host link out of the address bar (history, history sync, screen shares, SEC-014).
 * A host link stores the admin secret for this tab and returns the join fragment to show
 * instead; a join link opened in a tab that holds the secret (reload, reconnect) restores it.
 */
export function settleAdminSecret(
  link: RoomLink,
  store: SecretStore,
): { link: RoomLink; replace: string | null } {
  if (link.adminSecret) {
    store.setItem(STORAGE_KEYS.admin(link.roomId), link.adminSecret);
    return { link, replace: `#${formatRoomFragment(joinLinkOf(link))}` };
  }
  const saved = store.getItem(STORAGE_KEYS.admin(link.roomId));
  if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) {
    return { link: { ...link, adminSecret: saved }, replace: null };
  }
  return { link, replace: null };
}
