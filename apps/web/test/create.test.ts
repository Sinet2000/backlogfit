import { presetScale } from '@backlogfit/core';
import { describe, expect, it } from 'vitest';
import { defaultDraft, toRoomConfig } from '../src/lib/config/draft.ts';
import { CreateRoomError, createRoomOnServer } from '../src/lib/room/create.ts';

const config = toRoomConfig({ ...defaultDraft(), scale: presetScale('fibonacci') });
if (!config) throw new Error('default draft must be valid');
const input = { config, lifetimeHours: 2 as const, passcode: '' };

const reply = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

async function kindOf(fetcher: typeof fetch): Promise<string> {
  try {
    await createRoomOnServer(input, fetcher);
    return 'ok';
  } catch (e) {
    return e instanceof CreateRoomError ? e.kind : 'other';
  }
}

describe('createRoomOnServer', () => {
  it('maps failures to clear error kinds', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await kindOf(down)).toBe('network');
    expect(await kindOf(reply(403))).toBe('forbidden');
    expect(await kindOf(reply(429))).toBe('rate_limited');
    expect(await kindOf(reply(400))).toBe('rejected');
    expect(await kindOf(reply(503))).toBe('server');
    expect(await kindOf(reply(201, { roomId: 'bad id' }))).toBe('server');
  });

  it('returns the link with locally generated secrets', async () => {
    let sent = '';
    const ok = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return new Response(JSON.stringify({ roomId: 'A'.repeat(22), expiresAt: 1 }), {
        status: 201,
      });
    }) as unknown as typeof fetch;
    const room = await createRoomOnServer(input, ok);
    expect(room.link.roomId).toBe('A'.repeat(22));
    expect(sent).not.toContain(room.link.joinSecret);
    expect(sent).not.toContain(room.link.adminSecret ?? '');
  });
});
