import { describe, expect, it } from 'vitest';
import {
  AGENDA_MAX,
  batches,
  moveItem,
  parseAgenda,
  savePrepared,
  splitLines,
  takePrepared,
} from '../src/lib/room/agenda.ts';
import { memoryStore } from '../src/lib/room/storage.ts';

describe('agenda', () => {
  it('splits pasted text into trimmed lines', () => {
    expect(splitLines(' SCP-1 A \r\n\n  SCP-2 B\n   ')).toEqual(['SCP-1 A', 'SCP-2 B']);
  });

  it('parses with the room link policy', () => {
    const items = parseAgenda(['SCP-3655 Fix login', 'https://evil.example/x Bad'], {
      policy: 'ids',
      allowlist: [],
    });
    expect(items[0]?.task).toEqual({ key: 'SCP-3655', title: 'Fix login', url: null });
    expect(items[1]?.task).toBeNull();
    expect(items[1]?.error).toBeTruthy();
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

  it('hands prepared lines over exactly once', () => {
    const s = memoryStore();
    savePrepared(s, 'room1', ['A-1', 'A-2']);
    expect(takePrepared(s, 'room2')).toBeNull();
    expect(takePrepared(s, 'room1')).toEqual(['A-1', 'A-2']);
    expect(takePrepared(s, 'room1')).toBeNull();
  });

  it('ignores empty lists, caps size and survives corrupt storage', () => {
    const s = memoryStore();
    savePrepared(s, 'r', []);
    expect(s.getItem('bf:agenda:r')).toBeNull();
    savePrepared(
      s,
      'r',
      Array.from({ length: AGENDA_MAX + 10 }, (_, i) => `T-${i}`),
    );
    expect(takePrepared(s, 'r')).toHaveLength(AGENDA_MAX);
    s.setItem('bf:agenda:r', '{not json');
    expect(takePrepared(s, 'r')).toBeNull();
    s.setItem('bf:agenda:r', JSON.stringify(['ok', 5, null]));
    expect(takePrepared(s, 'r')).toEqual(['ok']);
  });
});
