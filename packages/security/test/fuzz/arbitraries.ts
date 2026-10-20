import fc from 'fast-check';

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
  '­',
  '͏',
  '؜',
  'ᅟ',
  '᠎',
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
  '‮',
  '⁠',
  '⁦',
  '⁧',
  '⁨',
  '⁩',
  '⠀',
  'ㅤ',
  '﻿',
  '￹',
  '￼',
  '�',
  '￿',
  '\ud800',
  '\udfff',
  '\u{e0001}',
  '\u{e0041}',
  '\u{1f600}',
  'é',
  'é',
  'а',
  'ο',
  'ｂ',
  '℀',
  '﹫',
  '＠',
  '／',
  '．',
  '。',
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
