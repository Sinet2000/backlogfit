/**
 * UI helpers built only on the data-testid contract (apps/web/TESTIDS.md).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { linksFor, parseLink } from './api.ts';

export const id = (page: Page | Locator, testId: string): Locator => page.getByTestId(testId);

/** Read the on/off state of a checkbox, switch or toggle button. */
export async function isOn(el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    if (node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio')) {
      return node.checked;
    }
    const inner = node.querySelector('input[type=checkbox]');
    if (inner instanceof HTMLInputElement) return inner.checked;
    return (
      node.getAttribute('aria-checked') === 'true' || node.getAttribute('aria-pressed') === 'true'
    );
  });
}

export async function setToggle(el: Locator, on: boolean): Promise<void> {
  if ((await isOn(el)) !== on) await el.click();
  await expect.poll(() => isOn(el)).toBe(on);
}

async function fieldValue(el: Locator): Promise<string> {
  return el.evaluate((node) =>
    node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
      ? node.value
      : (node.textContent ?? '').trim(),
  );
}

export type ScalePresetId =
  | 'fibonacci'
  | 'modifiedFibonacci'
  | 'tshirt'
  | 'powersOf2'
  | 'linear'
  | 'custom';

export interface ConfiguratorOptions {
  preset?: ScalePresetId;
  /** Value or label of the expiry select, e.g. '2' (hours). */
  expiry?: string;
  autoReveal?: boolean;
  anonymous?: boolean;
  lobby?: boolean;
  spectators?: boolean;
  passcode?: string;
  /** Called on every wizard step before moving on (screenshots, axe). */
  onStep?: (page: Page, step: number) => Promise<void>;
}

export interface CreatedRoom {
  roomId: string;
  joinSecret: string;
  adminSecret: string;
  joinLink: string;
  adminLink: string;
}

/**
 * Walk the /new configurator. Settings are applied on whichever step shows them, so the helper
 * does not depend on the step order.
 */
export async function createRoom(page: Page, opts: ConfiguratorOptions = {}): Promise<CreatedRoom> {
  await page.goto('/new');
  const pending = new Map<string, (el: Locator) => Promise<void>>();
  pending.set(`scale-preset-${opts.preset ?? 'fibonacci'}`, (el) => el.click());
  if (opts.expiry !== undefined) {
    const v = opts.expiry;
    pending.set('setting-expiry', async (el) => {
      await el.selectOption(v).catch(() => el.selectOption({ label: v }));
    });
  }
  const toggles: [string, boolean | undefined][] = [
    ['setting-auto-reveal', opts.autoReveal],
    ['setting-anonymous', opts.anonymous],
    ['setting-lobby', opts.lobby],
    ['setting-spectators', opts.spectators],
  ];
  for (const [tid, val] of toggles) {
    if (val !== undefined) pending.set(tid, (el) => setToggle(el, val));
  }
  if (opts.passcode !== undefined) {
    const p = opts.passcode;
    pending.set('setting-passcode', (el) => el.fill(p));
  }

  for (let step = 1; step <= 8; step++) {
    await page.waitForLoadState('domcontentloaded');
    for (const [tid, apply] of [...pending]) {
      const el = id(page, tid);
      if (await el.isVisible()) {
        await apply(el);
        pending.delete(tid);
      }
    }
    if (opts.onStep) await opts.onStep(page, step);
    const create = id(page, 'wizard-create');
    if (await create.isVisible()) {
      if (pending.size > 0) throw new Error(`settings never shown: ${[...pending.keys()].join()}`);
      await create.click();
      break;
    }
    await id(page, 'wizard-next').click();
  }

  const joinField = id(page, 'join-link');
  await expect(joinField).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => fieldValue(joinField)).toContain('/r#');
  const joinLink = await fieldValue(joinField);
  const adminField = id(page, 'admin-link');
  const adminLink = (await adminField.count()) > 0 ? await fieldValue(adminField) : '';
  const j = parseLink(joinLink);
  const a = adminLink ? parseLink(adminLink) : null;
  if (!a?.adminSecret) throw new Error('admin link missing or without admin secret');
  expect(a.roomId).toBe(j.roomId);
  expect(a.joinSecret).toBe(j.joinSecret);
  return {
    roomId: j.roomId,
    joinSecret: j.joinSecret,
    adminSecret: a.adminSecret,
    ...linksFor(new URL(joinLink).origin, j.roomId, j.joinSecret, a.adminSecret),
  };
}

