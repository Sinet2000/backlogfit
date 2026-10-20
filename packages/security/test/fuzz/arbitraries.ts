import fc from 'fast-check';

/** Characters that have bitten real systems: controls, bidi, invisibles, surrogates, lookalikes. */
export const NASTY_CHARS = [
  '\u0000',
  '\u0007',
  '\u0008',
  '\t',
  '\n',
  '\r',
  '\u001b',
  '\u007f',
  '\u0085',
  ' ',
  '­', // soft hyphen
  '͏', // combining grapheme joiner
  '؜', // arabic letter mark
  'ᅟ', // hangul choseong filler
  '᠎', // mongolian vowel separator
  '​',
  '‌',
  '‍',
  '‎',
  '‏',
  ' ',
  ' ',
  '‪',
  '‫',
  '‬',
  '‭',
  '‮', // RLO
  '⁠',
  '⁦',
  '⁧',
  '⁨',
  '⁩',
  '⠀', // braille blank
  'ㅤ', // hangul filler
  '﻿',
  '￹',
  '￼',
  '�',
  '￿',
  '\ud800', // lone high surrogate
  '\udfff', // lone low surrogate
  '\u{e0001}', // language tag
  '\u{e0041}', // tag latin A
  '\u{1f600}',
  'é', // precomposed
  'é', // decomposed
  'а', // cyrillic a
  'ο', // greek omicron
  'ｂ', // fullwidth b
  '℀',
  '﹫', // small commercial at
  '＠', // fullwidth at
  '／', // fullwidth solidus
  '．', // fullwidth full stop
  '。', // ideographic full stop (IDNA dot)
  '\\',
  '"',
  "'",
  '<',
  '>',
  '&',
  '`',
  '=',
  '+',
  '-',
  '@',
  '%',
  '#',
  '?',
  '/',
  ':',
] as const;

export const nastyChar = fc.constantFrom(...NASTY_CHARS);

/** Strings mixing plain text, nasty characters and full-range code units. */
export const nastyString = (maxLength = 60) =>
  fc
    .array(
      fc.oneof(
        { weight: 4, arbitrary: fc.string({ maxLength: 6 }) },
        { weight: 3, arbitrary: nastyChar },
        { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 3 }) },
      ),
      { maxLength },
    )
    .map((parts) => parts.join(''));

/** Keys that try to reach the prototype chain or shadow builtins. */
export const POLLUTION_KEYS = [
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__defineGetter__',
  'isAdmin',
  'authority',
  'admin',
] as const;

export const pollutionKey = fc.constantFrom(...POLLUTION_KEYS);

/** Numbers that are legal JSON but semantically hostile. */
export const hostileNumber = fc.oneof(
  fc.constantFrom(
    0,
    -0,
    1,
    -1,
    0.5,
    1.0000000000000002,
    2 ** 31,
    2 ** 32,
    2 ** 53,
    2 ** 53 + 2,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    1e21,
    -1e21,
  ),
  fc.double(),
  fc.integer(),
);

/** JSON text for numbers JSON.stringify cannot produce (overflow to Infinity, huge exponents). */
export const HOSTILE_NUMBER_LITERALS = [
  '1e400',
  '-1e400',
  '1e-400',
  '123456789012345678901234567890',
  '1.0',
  '1E0',
  '-0.0',
  '0.0000000000000000000000000001e28',
] as const;
