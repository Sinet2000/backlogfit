/**
 * Adapter-side authentication helpers (see ADR-0005). These are async because WebCrypto is, and
 * they are the only part of core that touches globalThis.crypto. The reducer itself only sees
 * the boolean outcome (HelloAuth).
 */
import type { HelloMessage } from './schemas.ts';
import type { HelloAuth, RoomState } from './state.ts';

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Lower-case hex SHA-256 of the UTF-8 encoding of `s`. */
export async function hashSecret(s: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(s));
  return toHex(new Uint8Array(digest));
}

/** Passcodes are NFC-normalized and trimmed, then hashed with a per-room salt. */
export function hashPasscode(salt: string, passcode: string): Promise<string> {
  return hashSecret(`${salt}:${passcode.normalize('NFC').trim()}`);
}

/**
 * Constant-time equality for digests/tokens. Runs over the longer input regardless of where the
 * first difference is; a length mismatch is folded into the result rather than returned early.
 */
export function ctEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const x = typeof a === 'string' ? encoder.encode(a) : a;
  const y = typeof b === 'string' ? encoder.encode(b) : b;
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** base64url random token (default 128 bits) from the platform CSPRNG. */
export function randomToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 hex chars of salt for a new passcode. */
export function randomSalt(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return toHex(buf);
}

export interface RoomSecrets {
  joinHash: string;
  adminHash: string;
  passcode: { salt: string; hash: string } | null;
  resume: { participantId: string; hash: string }[];
}

export function secretsOf(state: RoomState): RoomSecrets {
  return {
    joinHash: state.secrets.joinHash,
    adminHash: state.secrets.adminHash,
    passcode: state.secrets.passcode,
    resume: state.participants.map((p) => ({ participantId: p.id, hash: p.resumeHash })),
  };
}

/**
 * Hash the secrets in a hello and compare them (constant time) with the stored hashes.
 * Every comparison runs regardless of earlier results. Also mints the next resume token.
 */
export async function verifyHello(
  secrets: RoomSecrets,
  hello: HelloMessage,
  newToken: () => string = randomToken,
): Promise<HelloAuth> {
  const joinOk = ctEqual(await hashSecret(hello.joinSecret), secrets.joinHash);
  const adminOk =
    hello.adminSecret !== undefined &&
    ctEqual(await hashSecret(hello.adminSecret), secrets.adminHash);

  let passcodeOk: boolean | null = null;
  if (secrets.passcode) {
    passcodeOk =
      hello.passcode !== undefined &&
      ctEqual(await hashPasscode(secrets.passcode.salt, hello.passcode), secrets.passcode.hash);
  }

  let resumeParticipantId: string | null = null;
  if (hello.resumeToken !== undefined) {
    const h = await hashSecret(hello.resumeToken);
    for (const r of secrets.resume) {
      if (ctEqual(h, r.hash) && resumeParticipantId === null) resumeParticipantId = r.participantId;
    }
  }

  const token = newToken();
  return {
    joinOk,
    adminOk,
    passcodeOk,
    resumeParticipantId: joinOk ? resumeParticipantId : null,
    resume: { token, hash: await hashSecret(token) },
  };
}
