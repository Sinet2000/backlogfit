/**
 * Phase 2 design (ADR-0008): end-to-end encrypted task content.
 *
 * Nothing here is wired into the v1 reducer or ClientMessageSchema; plaintext rooms behave
 * exactly as before. The schemas define what a server may accept as opaque ciphertext, and the
 * WebCrypto helpers are what browsers would run. The key lives only in the URL fragment.
 */
import * as v from 'valibot';
import { LINES_PER_ADD_MAX, type ParseResult } from './schemas.ts';
import {
  type ParsedTask,
  parseTaskLine,
  TASK_KEY_MAX,
  TASK_TITLE_MAX,
  type TaskLineResult,
  type TaskParseOptions,
  URL_MAX,
} from './tasks.ts';

export const CONTENT_KEY_BYTES = 32;
export const ENC_IV_BYTES = 12;
export const ENC_TAG_BYTES = 16;
/** Plaintext is padded to a multiple of this, so ciphertext sizes reveal only a size bucket. */
export const ENC_PAD_BLOCK = 256;
/** Largest padded plaintext. A task line of at most 4095 UTF-8 bytes fits. */
export const ENC_PLAINTEXT_MAX_BYTES = 4096;
/** base64url length of the largest ciphertext (padded plaintext + GCM tag). */
export const ENC_CT_MAX_CHARS = Math.ceil(((ENC_PLAINTEXT_MAX_BYTES + ENC_TAG_BYTES) * 4) / 3);

const B64URL = /^[A-Za-z0-9_-]*$/;
const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

/** Byte length encoded by an unpadded base64url string, or null if no length maps to it. */
function decodedLength(chars: number): number | null {
  const r = chars % 4;
  if (r === 1) return null;
  return Math.floor(chars / 4) * 3 + (r === 0 ? 0 : r - 1);
}

function validCiphertextLength(ct: string): boolean {
  const n = decodedLength(ct.length);
  if (n === null || n <= ENC_TAG_BYTES) return false;
  const padded = n - ENC_TAG_BYTES;
  return padded % ENC_PAD_BLOCK === 0 && padded <= ENC_PLAINTEXT_MAX_BYTES;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Strict base64url decode; null for anything that is not canonical unpadded base64url. */
export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!B64URL.test(s) || decodedLength(s.length) === null) return null;
  let bin: string;
  try {
    bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return toBase64Url(out) === s ? out : null;
}

// ---------------------------------------------------------------------------------------------
// Schemas (what a server may accept; it never sees the key)

/**
 * Opaque encrypted task content. The server checks shape and size only: `iv` is 96 bits,
 * `ct` decodes to (k × ENC_PAD_BLOCK) + 16 bytes with k ≥ 1 and at most ENC_PLAINTEXT_MAX_BYTES
 * of padded plaintext.
 */
export const EncryptedContentSchema = v.strictObject({
  t: v.literal('enc'),
  iv: v.pipe(v.string(), v.length(16), v.regex(B64URL)),
  ct: v.pipe(
    v.string(),
    v.maxLength(ENC_CT_MAX_CHARS),
    v.regex(B64URL),
    v.check(validCiphertextLength, 'invalid ciphertext length'),
  ),
});
export type EncryptedContent = v.InferOutput<typeof EncryptedContentSchema>;

/** Plaintext content as v1 rooms already store it (Task.key/title/url). */
export const PlainContentSchema = v.strictObject({
  t: v.literal('plain'),
  key: v.nullable(v.pipe(v.string(), v.maxLength(TASK_KEY_MAX))),
  title: v.nullable(v.pipe(v.string(), v.maxLength(TASK_TITLE_MAX))),
  url: v.nullable(v.pipe(v.string(), v.maxLength(URL_MAX))),
});
export type PlainContent = v.InferOutput<typeof PlainContentSchema>;

/** Phase 2 tagged union for Task content (PLAN §3.6). */
export const TaskContentSchema = v.variant('t', [PlainContentSchema, EncryptedContentSchema]);
export type TaskContent = v.InferOutput<typeof TaskContentSchema>;

/**
 * Reserved Phase 2 message for encrypted rooms. Not part of ClientMessageSchema: a v1 server
 * rejects it as `invalid_message`. Clients batch so the frame stays under MAX_MESSAGE_BYTES.
 */
