import {
  buildCustomScale,
  type Card,
  DEFAULT_LIFETIME_HOURS,
  type ErrorCode,
  hasUnsafeChars,
  hasVisibleChar,
  ID_PATTERN_MAX_LENGTH,
  isValidIdPattern,
  LIFETIME_CHOICES_HOURS,
  type LifetimeHours,
  linkFor,
  normalizeAllowlistEntry,
  PRESET_NAME_MAX,
  PRESETS,
  type PresetId,
  parsePreset,
  parseRoomConfig,
  presetScale,
  type RoomConfig,
  type RoomConfigInput,
  type ScaleError,
  serializePreset,
  TEAM_NAME_MAX,
  TEAMS_MAX,
  type Team,
  teamTag,
  validateLinkTemplate,
  validateScale,
} from '@backlogfit/core';
import type { KeyValueStore } from '../room/storage.ts';
import { STORAGE_KEYS } from '../storage-keys.ts';

export type ScaleChoice = PresetId | 'custom';
export type { LifetimeHours };
export const LIFETIMES: readonly LifetimeHours[] = LIFETIME_CHOICES_HOURS;

export interface Draft {
  scaleChoice: ScaleChoice;
  scale: Card[];
  taskPolicy: 'ids' | 'links' | 'allowlist';
  allowlist: string[];
  idPattern: string;
  linkTemplate: string;
  autoReveal: boolean;
  anonymousAfterReveal: boolean;
  allowSpectators: boolean;
  lobby: boolean;
  timerSeconds: number | null;
  maxParticipants: number;
  lifetimeHours: LifetimeHours;
  /** Never written to preset files or storage. */
  passcode: string;
  theme: 'corporate' | 'colorful';
  teams: Team[];
}

export function defaultDraft(): Draft {
  return {
    scaleChoice: 'fibonacci',
    scale: presetScale('fibonacci'),
    taskPolicy: 'ids',
    allowlist: [],
    idPattern: '',
    linkTemplate: '',
    autoReveal: true,
    anonymousAfterReveal: false,
    allowSpectators: true,
    lobby: false,
    timerSeconds: null,
    maxParticipants: 50,
    lifetimeHours: DEFAULT_LIFETIME_HOURS,
    passcode: '',
    theme: 'corporate',
    teams: [],
  };
}

export function withPreset(draft: Draft, choice: ScaleChoice): Draft {
  if (choice === 'custom') {
    return { ...draft, scaleChoice: 'custom', scale: draft.scale.map((c) => ({ ...c })) };
  }
  return { ...draft, scaleChoice: choice, scale: presetScale(choice) };
}

/** Parses text like "1, 2, 3, 5, 8, ?" into cards with automatic colors. */
export function scaleFromText(
  text: string,
): { ok: true; scale: Card[] } | { ok: false; error: ScaleError } {
  const values = text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return buildCustomScale(values.map((value) => ({ value })));
}

/** Re-runs automatic colors over an edited deck, keeping order, values and labels. */
export function recolor(scale: readonly Card[]): Card[] {
  const rebuilt = buildCustomScale(
    scale.map((c) => ({ value: c.value, label: c.label, special: c.kind === 'special' })),
  );
  return rebuilt.ok ? rebuilt.scale : scale.map((c) => ({ ...c }));
}

export const SCALE_ERROR_TEXT: Record<ScaleError, string> = {
  too_few_cards: 'Add at least two cards.',
  too_many_cards: 'Use at most 20 cards.',
  duplicate_value: 'Each card value can appear only once.',
  invalid_value: 'Card values must be 1 to 8 characters.',
  invalid_label: 'Card labels must be 1 to 24 characters.',
  no_estimable_cards: 'Add at least one card that is not ?, ☕ or ∞.',
  mixed_kinds: 'Use either numbers or sizes (like S, M, L), not both.',
  invalid_numeric: 'One of the numbers is not valid.',
  duplicate_numeric: 'Two cards have the same number.',
};

export const ID_PATTERN_HELP =
  'Use letters, digits, \\d (a digit), \\w (a letter or digit), . (any character) and classes like [A-Z], each with at most one count such as + or {1,9}. Groups, | and anchors are not allowed.';

export interface DraftErrors {
  scale?: string;
  idPattern?: string;
  linkTemplate?: string;
  allowlist?: string;
  maxParticipants?: string;
  passcode?: string;
  teams?: string;
}

/** Why a team name cannot be used, or null. `except` is the team being renamed. */
export function teamNameError(
  name: string,
  teams: readonly Team[],
  except: string | null = null,
): string | null {
  const n = name.normalize('NFC').trim();
  if (n === '') return 'Type a team name.';
  if (n.length > TEAM_NAME_MAX) return `Use at most ${TEAM_NAME_MAX} characters.`;
  if (hasUnsafeChars(n) || !hasVisibleChar(n)) {
    return 'The name contains invisible or control characters. Please type it again.';
  }
  if (teams.some((t) => t.id !== except && teamTag(t.name) === teamTag(n))) {
    return 'There is already a team with this name.';
  }
  if (except === null && teams.length >= TEAMS_MAX) return `Use at most ${TEAMS_MAX} teams.`;
  return null;
}

