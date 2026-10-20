import { describe, expect, it } from 'vitest';
import {
  batches,
  clearPrepared,
  moveItem,
  PREPARED_MAX,
  parsePrepared,
  readPrepared,
  savePrepared,
  splitLines,
  uniqueLines,
} from '../src/lib/room/prepared-tasks.ts';
import { memoryStore } from '../src/lib/room/storage.ts';

describe('prepared tasks', () => {
  it('splits pasted text into trimmed lines', () => {
    expect(splitLines(' SCP-1 A \r\n\n  SCP-2 B\n   ')).toEqual(['SCP-1 A', 'SCP-2 B']);
    expect(uniqueLines('A-1\nA-2\nA-1')).toEqual(['A-1', 'A-2']);
  });

  it('parses with the room link policy and flags shortened links', () => {
    const items = parsePrepared(
      ['SCP-3655 Fix login', 'https://evil.example/x Bad', 'https://jira.example/browse/X-1 Shady'],
      { policy: 'ids', allowlist: [] },
    );
    expect(items[0]?.task).toEqual({ key: 'SCP-3655', title: 'Fix login', url: null });
    expect(items[0]?.shortened).toBe(false);
    expect(items[1]?.task).toBeNull();
    expect(items[1]?.error).toBeTruthy();
    expect(items[2]?.task?.key).toBe('X-1');
    expect(items[2]?.shortened).toBe(true);
  });

  it('keeps allowed links as they are', () => {
    const [item] = parsePrepared(['https://jira.example/browse/X-1 Kept'], {
      policy: 'links',
      allowlist: [],
    });
    expect(item?.task?.url).toBe('https://jira.example/browse/X-1');
    expect(item?.shortened).toBe(false);
  });

  it('moves items and clamps targets', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('batches lines to the protocol limit', () => {
    const lines = Array.from({ length: 450 }, (_, i) => `T-${i}`);
    expect(batches(lines).map((b) => b.length)).toEqual([200, 200, 50]);
    expect(batches([])).toEqual([]);
  });

  it('keeps the stored list until it is cleared', () => {
    const s = memoryStore();
    savePrepared(s, 'room1', ['A-1', 'A-2']);
    expect(readPrepared(s, 'room2')).toBeNull();
    expect(readPrepared(s, 'room1')).toEqual(['A-1', 'A-2']);
    expect(readPrepared(s, 'room1')).toEqual(['A-1', 'A-2']);
    clearPrepared(s, 'room1');
    expect(readPrepared(s, 'room1')).toBeNull();
  });

  it('ignores empty lists, caps size and survives corrupt storage', () => {
    const s = memoryStore();
    savePrepared(s, 'r', []);
    expect(s.getItem('bf:prepared:r')).toBeNull();
    savePrepared(
      s,
      'r',
      Array.from({ length: PREPARED_MAX + 10 }, (_, i) => `T-${i}`),
    );
    expect(readPrepared(s, 'r')).toHaveLength(PREPARED_MAX);
    s.setItem('bf:prepared:r', '{not json');
    expect(readPrepared(s, 'r')).toBeNull();
    s.setItem('bf:prepared:r', JSON.stringify(['ok', 5, null]));
    expect(readPrepared(s, 'r')).toEqual(['ok']);
  });
});
