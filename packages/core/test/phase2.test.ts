import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  authorityFromGroups,
  ClientMessageSchema,
  decryptTask,
  decryptTaskLine,
  displayNameFromClaims,
  ENC_CT_MAX_CHARS,
  ENC_PAD_BLOCK,
  ENC_PLAINTEXT_MAX_BYTES,
  EncryptedContentSchema,
  EncryptedTasksAddSchema,
  encryptTaskLine,
  evaluateIdTokenClaims,
  formatRoomFragment,
  fromBase64Url,
  generateContentKey,
  joinLinkOf,
  OidcCredentialSchema,
  padPlaintext,
  parseClientMessage,
  parseEncryptedContent,
  parseRoomFragment,
  parseTaskLine,
  plainContentOf,
  project,
  RoomViewSchema,
  TaskContentSchema,
  toBase64Url,
  unpadPlaintext,
} from '../src/index.ts';
import { join, newRoom, send } from './helpers.ts';

const ROOM = 'room_abcdefghijklmnop';
const LINKS = { policy: 'links' as const };

describe('e2ee: plaintext rooms are unchanged', () => {
  it('v1 ClientMessageSchema does not accept the Phase 2 message', () => {
    const msg = { type: 'admin.tasks.addEncrypted', items: [{ t: 'enc', iv: 'a', ct: 'b' }] };
    expect(v.safeParse(ClientMessageSchema, msg).success).toBe(false);
    expect(parseClientMessage(JSON.stringify(msg))).toEqual({
      ok: false,
      code: 'invalid_message',
    });
  });

  it('plaintext tasks are stored and projected exactly as before (no content field)', () => {
    const sim = newRoom({ taskPolicy: 'links' });
    join(sim, 'c1', 'Ada', { admin: true });
    send(sim, 'c1', {
      type: 'admin.tasks.add',
      lines: ['SCP-1 Login', 'https://x.example/a b', '{"t":"enc","iv":"x","ct":"y"}'],
    });
    const view = project(sim.state, sim.state.participants[0]?.id ?? null);
    expect(v.safeParse(RoomViewSchema, view).success).toBe(true);
    expect(view.tasks.map((t) => Object.keys(t).sort())).toEqual(
      Array(3).fill(['final', 'id', 'key', 'rounds', 'title', 'url']),
    );
    expect(sim.state.tasks.map((t) => Object.keys(t).sort())).toEqual(
      Array(3).fill(['final', 'id', 'key', 'rounds', 'title', 'url']),
    );
    // Something that looks like ciphertext is just a title in a plaintext room.
    expect(view.tasks[2]?.title).toBe('{"t":"enc","iv":"x","ct":"y"}');
  });

  it('plainContentOf wraps the v1 fields', () => {
    const r = parseTaskLine('SCP-9 Fix', LINKS);
    if (!r.ok) throw new Error('parse');
    const c = plainContentOf(r.task);
    expect(c).toEqual({ t: 'plain', key: 'SCP-9', title: 'Fix', url: null });
    expect(v.safeParse(TaskContentSchema, c).success).toBe(true);
  });
});

