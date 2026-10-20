import { describe, expect, it } from 'vitest';
import {
  closeCodeFor,
  ctEqual,
  hashPasscode,
  hashSecret,
  type RoomSecrets,
  randomSalt,
  randomToken,
  verifyHello,
} from '../src/index.ts';
import { hello } from './helpers.ts';

describe('crypto helpers', () => {
  it('hashSecret is SHA-256 hex', async () => {
    expect(await hashSecret('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('ctEqual compares strings and bytes', () => {
    expect(ctEqual('abc', 'abc')).toBe(true);
    expect(ctEqual('abc', 'abd')).toBe(false);
    expect(ctEqual('abc', 'abcd')).toBe(false);
    expect(ctEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(ctEqual(new Uint8Array([1, 2]), 'ab')).toBe(false);
    expect(ctEqual('', '')).toBe(true);
  });

  it('randomToken / randomSalt formats', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomSalt()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomToken()).not.toBe(randomToken());
  });

  it('closeCodeFor maps to the application range', () => {
    expect(closeCodeFor('kicked')).toBe(4004);
    expect(closeCodeFor('not_found')).toBe(4404);
  });
});

describe('verifyHello', () => {
  const join = 'J'.repeat(22);
  const adm = 'A'.repeat(22);
  const resume = 'R'.repeat(22);

  async function secrets(passcode?: string): Promise<RoomSecrets> {
    return {
      joinHash: await hashSecret(join),
      adminHash: await hashSecret(adm),
      passcode: passcode
        ? { salt: 'ab'.repeat(16), hash: await hashPasscode('ab'.repeat(16), passcode) }
        : null,
      resume: [
        { participantId: 'p1', hash: await hashSecret('other-token-xxxxxxx') },
        { participantId: 'p2', hash: await hashSecret(resume) },
      ],
    };
  }

  it('checks join, admin, passcode and resume', async () => {
    const s = await secrets(' 1234 ');
    const a = await verifyHello(
      s,
      hello('X', { joinSecret: join, adminSecret: adm, passcode: '1234', resumeToken: resume }),
      () => 'NEW-token-xxxxxxxxxx',
    );
    expect(a).toMatchObject({
      joinOk: true,
      adminOk: true,
      passcodeOk: true,
      resumeParticipantId: 'p2',
    });
    expect(a.resume).toEqual({
      token: 'NEW-token-xxxxxxxxxx',
      hash: await hashSecret('NEW-token-xxxxxxxxxx'),
    });
  });

  it('fails closed', async () => {
    const s = await secrets('1234');
    const a = await verifyHello(
      s,
      hello('X', { joinSecret: 'x'.repeat(22), adminSecret: 'y'.repeat(22), resumeToken: resume }),
    );
    expect(a).toMatchObject({
      joinOk: false,
      adminOk: false,
      passcodeOk: false,
      resumeParticipantId: null,
    });
    const b = await verifyHello(
      await secrets(),
      hello('X', { joinSecret: join, passcode: 'whatever' }),
    );
    expect(b).toMatchObject({
      joinOk: true,
      adminOk: false,
      passcodeOk: null,
      resumeParticipantId: null,
    });
  });
});
