/**
 * Text hygiene shared by schemas and task parsing.
 *
 * "Unsafe" covers C0/C1 control characters, zero-width characters and bidi
 * embedding/override/isolate controls (used for spoofing names and titles).
 */
export function isUnsafeCodePoint(cp: number): boolean {
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2069) ||
    cp === 0xfeff
  );
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