describe('e2ee: encrypted payloads are opaque and size-capped', () => {
  it('round-trips, hides plaintext, and uses a fresh IV per task', async () => {
    const key = generateContentKey();
    const line = 'SCP-3655 Secret acquisition plan';
    const a = await encryptTaskLine(key, ROOM, line);
    const b = await encryptTaskLine(key, ROOM, line);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(JSON.stringify(a)).not.toMatch(/SCP|Secret|acquisition/);
    expect(parseEncryptedContent(a)).toEqual({ ok: true, msg: a });
    expect(await decryptTaskLine(key, ROOM, a)).toBe(line);
    expect(await decryptTask(key, ROOM, a, LINKS)).toEqual({
      ok: true,
      task: { key: 'SCP-3655', title: 'Secret acquisition plan', url: null },
    });
  });

  it('pads to fixed buckets so short and longer lines look the same', async () => {
    const key = generateContentKey();
    const short = await encryptTaskLine(key, ROOM, 'A');
    const longer = await encryptTaskLine(key, ROOM, 'B'.repeat(200));
    const next = await encryptTaskLine(key, ROOM, 'C'.repeat(ENC_PAD_BLOCK));
    expect(short.ct.length).toBe(longer.ct.length);
    expect(next.ct.length).toBeGreaterThan(short.ct.length);
  });

  it('refuses lines over the cap and the largest ciphertext fits ENC_CT_MAX_CHARS', async () => {
    const key = generateContentKey();
    const max = await encryptTaskLine(key, ROOM, 'x'.repeat(ENC_PLAINTEXT_MAX_BYTES - 1));
    expect(max.ct.length).toBe(ENC_CT_MAX_CHARS);
    expect(parseEncryptedContent(max).ok).toBe(true);
    await expect(encryptTaskLine(key, ROOM, 'x'.repeat(ENC_PLAINTEXT_MAX_BYTES))).rejects.toThrow(
      RangeError,
    );
  });

  it('schema rejects oversized, unpadded, malformed and extra-key payloads', () => {
    const iv = toBase64Url(new Uint8Array(12));
    const ct = (bytes: number) => toBase64Url(new Uint8Array(bytes));
    const ok = (x: unknown) => v.safeParse(EncryptedContentSchema, x).success;
    expect(ok({ t: 'enc', iv, ct: ct(256 + 16) })).toBe(true);
    expect(ok({ t: 'enc', iv, ct: ct(ENC_PLAINTEXT_MAX_BYTES + ENC_PAD_BLOCK + 16) })).toBe(false);
    expect(ok({ t: 'enc', iv, ct: ct(100) })).toBe(false); // not a pad bucket
    expect(ok({ t: 'enc', iv, ct: ct(16) })).toBe(false); // tag only
    expect(ok({ t: 'enc', iv, ct: 'a' })).toBe(false); // impossible base64 length
    expect(ok({ t: 'enc', iv, ct: `${ct(272).slice(0, -1)}+` })).toBe(false);
    expect(ok({ t: 'enc', iv: 'short', ct: ct(272) })).toBe(false);
    expect(ok({ t: 'enc', iv, ct: ct(272), title: 'leak' })).toBe(false);
    expect(ok({ t: 'plain', iv, ct: ct(272) })).toBe(false);
    expect(parseEncryptedContent(null)).toEqual({ ok: false, code: 'invalid_message' });
  });

  it('Phase 2 add message is capped at LINES_PER_ADD_MAX items', () => {
    const item = {
      t: 'enc',
      iv: toBase64Url(new Uint8Array(12)),
      ct: toBase64Url(new Uint8Array(272)),
    };
    const msg = (n: number) => ({ type: 'admin.tasks.addEncrypted', items: Array(n).fill(item) });
    expect(v.safeParse(EncryptedTasksAddSchema, msg(200)).success).toBe(true);
    expect(v.safeParse(EncryptedTasksAddSchema, msg(201)).success).toBe(false);
    expect(v.safeParse(EncryptedTasksAddSchema, msg(0)).success).toBe(false);
  });

  it('wrong key, wrong room, tampering and bad padding all fail closed', async () => {
    const key = generateContentKey();
    const enc = await encryptTaskLine(key, ROOM, 'SCP-1');
    expect(await decryptTaskLine(generateContentKey(), ROOM, enc)).toBeNull();
    expect(await decryptTaskLine(key, 'other_room_abcdefgh', enc)).toBeNull();
    const bytes = fromBase64Url(enc.ct);
    if (!bytes) throw new Error('b64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(await decryptTaskLine(key, ROOM, { ...enc, ct: toBase64Url(bytes) })).toBeNull();
    expect(await decryptTaskLine(key, ROOM, { ...enc, iv: 'not!base64url!!!' })).toBeNull();
    expect(await decryptTask(generateContentKey(), ROOM, enc, LINKS)).toEqual({
      ok: false,
      error: 'undecryptable',
    });
    await expect(encryptTaskLine('short', ROOM, 'x')).rejects.toThrow(TypeError);
  });

  it('link policy is enforced after decryption', async () => {
    const key = generateContentKey();
    const enc = await encryptTaskLine(key, ROOM, 'javascript:alert(1)');
    expect(await decryptTask(key, ROOM, enc, LINKS)).toEqual({ ok: false, error: 'invalid_url' });
    const url = await encryptTaskLine(key, ROOM, 'https://evil.example/x');
    expect(
      await decryptTask(key, ROOM, url, { policy: 'allowlist', allowlist: ['good.example'] }),
    ).toEqual({ ok: false, error: 'url_not_allowed' });
  });

  it('padding helpers', () => {
    const p = padPlaintext(new Uint8Array([1, 2, 3]));
    expect(p?.length).toBe(ENC_PAD_BLOCK);
    expect(p && unpadPlaintext(p)).toEqual(new Uint8Array([1, 2, 3]));
    expect(unpadPlaintext(new Uint8Array(0))).toBeNull();
    expect(unpadPlaintext(new Uint8Array(ENC_PAD_BLOCK))).toBeNull(); // no marker
    expect(unpadPlaintext(new Uint8Array(10))).toBeNull();
    expect(padPlaintext(new Uint8Array(ENC_PLAINTEXT_MAX_BYTES))).toBeNull();
    expect(fromBase64Url('ab=')).toBeNull();
    expect(fromBase64Url('abcde')).toBeNull();
  });
});

describe('room link fragments', () => {
  const roomId = 'Rm0123456789abcdefghij';
  const joinSecret = 'J'.repeat(22);
  const adminSecret = 'A'.repeat(22);

  it('round-trips join, admin and keyed links', () => {
    for (const link of [
      { roomId, joinSecret, adminSecret: null, contentKey: null },
      { roomId, joinSecret, adminSecret, contentKey: null },
      { roomId, joinSecret, adminSecret, contentKey: generateContentKey() },
    ]) {
      const s = formatRoomFragment(link);
      expect(parseRoomFragment(s)).toEqual(link);
      expect(parseRoomFragment(`#${s}`)).toEqual(link);
    }
    expect(
      joinLinkOf({ roomId, joinSecret, adminSecret, contentKey: null }).adminSecret,
    ).toBeNull();
  });

  it('rejects malformed fragments', () => {
    for (const bad of [
      '',
      roomId,
      `${roomId}.short`,
      `${roomId}.${joinSecret}.${adminSecret}.x${joinSecret}`,
      `${roomId}.${joinSecret}~short`,
      `${roomId}.${joinSecret}~${'k'.repeat(43)}~${'k'.repeat(43)}`,
      `${roomId}.${joinSecret}.bad!secret!value!!`,
      `bad id.${joinSecret}`,
      `${roomId}.${'x'.repeat(600)}`,
    ]) {
      expect(parseRoomFragment(bad)).toBeNull();
    }
    expect(() =>
      formatRoomFragment({ roomId: 'x', joinSecret, adminSecret: null, contentKey: null }),
    ).toThrow(TypeError);
  });
});

describe('AuthProvider claim policy (Phase 2 design)', () => {
  const NOW = 1_800_000_000_000;
  const t = NOW / 1000;
  const policy = {
    issuer: 'https://sso.example',
    audience: 'backlogfit',
    roles: { facilitatorGroups: ['agile-coaches'], allowedGroups: ['engineering'] },
  };
  const base = {
    iss: 'https://sso.example',
    aud: 'backlogfit',
    sub: 'u1',
    iat: t - 10,
    exp: t + 300,
    name: '  Ada Lovelace ',
    groups: ['engineering'],
  };

  it('accepts a valid token and maps groups', () => {
    expect(evaluateIdTokenClaims(base, policy, NOW)).toEqual({
      ok: true,
      identity: { name: 'Ada Lovelace', authority: 'none' },
    });
    expect(
      evaluateIdTokenClaims({ ...base, groups: ['agile-coaches'] }, policy, NOW),
    ).toMatchObject({ ok: true, identity: { authority: 'coadmin' } });
  });

  it('rejects each failed check with a reason', () => {
    const r = (claims: unknown, p = policy) => {
      const out = evaluateIdTokenClaims(claims, p, NOW);
      return out.ok ? 'ok' : out.reason;
    };
    expect(r(null)).toBe('invalid_token');
    expect(r([])).toBe('invalid_token');
    expect(r({ ...base, sub: '' })).toBe('invalid_token');
    expect(r({ ...base, iat: undefined })).toBe('invalid_token');
    expect(r({ ...base, iat: t + 1000 })).toBe('invalid_token');
    expect(r({ ...base, iss: 'https://evil.example' })).toBe('wrong_issuer');
    expect(r({ ...base, aud: 'other' })).toBe('wrong_audience');
    expect(r({ ...base, aud: 7 })).toBe('wrong_audience');
    expect(r({ ...base, aud: ['backlogfit', 'other'] })).toBe('wrong_audience');
    expect(r({ ...base, aud: ['backlogfit', 'other'], azp: 'backlogfit' })).toBe('ok');
    expect(r({ ...base, exp: t - 120 })).toBe('expired');
    expect(r({ ...base, nbf: t + 600 })).toBe('not_yet_valid');
    expect(r({ ...base, iat: t - 3600 })).toBe('too_old');
    expect(r(base, { ...policy, nonce: 'n1' } as typeof policy)).toBe('nonce_mismatch');
    expect(r({ ...base, name: '‮evil', preferred_username: undefined })).toBe('no_name');
    expect(r({ ...base, groups: ['sales'] })).toBe('not_allowed');
    expect(r({ ...base, groups: 'engineering' })).toBe('not_allowed');
  });

  it('name and group helpers', () => {
    expect(displayNameFromClaims({ name: 7, preferred_username: 'ada' })).toBe('ada');
    expect(displayNameFromClaims({ name: 'x'.repeat(100) })).toHaveLength(40);
    expect(displayNameFromClaims({ name: '   ' })).toBeNull();
    expect(displayNameFromClaims({ email: 'a@b.c' })).toBeNull();
    expect(authorityFromGroups([], {})).toBe('none');
    expect(authorityFromGroups(['a'], { allowedGroups: null })).toBe('none');
  });

  it('reserved hello.auth credential shape', () => {
    const ok = (x: unknown) => v.safeParse(OidcCredentialSchema, x).success;
    expect(ok({ kind: 'oidc', idToken: 'aaa.bbb.ccc' })).toBe(true);
    expect(ok({ kind: 'oidc', idToken: 'aaa.bbb' })).toBe(false);
    expect(ok({ kind: 'oidc', idToken: `a.b.${'c'.repeat(9000)}` })).toBe(false);
    expect(ok({ kind: 'saml', idToken: 'aaa.bbb.ccc' })).toBe(false);
  });
});
