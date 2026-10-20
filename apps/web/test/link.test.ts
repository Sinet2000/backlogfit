import { describe, expect, it } from 'vitest';
import { parseFragment, roomUrls, settleAdminSecret } from '../src/lib/room/link.ts';
import { memoryStore, RoomSessionStore } from '../src/lib/room/storage.ts';
import { STORAGE_KEYS } from '../src/lib/storage-keys.ts';

const ROOM = 'AAAAAAAAAAAAAAAAAAAAAA';
const JOIN = 'jjjjjjjjjjjjjjjjjjjjjj';
const ADMIN = 'aaaaaaaaaaaaaaaaaaaaaa';

describe('room links', () => {
  it('parses join and admin fragments', () => {
    expect(parseFragment(`#${ROOM}.${JOIN}`)).toEqual({
      roomId: ROOM,
      joinSecret: JOIN,
      adminSecret: null,
      contentKey: null,
    });
    expect(parseFragment(`${ROOM}.${JOIN}.${ADMIN}`)?.adminSecret).toBe(ADMIN);
  });

  it('rejects malformed fragments', () => {
    for (const bad of ['', '#', `#${ROOM}`, `#${ROOM}.short`, `#${ROOM}.${JOIN}.x.y`, '#a b.c']) {
      expect(parseFragment(bad), bad).toBeNull();
    }
  });

  it('builds join links without the admin secret, and puts secrets only after #', () => {
    const urls = roomUrls('https://backlogfit.com', {
      roomId: ROOM,
      joinSecret: JOIN,
      adminSecret: ADMIN,
      contentKey: null,
    });
    expect(urls.join).toBe(`https://backlogfit.com/r#${ROOM}.${JOIN}`);
    expect(urls.admin).toBe(`https://backlogfit.com/r#${ROOM}.${JOIN}.${ADMIN}`);
    for (const u of [urls.join, urls.admin ?? '']) {
      const url = new URL(u);
      expect(url.pathname + url.search).not.toContain(JOIN);
    }
    expect(
      roomUrls(
        'http://x',
        { roomId: ROOM, joinSecret: JOIN, adminSecret: null, contentKey: null },
        'demo',
      ).join,
    ).toBe(`http://x/r?demo#${ROOM}.${JOIN}`);
  });
});

describe('SEC-014: admin secret out of the address bar', () => {
  const base = { roomId: ROOM, joinSecret: JOIN, contentKey: null };

  it('stores the admin secret and asks to show the join link', () => {
    const store = memoryStore();
    const r = settleAdminSecret({ ...base, adminSecret: ADMIN }, store);
    expect(r.link.adminSecret).toBe(ADMIN);
    expect(r.replace).toBe(`#${ROOM}.${JOIN}`);
    expect(r.replace).not.toContain(ADMIN);
    expect(store.getItem(STORAGE_KEYS.admin(ROOM))).toBe(ADMIN);
  });

  it('restores it after a reload from the join link', () => {
    const store = memoryStore();
    settleAdminSecret({ ...base, adminSecret: ADMIN }, store);
    const r = settleAdminSecret({ ...base, adminSecret: null }, store);
    expect(r).toEqual({ link: { ...base, adminSecret: ADMIN }, replace: null });
  });

  it('leaves voters alone and ignores other rooms or junk', () => {
    const store = memoryStore();
    expect(settleAdminSecret({ ...base, adminSecret: null }, store)).toEqual({
      link: { ...base, adminSecret: null },
      replace: null,
    });
    store.setItem(STORAGE_KEYS.admin('BBBBBBBBBBBBBBBBBBBBBB'), ADMIN);
    store.setItem(STORAGE_KEYS.admin(ROOM), 'bad secret!');
    expect(settleAdminSecret({ ...base, adminSecret: null }, store).link.adminSecret).toBeNull();
  });

  it('is forgotten when the room ends', () => {
    const store = memoryStore();
    settleAdminSecret({ ...base, adminSecret: ADMIN }, store);
    const session = new RoomSessionStore(store, ROOM);
    session.clear();
    expect(store.getItem(STORAGE_KEYS.admin(ROOM))).toBe(ADMIN);
    session.clear(true);
    expect(store.getItem(STORAGE_KEYS.admin(ROOM))).toBeNull();
  });
});
