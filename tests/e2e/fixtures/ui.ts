import { expect, type Locator, type Page } from '@playwright/test';
import { linksFor, parseLink } from './api.ts';

export const id = (page: Page | Locator, testId: string): Locator => page.getByTestId(testId);

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
  expiry?: string;
  autoReveal?: boolean;
  anonymous?: boolean;
  lobby?: boolean;
  spectators?: boolean;
  passcode?: string;
  tasks?: string[];
  onStep?: (page: Page, step: number) => Promise<void>;
}

export interface CreatedRoom {
  roomId: string;
  joinSecret: string;
  adminSecret: string;
  joinLink: string;
  adminLink: string;
}

/** Walks the /new configurator, applying each setting on whichever step shows it. */
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
  if (opts.tasks !== undefined) {
    const lines = opts.tasks;
    pending.set('prepared-input', (el) => el.fill(lines.join('\n')));
  }

  for (let step = 1; step <= 8; step++) {
    await page.waitForLoadState('domcontentloaded');
    await expect(id(page, 'wizard-next').or(id(page, 'wizard-create')).first()).toBeVisible();
    for (const [tid, apply] of [...pending]) {
      const el = id(page, tid);
      if (await el.isVisible()) {
        await apply(el);
        pending.delete(tid);
      }
    }
    const more = id(page, 'rules-more');
    if (pending.size > 0 && (await more.isVisible()) && !(await more.getAttribute('open'))) {
      await more.locator('summary').click();
      for (const [tid, apply] of [...pending]) {
        const el = id(page, tid);
        if (await el.isVisible()) {
          await apply(el);
          pending.delete(tid);
        }
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
  expect?: 'room' | 'lobby' | 'none';
}

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

export async function addTasks(
  page: Page,
  lines: string[],
  opts: { estimateNow?: boolean } = {},
): Promise<void> {
  const input = id(page, 'task-input');
  await expect(input.or(id(page, 'task-add-open')).first()).toBeVisible();
  if (!(await input.isVisible())) await id(page, 'task-add-open').click();
  await input.fill(lines.join('\n'));
  await id(page, opts.estimateNow ? 'task-add-now' : 'task-add').click();
}

export async function vote(page: Page, value: string): Promise<void> {
  const c = card(page, value);
  await c.click();
  await expect
    .poll(
      async () =>
        (await page.getByTestId('reveal-results').isVisible()) ||
        ((await c.count()) > 0 && (await isSelected(c))),
      { message: `card ${value} selected` },
    )
    .toBe(true);
}

export async function isSelected(c: Locator): Promise<boolean> {
  const [p, ch] = await Promise.all([
    c.getAttribute('aria-pressed', { timeout: 500 }).catch(() => null),
    c.getAttribute('aria-checked', { timeout: 500 }).catch(() => null),
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

/** Opens a participant's row menu and picks an action (btn-kick, btn-promote, btn-demote). */
export async function participantAction(page: Page, name: string, testId: string): Promise<void> {
  const row = participant(page, name);
  await row.hover();
  await row.getByTestId('participant-menu').click();
  await id(page, testId).click();
}

/** Opens a sortable row's menu and picks an action (move-up, move-down, remove). */
export async function rowAction(row: Locator, testId: string): Promise<void> {
  await row.hover();
  await row.getByTestId('row-menu').click();
  await row.page().getByTestId(testId).click();
}

/** Runs a host control that may sit behind the "More actions" or "Export" menu. */
export async function hostAction(page: Page, testId: string): Promise<void> {
  const direct = id(page, testId);
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  for (const menu of ['host-menu', 'btn-export']) {
    const trigger = id(page, menu);
    if (!(await trigger.isVisible())) continue;
    await trigger.click();
    if (await direct.isVisible()) {
      await direct.click();
      return;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error(`host control ${testId} not found`);
}

/** Moves to the next task: Start/Continue when idle, Skip otherwise (no estimate saved). */
export async function nextTask(page: Page): Promise<void> {
  const start = id(page, 'btn-next');
  await expect(start.or(id(page, 'host-menu')).first()).toBeVisible();
  if (await start.isVisible()) await start.click();
  else await hostAction(page, 'btn-skip');
}

/** Opens the session settings dialog (lock, rules, end session). */
export async function openSettings(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: 'Session settings' });
  if (!(await dialog.isVisible())) await id(page, 'btn-settings').click();
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Session settings' })).toBeHidden();
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
  const text = ((await closed.innerText()) ?? '').trim();
  expect(text.length, 'closed screen has a message').toBeGreaterThan(10);
  expect(text).not.toMatch(/\b(4\d{3}|not_found|undefined|null|NaN)\b/);
}
