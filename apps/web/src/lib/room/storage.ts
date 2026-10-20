// Resume tokens and the host secret are secrets: they live only in sessionStorage (cleared when
// the tab closes) and are never logged. Every access is wrapped because storage can be
// unavailable (private mode, blocked site data).
import { STORAGE_KEYS } from '../storage-keys.ts';

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

export class RoomSessionStore {
  readonly #s: KeyValueStore;
  readonly #id: string;

  constructor(store: KeyValueStore, roomId: string) {
    this.#s = store;
    this.#id = roomId;
  }

  get resumeToken(): string | null {
    return this.#s.getItem(STORAGE_KEYS.resume(this.#id));
  }

  set resumeToken(token: string | null) {
    if (token === null) this.#s.removeItem(STORAGE_KEYS.resume(this.#id));
    else this.#s.setItem(STORAGE_KEYS.resume(this.#id), token);
  }

  get identity(): SavedIdentity | null {
    const raw = this.#s.getItem(STORAGE_KEYS.identity(this.#id));
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
    if (who === null) this.#s.removeItem(STORAGE_KEYS.identity(this.#id));
    else this.#s.setItem(STORAGE_KEYS.identity(this.#id), JSON.stringify(who));
  }

  /** Forgets this tab's place in the room; `withAdmin` also drops the host secret. */
  clear(withAdmin = false): void {
    this.resumeToken = null;
    this.identity = null;
    if (withAdmin) this.#s.removeItem(STORAGE_KEYS.admin(this.#id));
  }
}

export function rememberedName(store: KeyValueStore = localStore()): string {
  return store.getItem(STORAGE_KEYS.name) ?? '';
}

export function rememberName(name: string, store: KeyValueStore = localStore()): void {
  store.setItem(STORAGE_KEYS.name, name);
}
