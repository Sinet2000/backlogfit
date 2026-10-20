import { env, runInDurableObject, SELF } from 'cloudflare:test';
import {
  type ClientMessageInput,
  hashSecret,
  parseServerMessage,
  presetScale,
  randomToken,
  type ServerMessage,
} from '@backlogfit/core';
import type { Env } from '../src/env.ts';

export const ORIGIN = 'http://app.test';
export const BASE = 'http://app.test';
export const rooms = (env as unknown as Env).ROOMS;

export interface Room {
  roomId: string;
  joinSecret: string;
  adminSecret: string;
}

export function body(
  joinHash: string,
  adminHash: string,
  lobby = false,
  teams: { id: string; name: string }[] = [],
) {
  return {
    v: 1,
    config: { scale: presetScale('fibonacci'), lobby, teams },
    joinHash,
    adminHash,
    lifetimeHours: 2,
  };
}

export function post(data: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

export async function createRoom(
  lobby = false,
  teams: { id: string; name: string }[] = [],
): Promise<Room> {
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const hashes = [await hashSecret(joinSecret), await hashSecret(adminSecret)] as const;
  const res = await post(body(...hashes, lobby, teams), {
    'cf-connecting-ip': randomIp(),
  });
  if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
  const { roomId } = (await res.json()) as { roomId: string };
  return { roomId, joinSecret, adminSecret };
}

export function randomIp(): string {
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  return `203.0.${b[0]}.${b[1]}`;
}

export function upgrade(roomId: string, origin: string | null = ORIGIN, ip: string = randomIp()) {
  return SELF.fetch(`${BASE}/ws/${roomId}`, {
    headers: { upgrade: 'websocket', 'cf-connecting-ip': ip, ...(origin ? { origin } : {}) },
  });
}

export function stubOf(roomId: string) {
  return rooms.get(rooms.idFromName(roomId));
}

export class Client {
  readonly messages: ServerMessage[] = [];
  readonly frames: string[] = [];
  readonly closed: Promise<number>;
  #seen = 0;
  #wake: (() => void) | null = null;

  readonly ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.accept();
    this.closed = new Promise((resolve) => ws.addEventListener('close', (e) => resolve(e.code)));
    ws.addEventListener('message', (e) => {
      const text = typeof e.data === 'string' ? e.data : '';
      this.frames.push(text);
      const parsed = parseServerMessage(text);
      if (!parsed.ok) throw new Error(`invalid server message ${text}`);
      this.messages.push(parsed.msg);
      this.#wake?.();
    });
  }

  static async open(
    roomId: string,
    origin: string | null = ORIGIN,
    ip: string = randomIp(),
  ): Promise<Client> {
    const res = await upgrade(roomId, origin, ip);
    if (!res.webSocket) throw new Error(`upgrade refused: ${res.status}`);
    return new Client(res.webSocket);
  }

  send(msg: ClientMessageInput | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  async next<T extends ServerMessage['type']>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + 5000;
    for (;;) {
      for (let i = this.#seen; i < this.messages.length; i++) {
        const m = this.messages[i] as ServerMessage;
        if (m.type === type && pred(m as Extract<ServerMessage, { type: T }>)) {
          this.#seen = i + 1;
          return m as Extract<ServerMessage, { type: T }>;
        }
      }
      if (Date.now() > deadline) throw new Error(`timeout waiting for ${type}`);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        this.#wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
    }
  }
}

export async function join(room: Room, name: string, admin = false) {
  const c = await Client.open(room.roomId);
  c.send({
    type: 'hello',
    v: 1,
    joinSecret: room.joinSecret,
    name,
    role: 'voter',
    ...(admin ? { adminSecret: room.adminSecret } : {}),
  });
  const welcome = await c.next('welcome');
  return { c, welcome };
}

export async function tables(roomId: string): Promise<string[]> {
  return runInDurableObject(stubOf(roomId), (_i, state) =>
    state.storage.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
      )
      .toArray()
      .map((r) => r.name),
  );
}

export async function storageKeys(roomId: string): Promise<number> {
  return runInDurableObject(stubOf(roomId), async (_instance, state) => {
    const rows = state.storage.sql
      .exec<{ n: number }>(
        "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'room'",
      )
      .one().n;
    const data = rows ? state.storage.sql.exec('SELECT * FROM room').toArray().length : 0;
    const alarm = await state.storage.getAlarm();
    return data + (alarm === null ? 0 : 1);
  });
}