export const EncryptedTasksAddSchema = v.strictObject({
  type: v.literal('admin.tasks.addEncrypted'),
  items: v.pipe(v.array(EncryptedContentSchema), v.minLength(1), v.maxLength(LINES_PER_ADD_MAX)),
});
export type EncryptedTasksAdd = v.InferOutput<typeof EncryptedTasksAddSchema>;

export function parseEncryptedContent(data: unknown): ParseResult<EncryptedContent> {
  const r = v.safeParse(EncryptedContentSchema, data);
  return r.success ? { ok: true, msg: r.output } : { ok: false, code: 'invalid_message' };
}

/** The v1 task fields as a `plain` content value (what plaintext rooms keep doing). */
export function plainContentOf(task: ParsedTask): PlainContent {
  return { t: 'plain', key: task.key, title: task.title, url: task.url };
}

// ---------------------------------------------------------------------------------------------
// Padding (ISO/IEC 7816-4: 0x80 then zeros)

export function padPlaintext(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const len = Math.ceil((bytes.length + 1) / ENC_PAD_BLOCK) * ENC_PAD_BLOCK;
  if (len > ENC_PLAINTEXT_MAX_BYTES) return null;
  const out = new Uint8Array(len);
  out.set(bytes);
  out[bytes.length] = 0x80;
  return out;
}

export function unpadPlaintext(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length === 0 || bytes.length % ENC_PAD_BLOCK !== 0) return null;
  let i = bytes.length - 1;
  while (i >= 0 && bytes[i] === 0) i--;
  if (i < 0 || bytes[i] !== 0x80) return null;
  return bytes.slice(0, i);
}

// ---------------------------------------------------------------------------------------------
// Browser-side helpers (WebCrypto AES-256-GCM)

export const ContentKeySchema = v.pipe(v.string(), v.length(43), v.regex(B64URL));

/** New 256-bit room content key, base64url (43 chars), for the link fragment only. */
export function generateContentKey(): string {
  const buf = new Uint8Array(CONTENT_KEY_BYTES);
  globalThis.crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

async function importContentKey(key: string): Promise<CryptoKey> {
  const raw = fromBase64Url(key);
  if (raw === null || raw.length !== CONTENT_KEY_BYTES) throw new TypeError('invalid content key');
  return globalThis.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Additional data binds a ciphertext to its room, so it cannot be replayed into another one. */
function aad(roomId: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(`backlogfit:e2ee:v1:${roomId}`));
}

/**
 * Encrypt one raw backlog line with a fresh random 96-bit IV. The line is encrypted as typed;
 * parsing and link policy run after decryption on every client (decryptTask).
 * Throws RangeError if the line exceeds ENC_PLAINTEXT_MAX_BYTES - 1 bytes.
 */
export async function encryptTaskLine(
  key: string,
  roomId: string,
  line: string,
): Promise<EncryptedContent> {
  const padded = padPlaintext(encoder.encode(line));
  if (padded === null) throw new RangeError('task line too long to encrypt');
  const iv = new Uint8Array(ENC_IV_BYTES);
  globalThis.crypto.getRandomValues(iv);
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(roomId) },
    await importContentKey(key),
    padded,
  );
  return { t: 'enc', iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(ct)) };
}

/** Decrypt to the raw line, or null if the key, room, tag, padding or UTF-8 is wrong. */
export async function decryptTaskLine(
  key: string,
  roomId: string,
  content: EncryptedContent,
): Promise<string | null> {
  const iv = fromBase64Url(content.iv);
  const ct = fromBase64Url(content.ct);
  if (iv === null || iv.length !== ENC_IV_BYTES || ct === null) return null;
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad(roomId) },
      await importContentKey(key),
      ct,
    );
    const unpadded = unpadPlaintext(new Uint8Array(plain));
    return unpadded === null ? null : strictDecoder.decode(unpadded);
  } catch {
    return null;
  }
}

export type DecryptTaskResult = TaskLineResult | { ok: false; error: 'undecryptable' };

/**
 * Decrypt and parse with the room's link policy. In encrypted rooms this client-side check is
 * the only link policy enforcement, so clients must render nothing that fails it.
 */
export async function decryptTask(
  key: string,
  roomId: string,
  content: EncryptedContent,
  policy: TaskParseOptions,
): Promise<DecryptTaskResult> {
  const line = await decryptTaskLine(key, roomId, content);
  if (line === null) return { ok: false, error: 'undecryptable' };
  return parseTaskLine(line, policy);
}
