/**
 * Room presets: a configurator setup saved as a local JSON file and loaded later. Presets are
 * versioned envelopes around a RoomConfig and never contain secrets (no passcode, no links).
 */
import * as v from 'valibot';
import {
  type ParseResult,
  type RoomConfig,
  type RoomConfigInput,
  RoomConfigSchema,
} from './schemas.ts';
import { hasUnsafeChars } from './text.ts';

export const PRESET_FORMAT = 'backlogfit-preset';
export const PRESET_VERSION = 1;
export const PRESET_MAX_BYTES = 64 * 1024;
export const PRESET_NAME_MAX = 60;

/** Lifetimes offered by the configurator (hours). */
export const LIFETIME_CHOICES_HOURS = [1, 2, 4, 8] as const;
export type LifetimeHours = (typeof LIFETIME_CHOICES_HOURS)[number];
export const DEFAULT_LIFETIME_HOURS: LifetimeHours = 2;

const NameSchema = v.pipe(
  v.string(),
  v.maxLength(PRESET_NAME_MAX * 4),
  v.normalize('NFC'),
  v.trim(),
  v.minLength(1),
  v.maxLength(PRESET_NAME_MAX),
  v.check((s) => !hasUnsafeChars(s), 'unsafe characters'),
);

export const PresetSchema = v.strictObject({
  format: v.literal(PRESET_FORMAT),
  v: v.literal(PRESET_VERSION),
  name: v.optional(v.nullable(NameSchema), null),
  lifetimeHours: v.optional(v.nullable(v.picklist(LIFETIME_CHOICES_HOURS)), null),
  config: RoomConfigSchema,
});

export type Preset = v.InferOutput<typeof PresetSchema>;

export interface PresetMeta {
  name?: string | null;
  lifetimeHours?: LifetimeHours | null;
}

/**
 * Accepts a JSON string (size-capped) or an already parsed value. A bare RoomConfig without the
 * envelope is accepted too (treated as an unnamed v1 preset). A preset envelope with another
 * version yields `unsupported_version`.
 */
export function parsePreset(input: string | unknown): ParseResult<Preset> {
  let data: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > PRESET_MAX_BYTES) {
      return { ok: false, code: 'too_large' };
    }
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, code: 'bad_json' };
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, code: 'invalid_message' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.format === undefined && obj.v === undefined && 'scale' in obj) {
    data = { format: PRESET_FORMAT, v: PRESET_VERSION, config: obj };
  } else if (obj.format === PRESET_FORMAT && obj.v !== PRESET_VERSION) {
    return { ok: false, code: 'unsupported_version' };
  }
  const r = v.safeParse(PresetSchema, data);
  return r.success ? { ok: true, msg: r.output } : { ok: false, code: 'invalid_message' };
}

/**
 * Serialize a config (validated, defaults filled in) as a pretty-printed preset file.
 * Throws TypeError if the config or metadata is invalid.
 */
export function serializePreset(
  config: RoomConfig | RoomConfigInput,
  meta: PresetMeta = {},
): string {
  const r = v.safeParse(PresetSchema, {
    format: PRESET_FORMAT,
    v: PRESET_VERSION,
    name: meta.name ?? null,
    lifetimeHours: meta.lifetimeHours ?? null,
    config,
  });
  if (!r.success) throw new TypeError('invalid preset');
  return `${JSON.stringify(r.output, null, 2)}\n`;
}
