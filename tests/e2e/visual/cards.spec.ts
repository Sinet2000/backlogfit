/**
 * Visual regression for the card deck, a selected card, the flipped/revealed deck and the reveal
 * panel, per theme × mode × viewport. Snapshots are linux-only (generated in the official
 * Playwright image); see tests/e2e/README.md.
 */
import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, test } from '../fixtures/test.ts';
import { emulateMode, MODES, THEMES, useSwitcher } from '../fixtures/theme.ts';
import { addTasks, currentTask, id, vote } from '../fixtures/ui.ts';

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
} as const;

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      test(`cards ${theme} ${mode} ${vpName}`, async ({ page, people }) => {
        const room = await createRoomApi({ autoReveal: false, theme });
        await joinAdmin(page, room.adminLink, 'Admin', { spectator: true });
        const v = await people.join(room.joinLink, 'Alice', {
          context: { viewport, reducedMotion: 'reduce' },
        });
        const b = await people.join(room.joinLink, 'Bob');
        const p = v.page;
        await emulateMode(p, mode);
        await useSwitcher(p, theme, mode);
        await addTasks(page, ['SCP-1000 Visual baseline']);
        await id(page, 'btn-next').click();
        await expect(currentTask(p)).toHaveAttribute('data-key', 'SCP-1000');
        await p.evaluate(() => document.fonts.ready);

        const deck = p.getByTestId('card').first().locator('xpath=..');
        await expect(deck).toHaveScreenshot(`deck-${theme}-${mode}-${vpName}.png`);

        await vote(p, '5');
        await p.mouse.move(0, 0);
        await expect(deck).toHaveScreenshot(`deck-selected-${theme}-${mode}-${vpName}.png`);

        await vote(b.page, '8');
        await id(page, 'btn-reveal').click();
        const panel = id(p, 'reveal-results');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveScreenshot(`reveal-${theme}-${mode}-${vpName}.png`);
        await expect(p.getByTestId('reveal-card').first()).toHaveScreenshot(
          `revealed-card-${theme}-${mode}-${vpName}.png`,
        );
      });
    }
  }
}
