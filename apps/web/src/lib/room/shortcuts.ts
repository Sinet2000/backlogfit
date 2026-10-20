export type ShortcutAction =
  | { type: 'pick'; index: number }
  | { type: 'reveal' }
  | { type: 'next' }
  | { type: 'help' };

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  target?: unknown;
}

export interface ShortcutContext {
  canVote: boolean;
  canFacilitate: boolean;
  dialogOpen?: boolean;
}

interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
]);

export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ElementLike;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute?.('type') ?? 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  const role = el.getAttribute?.('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox';
}

function isActivatable(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ElementLike;
  const tag = (el.tagName ?? '').toUpperCase();
  if (['BUTTON', 'A', 'INPUT', 'SUMMARY', 'SELECT', 'TEXTAREA', 'LABEL'].includes(tag)) return true;
  const role = el.getAttribute?.('role') ?? '';
  return ['button', 'radio', 'checkbox', 'switch', 'menuitem', 'tab', 'option', 'link'].includes(
    role,
  );
}

/** Maps a key press to a room action; never fires while typing or with a dialog open. */
export function shortcutFor(e: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (isTypingTarget(e.target)) return null;
  if (ctx.dialogOpen) return null;

  if (e.key === '?') return { type: 'help' };
  if (/^[1-9]$/.test(e.key)) {
    if (!ctx.canVote || e.repeat) return null;
    return { type: 'pick', index: Number(e.key) - 1 };
  }
  if (!ctx.canFacilitate || e.repeat) return null;
  if (e.key === ' ' || e.key === 'Spacebar') {
    return isActivatable(e.target) ? null : { type: 'reveal' };
  }
  if (e.key === 'n' || e.key === 'N') return { type: 'next' };
  return null;
}

export const SHORTCUT_HELP: readonly { keys: string; does: string; who: 'all' | 'host' }[] = [
  {
    keys: '1 – 9',
    does: 'Pick a card. The number is shown under each card while the deck has focus.',
    who: 'all',
  },
  { keys: 'Arrow keys', does: 'Move between cards in the deck', who: 'all' },
  { keys: 'Space', does: 'Reveal the votes', who: 'host' },
  { keys: 'N', does: 'Go to the next task', who: 'host' },
  { keys: '?', does: 'Show this list', who: 'all' },
  { keys: 'Esc', does: 'Close a dialog or menu', who: 'all' },
];
