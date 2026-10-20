/** WebSocket close codes the adapters use for transport-level closes (RFC 6455). */
export const WS_CLOSE_GOING_AWAY = 1001;
export const WS_CLOSE_POLICY_VIOLATION = 1008;
export const WS_CLOSE_MESSAGE_TOO_BIG = 1009;

export type FrameData = string | ArrayBuffer | ArrayBufferView | readonly ArrayBufferView[];

/**
 * UTF-8 byte length of a string without allocating, stopping early once `limit` is exceeded.
 * Lone surrogates count 3 bytes (they encode as U+FFFD).
 */
export function utf8Length(s: string, limit = Number.POSITIVE_INFINITY): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    } else n += 3;
    if (n > limit) return n;
  }
  return n;
}

/** Byte size of a frame, or null for a value that is not frame data. */
export function frameByteLength(data: unknown, limit = Number.POSITIVE_INFINITY): number | null {
  if (typeof data === 'string') return utf8Length(data, limit);
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (Array.isArray(data)) {
    let n = 0;
    for (const part of data) {
      if (!ArrayBuffer.isView(part)) return null;
      n += part.byteLength;
    }
    return n;
  }
  return null;
}

/**
 * True when a frame exceeds `maxBytes` (UTF-8 bytes for text) or is not frame data at all.
 * Check this before JSON.parse. Prefer also setting the library's own cap (ws `maxPayload`) so
 * oversized frames are refused before they are buffered.
 */
export function frameTooLarge(data: unknown, maxBytes: number): boolean {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) return true;
  if (typeof data === 'string') {
    if (data.length > maxBytes) return true;
    if (data.length * 3 <= maxBytes) return false;
  }
  const n = frameByteLength(data, maxBytes);
  return n === null || n > maxBytes;
}
