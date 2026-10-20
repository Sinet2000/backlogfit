import { describe, expect, it } from 'vitest';
import { parseFragment, roomUrls } from '../src/lib/room/link.ts';

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