export function draftErrors(d: Draft): DraftErrors {
  const e: DraftErrors = {};
  const scaleErr = validateScale(d.scale);
  if (scaleErr) e.scale = SCALE_ERROR_TEXT[scaleErr];
  const pattern = d.idPattern.trim();
  if (pattern !== '' && (pattern.length > ID_PATTERN_MAX_LENGTH || !isValidIdPattern(pattern))) {
    e.idPattern = ID_PATTERN_HELP;
  }
  const bad = d.allowlist.filter((h) => normalizeAllowlistEntry(h) === null);
  if (bad.length > 0) e.allowlist = `Not a valid domain: ${bad.join(', ')}`;
  else if (d.taskPolicy === 'allowlist' && d.allowlist.length === 0) {
    e.allowlist = 'Add at least one domain, for example jira.yourcompany.com.';
  }
  const tpl = d.linkTemplate.trim();
  if (tpl !== '' && !e.allowlist) {
    const allow = d.allowlist.map((h) => normalizeAllowlistEntry(h) ?? '');
    if (!tpl.includes('{id}')) e.linkTemplate = 'Include {id} where the task ID goes.';
    else if (!validateLinkTemplate(tpl, d.taskPolicy, allow)) {
      e.linkTemplate =
        d.taskPolicy === 'allowlist'
          ? 'The link must start with https:// and use one of the allowed domains.'
          : 'The link must start with https:// (or http://) and contain {id} once.';
    }
  }
  if (!Number.isInteger(d.maxParticipants) || d.maxParticipants < 2 || d.maxParticipants > 500) {
    e.maxParticipants = 'Choose between 2 and 500 people.';
  }
  if (d.passcode.length > 64) e.passcode = 'Use at most 64 characters.';
  const badTeam = d.teams.find((t, i) => teamNameError(t.name, d.teams.slice(0, i), null) !== null);
  if (badTeam)
    e.teams = `Check the team “${badTeam.name}”: names must be unique, 1 to 24 characters.`;
  return e;
}

export function toConfigInput(d: Draft): RoomConfigInput {
  return {
    scale: d.scale.map((c) => ({ ...c })),
    taskPolicy: d.taskPolicy,
    allowlist: d.taskPolicy === 'allowlist' ? [...d.allowlist] : [],
    idPattern: d.idPattern.trim() === '' ? null : d.idPattern.trim(),
    linkTemplate: d.linkTemplate.trim() === '' ? null : d.linkTemplate.trim(),
    autoReveal: d.autoReveal,
    anonymousAfterReveal: d.anonymousAfterReveal,
    allowSpectators: d.allowSpectators,
    lobby: d.lobby,
    timerSeconds: d.timerSeconds,
    maxParticipants: d.maxParticipants,
    theme: d.theme,
    teams: d.teams.map((t) => ({ ...t })),
  };
}

/** The draft as a RoomConfig validated by core, or null when core rejects it. */
export function toRoomConfig(d: Draft): RoomConfig | null {
  const parsed = parseRoomConfig(toConfigInput(d));
  return parsed.ok ? parsed.msg : null;
}

export function exampleLink(d: Draft, key = 'SCP-3655'): string | null {
  const tpl = d.linkTemplate.trim();
  if (tpl === '' || !tpl.includes('{id}')) return null;
  return linkFor(tpl, key);
}

/** The preset a deck is identical to (ignoring colors), or 'custom'. */
export function matchPreset(scale: readonly Card[]): ScaleChoice {
  const sig = (cards: readonly Card[]) => cards.map((c) => `${c.kind}:${c.value}`).join('|');
  const target = sig(scale);
  for (const [id, p] of Object.entries(PRESETS)) {
    if (sig(p.cards) === target) return id as PresetId;
  }
  return 'custom';
}

/** Preset file JSON, or null if the draft is invalid. The passcode is never included. */
export function presetFileJson(d: Draft, name = 'Backlogfit preset'): string | null {
  try {
    return serializePreset(toConfigInput(d), {
      name: name.slice(0, PRESET_NAME_MAX),
      lifetimeHours: d.lifetimeHours,
    });
  } catch {
    return null;
  }
}

export type PresetImport = { ok: true; draft: Draft; name: string } | { ok: false; error: string };

const IMPORT_ERRORS: Partial<Record<ErrorCode, string>> = {
  too_large: 'The file is too large.',
  bad_json: 'This is not a valid preset file (not JSON).',
  unsupported_version: 'This preset was made by a newer version of Backlogfit.',
};

/** Validates an imported preset file (or a bare RoomConfig). */
export function parsePresetFile(text: string): PresetImport {
  const parsed = parsePreset(text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: IMPORT_ERRORS[parsed.code] ?? 'The preset contains invalid settings.',
    };
  }
  const c = parsed.msg.config;
  const draft: Draft = {
    scaleChoice: matchPreset(c.scale),
    scale: c.scale.map((card) => ({ ...card })),
    taskPolicy: c.taskPolicy,
    allowlist: [...c.allowlist],
    idPattern: c.idPattern ?? '',
    linkTemplate: c.linkTemplate ?? '',
    autoReveal: c.autoReveal,
    anonymousAfterReveal: c.anonymousAfterReveal,
    allowSpectators: c.allowSpectators,
    lobby: c.lobby,
    timerSeconds: c.timerSeconds,
    maxParticipants: c.maxParticipants,
    lifetimeHours: parsed.msg.lifetimeHours ?? DEFAULT_LIFETIME_HOURS,
    passcode: '',
    theme: c.theme,
    teams: c.teams.map((t) => ({ ...t })),
  };
  return { ok: true, draft, name: parsed.msg.name ?? 'Imported preset' };
}

export function saveLastDraft(store: KeyValueStore, d: Draft): void {
  const json = presetFileJson(d, 'Last used');
  if (json) store.setItem(STORAGE_KEYS.lastConfig, json);
}

export function loadLastDraft(store: KeyValueStore): Draft | null {
  const raw = store.getItem(STORAGE_KEYS.lastConfig);
  if (!raw) return null;
  const r = parsePresetFile(raw);
  return r.ok ? r.draft : null;
}
