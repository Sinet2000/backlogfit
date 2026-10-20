/**
 * Create a room: secrets are generated here (WebCrypto, 128-bit) and only their SHA-256 hashes
 * are POSTed. The secrets go into the fragment of the returned links and nowhere else.
 */
import {
  hashPasscode,
  hashSecret,
  type LifetimeHours,
  type RoomConfig,
  type RoomLink,
  randomSalt,
  randomToken,
} from '@backlogfit/core';

export interface CreateInput {
  config: RoomConfig;
  lifetimeHours: LifetimeHours;
  passcode: string;
}

export interface CreatedRoom {
  link: RoomLink;
  expiresAt: number;
}

export type CreateError = 'network' | 'forbidden' | 'rejected' | 'rate_limited' | 'server';

export class CreateRoomError extends Error {
  readonly kind: CreateError;
  constructor(kind: CreateError) {
    super(kind);
    this.kind = kind;
  }
}

const ROOM_ID = /^[A-Za-z0-9_-]{16,64}$/;

export async function buildCreateRequest(input: CreateInput): Promise<{
  body: Record<string, unknown>;
  joinSecret: string;
  adminSecret: string;
}> {
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const passcode = input.passcode.trim();
  const salt = randomSalt();
  const body: Record<string, unknown> = {
    v: 1,
    config: input.config,
    joinHash: await hashSecret(joinSecret),
    adminHash: await hashSecret(adminSecret),
    lifetimeHours: input.lifetimeHours,
    ...(passcode ? { passcode: { salt, hash: await hashPasscode(salt, passcode) } } : {}),
  };
  return { body, joinSecret, adminSecret };
}

export async function createRoomOnServer(
  input: CreateInput,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<CreatedRoom> {
  const { body, joinSecret, adminSecret } = await buildCreateRequest(input);
  let res: Response;
  try {
    res = await fetcher('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new CreateRoomError('network');
  }
  if (res.status === 403) throw new CreateRoomError('forbidden');
  if (res.status === 429) throw new CreateRoomError('rate_limited');
  if (res.status === 400 || res.status === 413 || res.status === 422) {
    throw new CreateRoomError('rejected');
  }
  if (!res.ok) throw new CreateRoomError(res.status >= 500 ? 'server' : 'network');
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new CreateRoomError('server');
  }
  const d = data as { roomId?: unknown; expiresAt?: unknown };
  if (typeof d.roomId !== 'string' || !ROOM_ID.test(d.roomId) || typeof d.expiresAt !== 'number') {
    throw new CreateRoomError('server');
  }
  return {
    link: { roomId: d.roomId, joinSecret, adminSecret, contentKey: null },
    expiresAt: d.expiresAt,
  };
}

export const CREATE_ERROR_TEXT: Record<CreateError, string> = {
  network: 'The Backlogfit server could not be reached. Check your connection and try again.',
  forbidden:
    'This server does not accept sessions from this address. Ask your administrator to add it to PUBLIC_ORIGIN or ALLOWED_ORIGINS.',
  rejected: 'The server did not accept these settings. Please review them and try again.',
  rate_limited:
    'Too many sessions were created from here in a short time. Wait a minute and try again.',
  server: 'Something went wrong on the server. Please try again in a moment.',
};
