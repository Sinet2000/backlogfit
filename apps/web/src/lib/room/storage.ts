/**
 * Per-tab storage for a room session. Resume tokens are secrets: they live only in
 * sessionStorage (cleared when the tab closes) and are never logged. Everything is wrapped in
 * try/catch because storage can be unavailable (private mode, blocked site data).
 */

import { adminKey } from './link.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const memoryStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

function safe(get: () => KeyValueStore | undefined): KeyValueStore {
  const fallback = memoryStore();
  const wrap = <T>(fn: (s: KeyValueStore) => T, dflt: T): T => {
    try {
      const s = get();
      return s ? fn(s) : fn(fallback);
    } catch {
      return dflt;
    }
  };
  return {
    getItem: (k) => wrap((s) => s.getItem(k), null),
    setItem: (k, v) => wrap((s) => s.setItem(k, v), undefined),
    removeItem: (k) => wrap((s) => s.removeItem(k), undefined),
  };
}

export const sessionStore = (): KeyValueStore =>
  safe(() => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage));
export const localStore = (): KeyValueStore =>
  safe(() => (typeof localStorage === 'undefined' ? undefined : localStorage));

export interface SavedIdentity {
  name: string;
  role: 'voter' | 'spectator';
}

/** What this tab remembers about one room. */
export class RoomSessionStore {
  readonly #s: KeyValueStore;
  readonly #id: string;

  constructor(store: KeyValueStore, roomId: string) {
    this.#s = store;
    this.#id = roomId;
  }

  get resumeToken(): string | null {
    return this.#s.getItem(`bf:resume:${this.#id}`);
  }

  set resumeToken(token: string | null) {
    if (token === null) this.#s.removeItem(`bf:resume:${this.#id}`);
    else this.#s.setItem(`bf:resume:${this.#id}`, token);
  }

  get identity(): SavedIdentity | null {
    const raw = this.#s.getItem(`bf:who:${this.#id}`);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as Partial<SavedIdentity>;
      if (typeof v.name !== 'string' || (v.role !== 'voter' && v.role !== 'spectator')) {
        return null;
      }
      return { name: v.name, role: v.role };
    } catch {
      return null;
    }
  }

  set identity(who: SavedIdentity | null) {
    if (who === null) this.#s.removeItem(`bf:who:${this.#id}`);
    else this.#s.setItem(`bf:who:${this.#id}`, JSON.stringify(who));
  }

  /** Forget this tab's place in the room. `withAdmin` also drops the host secret (room is over). */
  clear(withAdmin = false): void {
    this.resumeToken = null;
    this.identity = null;
    if (withAdmin) this.#s.removeItem(adminKey(this.#id));
  }
}

/** Display name convenience across rooms (not a secret). */
export function rememberedName(store: KeyValueStore = localStore()): string {
  return store.getItem('bf:name') ?? '';
}

export function rememberName(name: string, store: KeyValueStore = localStore()): void {
  store.setItem('bf:name', name);
}
