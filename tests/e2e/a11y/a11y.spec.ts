/**
 * axe on every page and room state, in every theme × mode we can reach, plus a keyboard-only
 * voter run-through and reduced motion.
 */
import { createRoomApi } from '../fixtures/api.ts';
import { checkA11y } from '../fixtures/axe.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { emulateMode, MODES, THEMES, useSwitcher } from '../fixtures/theme.ts';
import {
  addTasks,
  createRoom,
  currentTask,
  expectClosed,
  expectVoted,
  id,
  selectedValues,
  submitJoin,
  vote,
} from '../fixtures/ui.ts';

for (const mode of MODES) {
  for (const path of ['/', '/guide']) {
    test(`axe ${path} (${mode}, both themes)`, async ({ page }, info) => {
      await emulateMode(page, mode);
      await page.goto(path);
      await checkA11y(page, `${path} ${mode}`, info);
      for (const theme of THEMES) {
        if (await useSwitcher(page, theme, mode)) {
          await checkA11y(page, `${path} ${theme} ${mode}`, info);
        }
      }
    });
  }

  test(`axe configurator, every step (${mode})`, async ({ page }, info) => {
    await emulateMode(page, mode);
    await createRoom(page, {
      autoReveal: false,
      onStep: (p, step) => checkA11y(p, `/new step ${step} ${mode}`, info),
    });
    await checkA11y(page, `/new created ${mode}`, info);
  });

  for (const theme of THEMES) {
    test(`axe room states: join, voting, revealed, closed (${theme} ${mode})`, async ({
      page,
      people,
    }, info) => {
      await emulateMode(page, mode);
      const room = await createRoomApi({ autoReveal: false, theme });
      const voter = await people.open({ colorScheme: mode === 'dark' ? 'dark' : 'light' });
      await emulateMode(voter.page, mode);
      await voter.page.goto(room.joinLink);
      await expect(id(voter.page, 'join-name')).toBeVisible();
      await useSwitcher(voter.page, theme, mode);
      await checkA11y(voter.page, `join ${theme} ${mode}`, info);

      await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
      await useSwitcher(page, theme, mode);
      await submitJoin(voter.page, 'Alice');
      await addTasks(page, ['SCP-300 Accessible checkout']);
      await id(page, 'btn-next').click();
      await expect(currentTask(voter.page)).toHaveAttribute('data-key', 'SCP-300');
      await vote(voter.page, '5');
      await checkA11y(voter.page, `voting ${theme} ${mode}`, info);
      await checkA11y(page, `admin voting ${theme} ${mode}`, info);

      await id(page, 'btn-reveal').click();
      await expect(id(voter.page, 'reveal-results')).toBeVisible();
      await checkA11y(voter.page, `revealed ${theme} ${mode}`, info);
      await checkA11y(page, `admin revealed ${theme} ${mode}`, info);

      await id(page, 'btn-close-room').click();
      const confirm = page.getByRole('dialog').getByRole('button', { name: /close|end|confirm/i });
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expectClosed(voter.page, 'closed');
      await checkA11y(voter.page, `closed ${theme} ${mode}`, info);
    });
  }
}

