/**
 * Text hygiene shared by schemas and task parsing.
 *
 * "Unsafe" covers C0/C1 control characters, lone surrogates, zero-width and other invisible
 * format characters, bidi embedding/override/isolate controls and marks, invisible fillers
 * (Hangul fillers, Braille blank) and tag characters: everything used to make a name look blank
 * or identical to someone else's (SEC-002).
 */
export function isUnsafeCodePoint(cp: number): boolean {
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    cp === 0xad || // soft hyphen
    cp === 0x34f || // combining grapheme joiner
    cp === 0x61c || // arabic letter mark
    cp === 0x115f ||
    cp === 0x1160 || // hangul choseong/jungseong fillers
    cp === 0x17b4 ||
    cp === 0x17b5 || // khmer inherent vowels
    cp === 0x180e || // mongolian vowel separator
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x206f) ||
    cp === 0x2800 || // braille blank
    cp === 0x3164 || // hangul filler
    (cp >= 0xd800 && cp <= 0xdfff) || // lone surrogates (for…of yields them unpaired)
    cp === 0xfeff ||
    cp === 0xffa0 || // halfwidth hangul filler
    (cp >= 0xfff0 && cp <= 0xfff8) ||
    (cp >= 0x1bca0 && cp <= 0x1bca3) || // shorthand format controls
    (cp >= 0x1d173 && cp <= 0x1d17a) || // musical format controls
    (cp >= 0xe0000 && cp <= 0xe007f) // tag characters
  );
}

const VISIBLE = /[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{M}\p{C}]/u;

/** True if `s` has at least one character that renders as something (not space, mark or format). */
export function hasVisibleChar(s: string): boolean {
  return VISIBLE.test(s);
}

export function hasUnsafeChars(s: string): boolean {
  for (const ch of s) {
    if (isUnsafeCodePoint(ch.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

/** NFC-normalize and trim, the canonical form for user-visible text. */
export function cleanText(s: string): string {
  return s.normalize('NFC').trim();
}
