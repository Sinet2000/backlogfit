import type { Page } from '@playwright/test';
import { createRoomApi } from '../fixtures/api.ts';
import { expect, joinAdmin, type People, test } from '../fixtures/test.ts';
import {
  addTasks,
  card,
  chooseTeam,
  expectClosed,
  expectVoted,
  hostAction,
  id,
  participant,
  participantAction,
  revealCards,
  rowAction,
  teamOption,
  vote,
  waitInRoom,
} from '../fixtures/ui.ts';

const TEAMS = [
  { id: 'dev', name: 'Dev' },
  { id: 'qa', name: 'QA' },
];

/** Opens a team link, checks that the team is preselected, and keeps it. */
async function joinTeam(people: People, link: string, name: string, team: string) {
  const p = await people.open();
  await p.page.goto(link);
  await id(p.page, 'join-name').fill(name);
  await id(p.page, 'join-submit').click();
  await expect(id(p.page, 'team-choice')).toBeVisible();
  await expect(teamOption(p.page, team).locator('input')).toBeChecked();
  await chooseTeam(p.page, 'keep');
  await waitInRoom(p.page, name);
  return p.page;
}

async function summary(page: Page) {
  const items = await page.getByTestId('team-summary-item').all();
  return Promise.all(
    items.map(async (i) => [
      await i.getAttribute('data-team'),
      await i.getAttribute('data-median'),
      await i.getAttribute('data-count'),
    ]),
  );
}

test('teams: links, team-only tasks, per-team results and managing people @smoke', async ({
  page,
  people,
}) => {
  test.slow();
  const room = await createRoomApi({ teams: TEAMS, autoReveal: true });
  await joinAdmin(page, room.adminLink, 'Hanna', { team: '' });

  const dana = await joinTeam(people, `${room.joinLink}@dev`, 'Dana', 'dev');
  const diego = await joinTeam(people, `${room.joinLink}@dev`, 'Diego', 'dev');
  const quinn = await joinTeam(people, `${room.joinLink}@qa`, 'Quinn', 'qa');
  const qiu = await joinTeam(people, `${room.joinLink}@qa`, 'Qiu', 'qa');
  const sam = await people.join(room.joinLink, 'Sam', { spectator: true, team: '' });

  for (const [name, team] of [
    ['Dana', 'dev'],
    ['Quinn', 'qa'],
    ['Sam', ''],
  ] as const) {
    await expect(participant(page, name)).toHaveAttribute('data-team', team);
  }
  await expect(page.getByTestId('people-group')).toHaveCount(3);

  await addTasks(page, ['SCP-1 Test plan #qa', 'SCP-2 Build']);
  await expect(page.getByTestId('task-item')).toHaveCount(2);
  await expect(page.getByTestId('task-item').first().getByTestId('task-voters')).toHaveText('QA');
  await id(page, 'btn-next').click();

  await expect(card(quinn, '3')).toBeVisible();
  for (const p of [dana, diego, sam.page]) {
    await expect(card(p, '3')).toHaveCount(0);
  }
  await expect(id(dana, 'not-estimating')).toHaveText(
    'QA is estimating this task. You can follow along.',
  );
  await expect(id(page, 'vote-progress')).toHaveText('0 of 2 voted');
  await vote(quinn, '3');
  await expect(id(page, 'reveal-results')).toBeHidden();
  await vote(qiu, '5');
  await expect(id(page, 'reveal-results')).toBeVisible();
  const names = (await revealCards(page)).map((c) => c.name).sort();
  expect(names).toEqual(['Qiu', 'Quinn']);

  await id(page, 'btn-save-next').click();
  await expect(id(page, 'current-task')).toHaveAttribute('data-key', 'SCP-2');
  await vote(page, '2');
  await vote(dana, '5');
  await vote(diego, '8');
  await vote(quinn, '3');
  await vote(qiu, '3');
  await expect(id(page, 'team-summary')).toBeVisible();
  expect(await summary(page)).toEqual([
    ['dev', '6.5', '2'],
    ['qa', '3', '2'],
    ['', '2', '1'],
  ]);
  await expect(id(sam.page, 'team-summary')).toBeVisible();

  await hostAction(page, 'btn-revote');
  await vote(diego, '13');
  await expectVoted(page, 'Diego', true);
  await participantAction(page, 'Diego', 'btn-make-spectator');
  await expect(participant(page, 'Diego')).toHaveAttribute('data-role', 'spectator');
  await expectVoted(page, 'Diego', false);
  await expect(card(diego, '13')).toHaveCount(0);

  await participantAction(page, 'Dana', 'btn-team-qa');
  await expect(participant(page, 'Dana')).toHaveAttribute('data-team', 'qa');
  await expect(participant(dana, 'Dana')).toHaveAttribute('data-team', 'qa');

  await rowAction(page.getByTestId('task-item').nth(1), 'task-voters-dev');
  await expect(page.getByTestId('task-item').nth(1).getByTestId('task-voters')).toHaveText('Dev');

  await participantAction(page, 'Qiu', 'btn-kick');
  await id(page, 'btn-kick-confirm').click();
  await expectClosed(qiu, 'kicked');
  await expect(participant(page, 'Qiu')).toHaveCount(0);
});

test('teams: a host is told when nobody from the team is here', async ({ page }) => {
  const room = await createRoomApi({ teams: TEAMS });
  await joinAdmin(page, room.adminLink, 'Hanna', { team: 'dev' });
  await id(page, 'task-input').fill('SCP-9 Release notes');
  await id(page, 'task-add-voters').selectOption('qa');
  await id(page, 'task-add-now').click();
  await expect(id(page, 'current-task')).toHaveAttribute('data-key', 'SCP-9');
  await expect(id(page, 'current-voters')).toContainText('QA');
  await expect(id(page, 'no-eligible')).toContainText('Nobody from QA is here yet.');
  await expect(id(page, 'not-estimating')).toBeVisible();
});
