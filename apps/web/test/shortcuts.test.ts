import { describe, expect, it } from 'vitest';
import { isTypingTarget, shortcutFor } from '../src/lib/room/shortcuts.ts';

const el = (tagName: string, attrs: Record<string, string> = {}, editable = false) => ({
  tagName,
  isContentEditable: editable,
  getAttribute: (n: string) => attrs[n] ?? null,
});

const voter = { canVote: true, canFacilitate: false };
const admin = { canVote: true, canFacilitate: true };
const body = el('BODY');

describe('shortcutFor', () => {
  it('maps 1–9 to card picks', () => {
    expect(shortcutFor({ key: '1', target: body }, voter)).toEqual({ type: 'pick', index: 0 });
    expect(shortcutFor({ key: '9', target: body }, voter)).toEqual({ type: 'pick', index: 8 });
    expect(shortcutFor({ key: '0', target: body }, voter)).toBeNull();
    expect(
      shortcutFor({ key: '3', target: body }, { canVote: false, canFacilitate: true }),
    ).toBeNull();
  });

  it('reserves Space and N for hosts', () => {
    expect(shortcutFor({ key: ' ', target: body }, voter)).toBeNull();
    expect(shortcutFor({ key: 'n', target: body }, voter)).toBeNull();
    expect(shortcutFor({ key: ' ', target: body }, admin)).toEqual({ type: 'reveal' });
    expect(shortcutFor({ key: 'N', target: body }, admin)).toEqual({ type: 'next' });
  });

  it('leaves Space alone on focused controls', () => {
    expect(shortcutFor({ key: ' ', target: el('BUTTON') }, admin)).toBeNull();
    expect(shortcutFor({ key: ' ', target: el('DIV', { role: 'radio' }) }, admin)).toBeNull();
  });

  it('opens help with ?', () => {
    expect(shortcutFor({ key: '?', target: body }, voter)).toEqual({ type: 'help' });
  });

  it('never fires while typing, with modifiers, in dialogs or on repeat', () => {
    for (const target of [
      el('INPUT'),
      el('INPUT', { type: 'password' }),
      el('TEXTAREA'),
      el('SELECT'),
      el('DIV', {}, true),
      el('DIV', { role: 'textbox' }),
    ]) {
      expect(shortcutFor({ key: '5', target }, admin)).toBeNull();
      expect(shortcutFor({ key: 'n', target }, admin)).toBeNull();
    }
    expect(shortcutFor({ key: '5', ctrlKey: true, target: body }, admin)).toBeNull();
    expect(shortcutFor({ key: 'n', metaKey: true, target: body }, admin)).toBeNull();
    expect(shortcutFor({ key: '5', target: body }, { ...admin, dialogOpen: true })).toBeNull();
    expect(shortcutFor({ key: 'n', repeat: true, target: body }, admin)).toBeNull();
    expect(shortcutFor({ key: '5', isComposing: true, target: body }, admin)).toBeNull();
  });

  it('treats checkboxes as non-typing targets', () => {
    expect(isTypingTarget(el('INPUT', { type: 'checkbox' }))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
