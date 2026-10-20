import {
  type Card,
  hashPasscode,
  hashSecret,
  type PresetId,
  presetScale,
  randomSalt,
  randomToken,
} from '@backlogfit/core';
import { BASE_URL } from './env.ts';

export interface ApiRoomOptions {
  baseURL?: string;
  preset?: PresetId;
  scale?: Card[];
  lifetimeHours?: number;
  passcode?: string;
  taskPolicy?: 'ids' | 'links' | 'allowlist';
  allowlist?: string[];
  linkTemplate?: string | null;
  autoReveal?: boolean;
  anonymousAfterReveal?: boolean;
  allowSpectators?: boolean;
  lobby?: boolean;
  timerSeconds?: number | null;
  maxParticipants?: number;
  theme?: 'corporate' | 'colorful';
}

export interface RoomLinks {
  baseURL: string;
  roomId: string;
  joinSecret: string;
  adminSecret: string;
  expiresAt: number;
  joinLink: string;
  adminLink: string;
}

export function linksFor(
  baseURL: string,
  roomId: string,
  joinSecret: string,
  adminSecret: string,
): Pick<RoomLinks, 'joinLink' | 'adminLink'> {
  const base = baseURL.replace(/\/$/, '');
  return {
    joinLink: `${base}/r#${roomId}.${joinSecret}`,
    adminLink: `${base}/r#${roomId}.${joinSecret}.${adminSecret}`,
  };
}

/** Parse `/r#roomId.joinSecret[.adminSecret]` (any origin). */
export function parseLink(link: string): {
  roomId: string;
  joinSecret: string;
  adminSecret: string | null;
} {
  const hash = new URL(link).hash.slice(1);
  const [roomId, joinSecret, adminSecret] = hash.split('.');
  if (!roomId || !joinSecret) throw new Error(`not a room link: ${link}`);
  return { roomId, joinSecret, adminSecret: adminSecret ?? null };
}

export async function createRoomApi(opts: ApiRoomOptions = {}): Promise<RoomLinks> {
  const baseURL = opts.baseURL ?? BASE_URL;
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const config: Record<string, unknown> = {
    scale: opts.scale ?? presetScale(opts.preset ?? 'fibonacci'),
    taskPolicy: opts.taskPolicy ?? 'ids',
    autoReveal: opts.autoReveal ?? false,
    anonymousAfterReveal: opts.anonymousAfterReveal ?? false,
    allowSpectators: opts.allowSpectators ?? true,
    lobby: opts.lobby ?? false,
    timerSeconds: opts.timerSeconds ?? null,
    maxParticipants: opts.maxParticipants ?? 50,
    theme: opts.theme ?? 'corporate',
  };
  if (opts.allowlist) config.allowlist = opts.allowlist;
  if (opts.linkTemplate !== undefined) config.linkTemplate = opts.linkTemplate;

  const body: Record<string, unknown> = {
    v: 1,
    config,
    joinHash: await hashSecret(joinSecret),
    adminHash: await hashSecret(adminSecret),
    lifetimeHours: opts.lifetimeHours ?? 8,
  };
  if (opts.passcode !== undefined) {
    const salt = randomSalt();
    body.passcode = { salt, hash: await hashPasscode(salt, opts.passcode) };
  }

  const res = await fetch(new URL('/api/rooms', baseURL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: new URL(baseURL).origin },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) {
    throw new Error(`POST /api/rooms → ${res.status}: ${await res.text()}`);
  }
  const { roomId, expiresAt } = (await res.json()) as { roomId: string; expiresAt: number };
  return {
    baseURL,
    roomId,
    joinSecret,
    adminSecret,
    expiresAt,
    ...linksFor(baseURL, roomId, joinSecret, adminSecret),
  };
}