export interface JoinOptions {
  spectator?: boolean;
  passcode?: string;
  /** What to wait for after submitting. Default 'room'. */
  expect?: 'room' | 'lobby' | 'none';
}

/** On a page that shows the join screen, fill it and submit. */
export async function submitJoin(page: Page, name: string, opts: JoinOptions = {}): Promise<void> {
  const nameField = id(page, 'join-name');
  await expect(nameField).toBeVisible({ timeout: 15_000 });
  await nameField.fill(name);
  if (opts.passcode !== undefined) await id(page, 'join-passcode').fill(opts.passcode);
  if (opts.spectator) await setToggle(id(page, 'join-as-spectator'), true);
  await id(page, 'join-submit').click();
  const wait = opts.expect ?? 'room';
  if (wait === 'room') await waitInRoom(page, name);
  if (wait === 'lobby') await expect(id(page, 'lobby-waiting')).toBeVisible();
}

/** The viewer is in the room once they see themselves in the participant list. */
export async function waitInRoom(page: Page, name: string): Promise<void> {
  await expect(participant(page, name)).toBeVisible({ timeout: 15_000 });
}

export const participant = (page: Page, name: string): Locator =>
  page.locator(`[data-testid="participant"][data-name="${cssEscape(name)}"]`);

export const card = (page: Page, value: string): Locator =>
  page.locator(`[data-testid="card"][data-value="${cssEscape(value)}"]`);

export const currentTask = (page: Page): Locator => id(page, 'current-task');

export function cssEscape(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}

export async function addTasks(page: Page, lines: string[]): Promise<void> {
  await id(page, 'task-input').fill(lines.join('\n'));
  await id(page, 'task-add').click();
}

export async function vote(page: Page, value: string): Promise<void> {
  const c = card(page, value);
  await c.click();
  await expect.poll(() => isSelected(c), { message: `card ${value} selected` }).toBe(true);
}

/** True when the card shows as selected (aria-pressed or aria-checked). */
export async function isSelected(c: Locator): Promise<boolean> {
  const [p, ch] = await Promise.all([
    c.getAttribute('aria-pressed'),
    c.getAttribute('aria-checked'),
  ]);
  return p === 'true' || ch === 'true';
}

export async function selectedValues(page: Page): Promise<string[]> {
  const cards = await page.getByTestId('card').all();
  const out: string[] = [];
  for (const c of cards)
    if (await isSelected(c)) out.push((await c.getAttribute('data-value')) ?? '');
  return out;
}

export async function expectVoted(page: Page, name: string, voted: boolean): Promise<void> {
  await expect(participant(page, name)).toHaveAttribute('data-voted', String(voted));
}

/** Click a per-participant action (btn-kick, btn-promote) in that participant's row. */
export async function participantAction(page: Page, name: string, testId: string): Promise<void> {
  const row = participant(page, name);
  const inRow = row.getByTestId(testId);
  if ((await inRow.count()) > 0) {
    await inRow.first().click();
  } else {
    // Some layouts open a per-participant menu; fall back to clicking the row first.
    await row.click();
    await id(page, testId).first().click();
  }
}

export async function revealCards(page: Page): Promise<{ name: string; value: string }[]> {
  const cards = await page.getByTestId('reveal-card').all();
  return Promise.all(
    cards.map(async (c) => ({
      name: (await c.getAttribute('data-name')) ?? '',
      value: (await c.getAttribute('data-value')) ?? '',
    })),
  );
}

/** Numbers in a stat element's text, e.g. "Average 4.5" → 4.5. */
export async function statNumber(page: Page, testId: string): Promise<number> {
  const t = (await id(page, testId).textContent()) ?? '';
  const m = t.replace(',', '.').match(/-?\d+(\.\d+)?/g);
  if (!m) throw new Error(`no number in ${testId}: "${t}"`);
  return Number(m[m.length - 1]);
}

export async function expectClosed(page: Page, reason: string, timeout = 15_000): Promise<void> {
  const closed = id(page, 'room-closed');
  await expect(closed).toBeVisible({ timeout });
  await expect(closed).toHaveAttribute('data-reason', reason);
  // A friendly, human message, never a raw code.
  const text = ((await closed.innerText()) ?? '').trim();
  expect(text.length, 'closed screen has a message').toBeGreaterThan(10);
  expect(text).not.toMatch(/\b(4\d{3}|not_found|undefined|null|NaN)\b/);
}