test('keyboard only: a voter joins, votes, changes the vote and reads the result', async ({
  page,
  people,
}) => {
  const room = await createRoomApi({ autoReveal: false });
  await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
  await addTasks(page, ['SCP-310']);
  await id(page, 'btn-next').click();

  const v = await people.open();
  const kb = v.page.keyboard;
  await v.page.goto(room.joinLink);
  await expect(id(v.page, 'join-name')).toBeVisible();

  /** Press Tab until the focused element matches; fails after `max` presses. */
  const tabTo = async (testId: string, max = 60) => {
    for (let i = 0; i < max; i++) {
      const hit = await v.page.evaluate(
        (t) => document.activeElement?.closest(`[data-testid="${t}"]`) !== null,
        testId,
      );
      if (hit) return;
      await kb.press('Tab');
    }
    throw new Error(`could not reach ${testId} with Tab`);
  };

  await tabTo('join-name');
  await kb.type('Kim');
  await kb.press('Enter');
  await expect(v.page.locator('[data-testid="participant"][data-name="Kim"]')).toBeVisible();
  await expect(currentTask(v.page)).toHaveAttribute('data-key', 'SCP-310');

  await tabTo('card');
  // Focus must be visible on cards.
  const outline = await v.page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth), shadow: s.boxShadow };
  });
  expect((outline.style !== 'none' && outline.width > 0) || outline.shadow !== 'none').toBe(true);
  const focused = await v.page.evaluate(
    () => document.activeElement?.closest('[data-testid="card"]')?.getAttribute('data-value') ?? '',
  );
  await kb.press('Enter');
  await expect.poll(() => selectedValues(v.page)).toEqual([focused]);
  await expectVoted(page, 'Kim', true);

  // Move to the next card with Tab or arrows, select with Space.
  await kb.press('ArrowRight');
  let next = await v.page.evaluate(
    () => document.activeElement?.closest('[data-testid="card"]')?.getAttribute('data-value') ?? '',
  );
  if (next === focused || next === '') {
    await kb.press('Tab');
    next = await v.page.evaluate(
      () =>
        document.activeElement?.closest('[data-testid="card"]')?.getAttribute('data-value') ?? '',
    );
  }
  expect(next).not.toBe('');
  expect(next).not.toBe(focused);
  await kb.press('Space');
  await expect.poll(() => selectedValues(v.page)).toEqual([next]);

  await id(page, 'btn-reveal').click();
  await expect(id(v.page, 'reveal-results')).toBeVisible();
  // Results are announced politely to screen readers.
  const live = v.page.locator('[aria-live="polite"], [role="status"]');
  expect(await live.count()).toBeGreaterThan(0);
});

test('admin can run a round from the keyboard', async ({ page, people }) => {
  const room = await createRoomApi({ autoReveal: false });
  const alice = await people.join(room.joinLink, 'Alice');
  await page.goto(room.adminLink);
  await id(page, 'join-name').focus();
  await page.keyboard.type('Admin');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="participant"][data-name="Admin"]')).toBeVisible();
  await id(page, 'task-input').focus();
  await page.keyboard.type('SCP-320');
  await id(page, 'task-add').focus();
  await page.keyboard.press('Enter');
  await id(page, 'btn-next').focus();
  await page.keyboard.press('Enter');
  await expect(currentTask(alice.page)).toHaveAttribute('data-key', 'SCP-320');
  await vote(alice.page, '8');
  await id(page, 'btn-reveal').focus();
  await page.keyboard.press('Enter');
  await expect(id(alice.page, 'reveal-results')).toBeVisible();
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`flip animation respects prefers-reduced-motion: ${reducedMotion}`, async ({
    page,
    people,
  }) => {
    const room = await createRoomApi({ autoReveal: false });
    await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
    const a = await people.join(room.joinLink, 'Alice', { context: { reducedMotion } });
    await addTasks(page, ['SCP-330']);
    await id(page, 'btn-next').click();
    await expect(currentTask(a.page)).toHaveAttribute('data-key', 'SCP-330');
    await vote(a.page, '3');
    await id(page, 'btn-reveal').click();
    await expect(id(a.page, 'reveal-results')).toBeVisible();
    const motion = await a.page.evaluate(() => {
      const secs = (v: string) =>
        Math.max(
          ...v
            .split(',')
            .map(
              (x) =>
                (x.trim().endsWith('ms') ? Number.parseFloat(x) / 1000 : Number.parseFloat(x)) || 0,
            ),
        );
      let max = 0;
      const els = document.querySelectorAll(
        '[data-testid="reveal-card"], [data-testid="reveal-card"] *',
      );
      for (const el of els) {
        const s = getComputedStyle(el);
        const anim = s.animationName !== 'none' ? secs(s.animationDuration) : 0;
        max = Math.max(max, anim, secs(s.transitionDuration));
      }
      return { max, count: els.length };
    });
    expect(motion.count).toBeGreaterThan(0);
    if (reducedMotion === 'reduce') expect(motion.max).toBeLessThanOrEqual(0.01);
    else expect(motion.max, 'cards flip when motion is allowed').toBeGreaterThan(0.05);
  });
}
