import { ERROR_CODES, presetScale } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import { cardName, deckTones, hasCustomColors, rampStep } from '../src/lib/cards.ts';
import {
  addValues,
  autoColor,
  cardFromValue,
  move,
  removeAt,
  setColor,
} from '../src/lib/config/chips.ts';
import { qrMatrix } from '../src/lib/qr.ts';
import { consensusText, formatClock, formatRemaining, groupVotes } from '../src/lib/room/format.ts';
import { endedText, errorText } from '../src/lib/room/messages.ts';
import { canonicalUrl, serializeJsonLd } from '../src/lib/seo/site.ts';
import { CARD_STEPS } from '../src/lib/styles/palette.ts';

describe('QR', () => {
  it('encodes a room link as a square path without inline styles or data URLs', () => {
    const q = qrMatrix('https://backlogfit.com/r#AAAAAAAAAAAAAAAAAAAAAA.jjjjjjjjjjjjjjjjjjjjjj');
    expect(q.size).toBeGreaterThanOrEqual(21);
    expect(q.path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
  });
});

describe('chip editor helpers', () => {
  it('infers kinds like core', () => {
    expect(cardFromValue('5')).toMatchObject({ kind: 'number', numeric: 5 });
    expect(cardFromValue('½')).toMatchObject({ kind: 'number', numeric: 0.5 });
    expect(cardFromValue('XL')).toMatchObject({ kind: 'tshirt' });
    expect(cardFromValue('☕')).toMatchObject({ kind: 'special' });
    expect(cardFromValue('')).toBeNull();
    expect(cardFromValue('123456789')).toBeNull();
  });

  it('adds, reorders, removes and recolors', () => {
    const { deck, skipped } = addValues([], '1, 2, 3, 3, ?', true);
    expect(deck.map((c) => c.value)).toEqual(['1', '2', '3', '?']);
    expect(skipped).toEqual(['3']);
    expect(move(deck, 0, 2).map((c) => c.value)).toEqual(['2', '3', '1', '?']);
    expect(removeAt(deck, 1).map((c) => c.value)).toEqual(['1', '3', '?']);
    expect(setColor(deck, 0, '#ABCDEF')[0]?.color).toBe('#abcdef');
    expect(setColor(deck, 0, 'red')[0]?.color).toBe(deck[0]?.color);
    expect(autoColor(deck).map((c) => c.color)).toEqual(deck.map((c) => c.color));
    const kept = addValues(setColor(deck, 0, '#123456'), '5', false).deck;
    expect(kept[0]?.color).toBe('#123456');
  });
});

describe('formatting', () => {
  it('formats clocks and remaining time', () => {
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-1)).toBe('0:00');
    expect(formatRemaining(30_000)).toBe('less than a minute');
    expect(formatRemaining(80 * 60_000)).toBe('1 h 20 min');
    expect(formatRemaining(120 * 60_000)).toBe('2 h');
  });

  it('describes consensus with text and an icon, never color alone', () => {
    for (const level of ['full', 'near', 'split'] as const) {
      const t = consensusText(level);
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.icon).toBeTruthy();
    }
  });

  it('names special cards for screen readers', () => {
    const names = presetScale('fibonacci')
      .filter((c) => c.kind === 'special')
      .map(cardName);
    expect(names).toEqual(['Not sure', 'Break', 'Too big']);
  });

  it('groups votes by value, lowest first, specials last', () => {
    const scale = presetScale('fibonacci');
    const v = (name: string, value: string) => ({ participantId: name, name, value });
    const groups = groupVotes([v('a', '8'), v('b', '?'), v('c', '3'), v('d', '8')], scale);
    expect(groups.map((g) => [g.value, g.votes.length])).toEqual([
      ['3', 1],
      ['8', 2],
      ['?', 1],
    ]);
  });
});

describe('card tones', () => {
  it('maps estimable cards onto the ramp by rank and leaves specials neutral', () => {
    const tones = deckTones(presetScale('fibonacci'));
    expect(tones.get('0')).toEqual({ step: 1, custom: null });
    expect(tones.get('21')).toEqual({ step: CARD_STEPS, custom: null });
    expect(tones.get('?')).toEqual({ step: null, custom: null });
    expect(rampStep(0, 1)).toBe(4);
  });

  it('keeps colours the host picked', () => {
    const scale = presetScale('tshirt').map((c, i) => (i === 2 ? { ...c, color: '#123456' } : c));
    expect(deckTones(scale).get('M')?.custom).toBe('#123456');
    expect(deckTones(scale).get('S')?.custom).toBeNull();
    expect(hasCustomColors(scale)).toBe(true);
    expect(hasCustomColors(presetScale('tshirt'))).toBe(false);
  });
});

describe('messages', () => {
  it('has text for every error code and never echoes input', () => {
    for (const code of ERROR_CODES) expect(errorText(code).length).toBeGreaterThan(5);
    expect(errorText('invalid_task', 'lines:0,3')).toContain('2 lines');
  });

  it('explains that ended sessions are deleted', () => {
    for (const r of ['expired', 'idle', 'closed', 'not_found'] as const) {
      expect(endedText(r, null).body).toContain('deleted automatically');
    }
    expect(endedText('rejected', 'room_locked').body).toContain('locked');
  });

  it('does not call a malformed link an ended session', () => {
    const t = endedText('invalid_link', null);
    expect(t.title).not.toMatch(/ended/i);
    expect(t.body).toContain('#');
  });
});

describe('SEO helpers', () => {
  it('builds canonical URLs', () => {
    expect(canonicalUrl('/')).toBe('https://backlogfit.com/');
    expect(canonicalUrl('/guide/')).toBe('https://backlogfit.com/guide');
    expect(canonicalUrl('faq')).toBe('https://backlogfit.com/faq');
  });

  it('serializes JSON-LD that cannot break out of its script element', () => {
    const s = serializeJsonLd({ name: '</script><script>alert(1)</script> & co' });
    expect(s).not.toMatch(/[<>&]/);
    expect(JSON.parse(s)).toEqual({ name: '</script><script>alert(1)</script> & co' });
  });
});
