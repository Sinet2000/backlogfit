import { parseRoomConfig, presetScale } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import {
  defaultDraft,
  draftErrors,
  exampleLink,
  loadLastDraft,
  matchPreset,
  parsePresetFile,
  presetFileJson,
  recolor,
  saveLastDraft,
  scaleFromText,
  toRoomConfig,
  withPreset,
} from '../src/lib/config/draft.ts';
import { memoryStore } from '../src/lib/room/storage.ts';

describe('configurator draft', () => {
  it('defaults to a valid Fibonacci config with 2h lifetime', () => {
    const d = defaultDraft();
    expect(d.scaleChoice).toBe('fibonacci');
    expect(d.lifetimeHours).toBe(2);
    expect(draftErrors(d)).toEqual({});
    expect(toRoomConfig(d)).not.toBeNull();
  });

  it('every preset is valid', () => {
    for (const id of ['fibonacci', 'modifiedFibonacci', 'tshirt', 'powersOf2', 'linear'] as const) {
      expect(toRoomConfig(withPreset(defaultDraft(), id)), id).not.toBeNull();
    }
  });

  it('parses chip text into a custom scale', () => {
    const r = scaleFromText('1, 3,5 8 ? ☕ ∞');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scale.map((c) => c.value)).toEqual(['1', '3', '5', '8', '?', '☕', '∞']);
      expect(r.scale.filter((c) => c.kind === 'special')).toHaveLength(3);
    }
    expect(scaleFromText('1').ok).toBe(false);
    expect(scaleFromText('1, 1').ok).toBe(false);
    expect(scaleFromText('1, M').ok).toBe(false);
  });

  it('recolor keeps order and values', () => {
    const s = presetScale('linear').reverse();
    expect(recolor(s).map((c) => c.value)).toEqual(s.map((c) => c.value));
  });

  it('validates link templates and allowlists with plain-language errors', () => {
    const d = { ...defaultDraft(), linkTemplate: 'https://jira.example.com/browse/{id}' };
    expect(draftErrors(d)).toEqual({});
    expect(exampleLink(d)).toBe('https://jira.example.com/browse/SCP-3655');
    expect(draftErrors({ ...d, linkTemplate: 'https://x.example.com/' }).linkTemplate).toBeTruthy();
    expect(draftErrors({ ...d, linkTemplate: 'javascript:alert({id})' }).linkTemplate).toBeTruthy();
    const allow = { ...d, taskPolicy: 'allowlist' as const, allowlist: [] };
    expect(draftErrors(allow).allowlist).toBeTruthy();
    expect(draftErrors({ ...allow, allowlist: ['jira.example.com'] })).toEqual({});
    expect(draftErrors({ ...allow, allowlist: ['other.example.org'] }).linkTemplate).toBeTruthy();
  });

  it('rejects unsafe ID patterns', () => {
    expect(draftErrors({ ...defaultDraft(), idPattern: '(a+)+' }).idPattern).toBeTruthy();
    expect(draftErrors({ ...defaultDraft(), idPattern: '[A-Z]{2,5}-[0-9]{1,6}' })).toEqual({});
  });
});

describe('preset files', () => {
  it('round-trips through JSON without the passcode', () => {
    const d = {
      ...withPreset(defaultDraft(), 'tshirt'),
      passcode: 'hunter2',
      lifetimeHours: 4 as const,
      lobby: true,
    };
    const json = presetFileJson(d, 'Team A');
    expect(json).not.toBeNull();
    expect(json).not.toContain('hunter2');
    const r = parsePresetFile(json ?? '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe('Team A');
      expect(r.draft.scaleChoice).toBe('tshirt');
      expect(r.draft.lifetimeHours).toBe(4);
      expect(r.draft.lobby).toBe(true);
      expect(r.draft.passcode).toBe('');
      expect(parseRoomConfig(JSON.parse(json ?? '{}').config).ok).toBe(true);
    }
  });

  it('rejects bad files with friendly messages', () => {
    for (const bad of [
      'nope',
      '[]',
      '{"format":"backlogfit-preset","v":9,"config":{}}',
      '{"scale":[]}',
      'x'.repeat(70_000),
    ]) {
      const r = parsePresetFile(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });

  it('rejects hostile configs (unknown keys, javascript: templates)', () => {
    const base = JSON.parse(presetFileJson(defaultDraft()) ?? '{}');
    expect(parsePresetFile(JSON.stringify({ ...base, extra: 1 })).ok).toBe(false);
    base.config.linkTemplate = 'javascript:alert({id})';
    expect(parsePresetFile(JSON.stringify(base)).ok).toBe(false);
  });

  it('identifies presets regardless of colors', () => {
    const s = presetScale('powersOf2').map((c) => ({ ...c, color: '#123456' }));
    expect(matchPreset(s)).toBe('powersOf2');
    expect(matchPreset(s.slice(1))).toBe('custom');
  });

  it('remembers the last draft', () => {
    const store = memoryStore();
    expect(loadLastDraft(store)).toBeNull();
    saveLastDraft(store, { ...defaultDraft(), anonymousAfterReveal: true, passcode: 'secret' });
    const d = loadLastDraft(store);
    expect(d?.anonymousAfterReveal).toBe(true);
    expect(d?.passcode).toBe('');
    store.setItem('bf:last-config', '{broken');
    expect(loadLastDraft(store)).toBeNull();
  });
});
