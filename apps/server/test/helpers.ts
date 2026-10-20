import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import {
  type ClientMessageInput,
  hashSecret,
  parseServerMessage,
  presetScale,
  type RoomConfigInput,
  randomToken,
  type ServerMessage,
} from '@backlogfit/core';
import { WebSocket } from 'ws';
import { type RunningServer, startServer } from '../src/app.ts';
import { readConfig } from '../src/config.ts';

export const ORIGIN = 'http://app.test';

export function tempDir(prefix = 'bf-'): { path: string; cleanup: () => void } {
  const path = mkdtempSync(pathJoin(tmpdir(), prefix));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}

export async function start(env: Record<string, string> = {}): Promise<RunningServer> {
  return startServer(
    readConfig({
      NODE_ENV: 'test',
      PORT: '0',
      HOST: '127.0.0.1',
      PUBLIC_ORIGIN: ORIGIN,
      WEB_DIR: pathJoin(tmpdir(), 'bf-no-web-build'),
      ...env,
    }),
  );
}

export function base(s: RunningServer): string {
  return `http://127.0.0.1:${s.port}`;
}

export interface CreatedRoom {
  roomId: string;
  expiresAt: number;
  joinSecret: string;
  adminSecret: string;
}

export function createBody(
  joinHash: string,
  adminHash: string,
  over: { config?: Partial<RoomConfigInput>; lifetimeHours?: number } = {},
) {
  return {
    v: 1,
    config: { scale: presetScale('fibonacci'), ...over.config },
    joinHash,
    adminHash,
    lifetimeHours: over.lifetimeHours ?? 2,
  };
}

export function postRoom(s: RunningServer, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base(s)}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export async function createRoom(
  s: RunningServer,
  over: { config?: Partial<RoomConfigInput>; lifetimeHours?: number } = {},
): Promise<CreatedRoom> {
  const joinSecret = randomToken();
  const adminSecret = randomToken();
  const res = await postRoom(
    s,
    createBody(await hashSecret(joinSecret), await hashSecret(adminSecret), over),
  );
  if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
  const { roomId, expiresAt } = (await res.json()) as { roomId: string; expiresAt: number };
  return { roomId, expiresAt, joinSecret, adminSecret };
}

export class Client {
  readonly ws: WebSocket;
  readonly frames: string[] = [];
  readonly messages: ServerMessage[] = [];
  readonly opened: Promise<void>;
  readonly closed: Promise<{ code: number }>;
  #waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  #seen = 0;

  constructor(url: string, origin: string | null = ORIGIN) {
    this.ws = new WebSocket(url, origin === null ? {} : { origin });
    this.opened = new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('unexpected-response', (_req, res) =>
        reject(new Error(`unexpected-response ${res.statusCode}`)),
      );
      this.ws.once('error', reject);
    });
    this.opened.catch(() => undefined);
    this.closed = new Promise((resolve) => this.ws.once('close', (code) => resolve({ code })));
    this.ws.on('message', (data) => {
      const text = data.toString();
      this.frames.push(text);
      const parsed = parseServerMessage(text);
      if (!parsed.ok) throw new Error(`server sent an invalid message: ${text}`);
      this.messages.push(parsed.msg);
      this.#waiters = this.#waiters.filter((w) => {
        if (!w.pred(parsed.msg)) return true;
        w.resolve(parsed.msg);
        return false;
      });
    });
  }

  static async open(s: RunningServer, roomId: string, origin: string | null = ORIGIN) {
    const c = new Client(`ws://127.0.0.1:${s.port}/ws/${roomId}`, origin);
    await c.opened;
    return c;
  }

  send(msg: ClientMessageInput | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  next<T extends ServerMessage['type']>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 5000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (m: ServerMessage) =>
      m.type === type && pred(m as Extract<ServerMessage, { type: T }>);
    for (let i = this.#seen; i < this.messages.length; i++) {
      const m = this.messages[i] as ServerMessage;
      if (match(m)) {
        this.#seen = i + 1;
        return Promise.resolve(m as Extract<ServerMessage, { type: T }>);
      }
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      this.#waiters.push({
        pred: match,
        resolve: (m) => {
          clearTimeout(timer);
          this.#seen = this.messages.length;
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}

export async function join(
  s: RunningServer,
  room: CreatedRoom,
  name: string,
  opts: { admin?: boolean; role?: 'voter' | 'spectator'; resumeToken?: string } = {},
) {
  const c = await Client.open(s, room.roomId);
  c.send({
    type: 'hello',
    v: 1,
    joinSecret: room.joinSecret,
    name,
    role: opts.role ?? 'voter',
    ...(opts.admin ? { adminSecret: room.adminSecret } : {}),
    ...(opts.resumeToken ? { resumeToken: opts.resumeToken } : {}),
  });
  const welcome = await c.next('welcome');
  return { c, welcome };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
