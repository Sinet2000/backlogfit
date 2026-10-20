import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  can,
  canEstimate,
  formatRoomFragment,
  joinLinkOf,
  makeTeamId,
  nextTaskId,
  normalizeRoomState,
  parseClientMessage,
  parsePreset,
  parseRoomConfig,
  parseRoomFragment,
  presetScale,
  project,
  type RoomState,
  RoomViewSchema,
  serializePreset,
  splitTeamTags,
  teamBreakdown,
  teamBreakdownText,
  teamLinkOf,
  toCsv,
  toJson,
  toMarkdown,
  toSummary,
  votersLabel,
  withTeamTags,
} from '../src/index.ts';
import {
  auth,
  current,
  errorsOf,
  hello,
  join,
  newRoom,
  outbox,
  type Sim,
  send,
  step,
} from './helpers.ts';

const TEAMS = [
  { id: 'dev', name: 'Dev' },
  { id: 'qa', name: 'QA' },
];
const ROOM = 'r'.repeat(22);
const JOIN = 'j'.repeat(22);

function teamRoom(config = {}) {
  const sim = newRoom({ teams: TEAMS, autoReveal: false, ...config });
  const admin = join(sim, 'ca', 'Ada', { admin: true, role: 'spectator' });
  const people: Record<string, string> = {};
  const add = (conn: string, name: string, team: string | null) => {
    step(sim, {
      type: 'message',
      conn,
      msg: hello(name, team === null ? {} : { team }),
      auth: auth({ resume: { token: `tok-${conn}-xxxxxxxxxxxx`, hash: 'e'.repeat(64) } }),
    });
    const id = sim.state.participants.find((p) => p.conn === conn)?.id ?? '';
    people[name] = id;
    return id;
  };
  add('c-dan', 'Dan', 'dev');
  add('c-dora', 'Dora', 'dev');
  add('c-quin', 'Quin', 'qa');
  add('c-nell', 'Nell', null);
  return { sim, admin, people };
}

function addTasks(sim: Sim, lines: string[], extra: Record<string, unknown> = {}) {
  return send(sim, 'ca', { type: 'admin.tasks.add', lines, ...extra } as never);
}

function vote(sim: Sim, conn: string, value: string) {
  const { taskId, round } = current(sim);
  return send(sim, conn, { type: 'vote', taskId, round, value });
}

function teamOf(sim: Sim, name: string) {
  return sim.state.participants.find((p) => p.name === name)?.team;
}

describe('team helpers', () => {
  it('makes short unique ids', () => {
    expect(makeTeamId('QA', [])).toBe('qa');
    expect(makeTeamId('Front end', [])).toBe('front-end');
    expect(makeTeamId('QA', ['qa', 'qa-2'])).toBe('qa-3');
    expect(makeTeamId('★', [])).toBe('team');
    expect(makeTeamId('Ünïcode team name that is long', [])).toBe('unicode-team-nam');
  });

  it('splits trailing team tags and keeps unknown ones in the title', () => {
    expect(splitTeamTags('SCP-1 Login #qa', TEAMS)).toEqual({
      line: 'SCP-1 Login',
      voters: ['qa'],
    });
    expect(splitTeamTags('SCP-1 #QA #Dev', TEAMS)).toEqual({
      line: 'SCP-1',
      voters: ['dev', 'qa'],
    });
    expect(splitTeamTags('SCP-1 #qa #qa', TEAMS)).toEqual({ line: 'SCP-1', voters: ['qa'] });
    expect(splitTeamTags('Fix #1 bug', TEAMS)).toEqual({ line: 'Fix #1 bug', voters: null });
    expect(splitTeamTags('Fix #ops', TEAMS)).toEqual({ line: 'Fix #ops', voters: null });
    expect(splitTeamTags('Fix#qa', TEAMS)).toEqual({ line: 'Fix#qa', voters: null });
    expect(splitTeamTags('SCP-1 #qa', [])).toEqual({ line: 'SCP-1 #qa', voters: null });
    const spaced = [{ id: 'fe', name: 'Front end' }];
    expect(splitTeamTags('Task #frontend', spaced)).toEqual({ line: 'Task', voters: ['fe'] });
    expect(splitTeamTags('Task #fe', spaced)).toEqual({ line: 'Task', voters: ['fe'] });
    const renamed = [
      { id: 'dev', name: 'Backend' },
      { id: 'dev-2', name: 'Dev' },
    ];
    expect(splitTeamTags('Task #dev', renamed).voters).toEqual(['dev-2']);
    expect(splitTeamTags('Task #backend', renamed).voters).toEqual(['dev']);
  });

  it('rewrites tags for a voter list', () => {
    expect(withTeamTags('SCP-1 #dev', ['qa'], TEAMS)).toBe('SCP-1 #qa');
    expect(withTeamTags('SCP-1 #dev', null, TEAMS)).toBe('SCP-1');
    expect(withTeamTags('SCP-1', ['dev', 'qa', 'gone'], TEAMS)).toBe('SCP-1 #dev #qa');
  });

  it('decides eligibility from role and team', () => {
    expect(canEstimate({ role: 'voter', team: null }, null)).toBe(true);
    expect(canEstimate({ role: 'spectator', team: 'qa' }, null)).toBe(false);
    expect(canEstimate({ role: 'voter', team: 'qa' }, ['qa'])).toBe(true);
    expect(canEstimate({ role: 'voter', team: 'dev' }, ['qa'])).toBe(false);
    expect(canEstimate({ role: 'voter', team: null }, ['qa'])).toBe(false);
    expect(votersLabel(['qa', 'dev'], TEAMS)).toBe('QA, Dev');
    expect(votersLabel(null, TEAMS)).toBe('Everyone');
    expect(votersLabel(['gone'], TEAMS)).toBe('Everyone');
  });

  it('summarises votes per team and withholds groups of one when anonymous', () => {
    const scale = presetScale('fibonacci');
    const votes = [
      { team: 'dev', value: '5' },
      { team: 'dev', value: '8' },
      { team: 'qa', value: '3' },
      { team: null, value: '2' },
      { team: 'gone', value: '2' },
    ];
    expect(teamBreakdown(votes, TEAMS, scale, false)).toEqual({
      hidden: false,
      groups: [
        { team: 'dev', count: 2, median: '6.5' },
        { team: 'qa', count: 1, median: '3' },
        { team: null, count: 2, median: '2' },
      ],
    });
    expect(teamBreakdown(votes, TEAMS, scale, true)).toEqual({ hidden: true, groups: [] });
    const pairs = votes.filter((x) => x.team !== 'qa');
    expect(teamBreakdown(pairs, TEAMS, scale, true)?.hidden).toBe(false);
    expect(teamBreakdown([{ team: 'dev', value: '5' }], TEAMS, scale, false)).toBeNull();
    expect(
      teamBreakdown(
        [
          { team: 'dev', value: 'nope' },
          { team: 'qa', value: '1' },
        ],
        TEAMS,
        scale,
        false,
      ),
    ).toBeNull();
    const tshirt = presetScale('tshirt');
    const sizes = [
      { team: 'dev', value: 'M' },
      { team: 'qa', value: 'XL' },
    ];
    expect(teamBreakdown(sizes, TEAMS, tshirt, false)?.groups.map((g) => g.median)).toEqual([
      'M',
      'XL',
    ]);
    expect(teamBreakdownText(teamBreakdown(votes, TEAMS, scale, false), TEAMS)).toBe(
      'Dev 6.5 (2 votes) · QA 3 (1 vote) · No team 2 (2 votes)',
    );
    expect(teamBreakdownText({ hidden: true, groups: [] }, TEAMS)).toBe(
      'hidden to keep votes anonymous',
    );
    expect(teamBreakdownText(null, TEAMS)).toBe('');
  });
});

describe('team schemas', () => {
  const base = { scale: presetScale('fibonacci') };

  it('accepts 0–6 unique, clean team names', () => {
    expect(parseRoomConfig(base).ok && parseRoomConfig(base)).toMatchObject({ msg: { teams: [] } });
    expect(parseRoomConfig({ ...base, teams: TEAMS }).ok).toBe(true);
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
    expect(parseRoomConfig({ ...base, teams: six }).ok).toBe(true);
    for (const teams of [
      [...six, { id: 't6', name: 'Seven' }],
      [
        { id: 'a', name: 'QA' },
        { id: 'b', name: 'q a' },
      ],
      [
        { id: 'a', name: 'QA' },
        { id: 'a', name: 'Dev' },
      ],
      [{ id: 'a', name: '' }],
      [{ id: 'a', name: 'x'.repeat(25) }],
      [{ id: 'a', name: 'Q‮A' }],
      [{ id: 'a b', name: 'QA' }],
      [{ id: 'a', name: 'QA', color: 'red' }],
    ]) {
      expect(parseRoomConfig({ ...base, teams }).ok, JSON.stringify(teams)).toBe(false);
    }
    const trimmed = parseRoomConfig({ ...base, teams: [{ id: 'qa', name: '  QA ' }] });
    expect(trimmed.ok && trimmed.msg.teams).toEqual([{ id: 'qa', name: 'QA' }]);
  });

  it('validates the new client messages', () => {
    const ok = (m: unknown) => parseClientMessage(JSON.stringify(m)).ok;
    expect(
      ok({ type: 'hello', v: 1, joinSecret: JOIN, name: 'A', role: 'voter', team: 'qa' }),
    ).toBe(true);
    expect(
      ok({ type: 'hello', v: 1, joinSecret: JOIN, name: 'A', role: 'voter', team: null }),
    ).toBe(true);
    expect(
      ok({ type: 'hello', v: 1, joinSecret: JOIN, name: 'A', role: 'voter', team: 'a b' }),
    ).toBe(false);
    expect(ok({ type: 'admin.participant', participantId: 'p1', role: 'spectator' })).toBe(true);
    expect(ok({ type: 'admin.participant', participantId: 'p1', team: null })).toBe(true);
    expect(ok({ type: 'admin.participant', participantId: 'p1' })).toBe(false);
    expect(ok({ type: 'admin.participant', participantId: 'p1', role: 'admin' })).toBe(false);
    expect(ok({ type: 'admin.tasks.voters', taskId: 't1', voters: null })).toBe(true);
    expect(ok({ type: 'admin.tasks.voters', taskId: 't1', voters: [] })).toBe(false);
    expect(ok({ type: 'admin.tasks.voters', taskId: 't1', voters: Array(7).fill('qa') })).toBe(
      false,
    );
    expect(ok({ type: 'admin.tasks.add', lines: ['x'], voters: ['qa'], requestId: 'r1' })).toBe(
      true,
    );
    expect(ok({ type: 'admin.tasks.add', lines: ['x'], requestId: 'r 1' })).toBe(false);
    expect(ok({ type: 'admin.teams', teams: TEAMS })).toBe(true);
    expect(ok({ type: 'admin.teams', teams: [...TEAMS, { id: 'x', name: 'dev' }] })).toBe(false);
  });
});

describe('joining with a team hint', () => {
  it('takes a known team, ignores an unknown one, and keeps the team on resume', () => {
    const { sim, people } = teamRoom();
    expect(teamOf(sim, 'Dan')).toBe('dev');
    expect(teamOf(sim, 'Nell')).toBeNull();
    step(sim, {
      type: 'message',
      conn: 'c-x',
      msg: hello('Xavier', { team: 'ops' }),
      auth: auth(),
    });
    expect(teamOf(sim, 'Xavier')).toBeNull();
    send(sim, 'ca', { type: 'admin.participant', participantId: people.Dan ?? '', team: 'qa' });
    step(sim, { type: 'disconnect', conn: 'c-dan' });
    step(sim, {
      type: 'message',
      conn: 'c-dan2',
      msg: hello('Dan', { team: 'dev' }),
      auth: auth({ resumeParticipantId: people.Dan ?? '' }),
    });
    expect(teamOf(sim, 'Dan')).toBe('qa');
  });

  it('lets people pick their own team after joining', () => {
    const { sim } = teamRoom();
    send(sim, 'c-nell', { type: 'team', team: 'qa' });
    expect(teamOf(sim, 'Nell')).toBe('qa');
    expect(errorsOf(send(sim, 'c-nell', { type: 'team', team: 'ops' }))).toEqual(['unknown_team']);
    send(sim, 'c-nell', { type: 'team', team: null });
    expect(teamOf(sim, 'Nell')).toBeNull();
    expect(errorsOf(send(sim, 'c-zed', { type: 'team', team: 'qa' }))).toEqual(['not_joined']);
  });

  it('shows teams to everyone and the requested team in the lobby', () => {
    const sim = newRoom({ teams: TEAMS, lobby: true });
    const admin = join(sim, 'ca', 'Ada', { admin: true });
    step(sim, { type: 'message', conn: 'cw', msg: hello('Wes', { team: 'qa' }), auth: auth() });
    const view = project(sim.state, admin);
    expect(v.safeParse(RoomViewSchema, view).success).toBe(true);
    expect(view.config.teams).toEqual(TEAMS);
    expect(view.lobby).toEqual([expect.objectContaining({ name: 'Wes', team: 'qa' })]);
  });
});

describe('tasks with voters', () => {
  it('maps tags and the default voters, and answers with the new ids', () => {
    const { sim } = teamRoom();
    const r = addTasks(sim, ['SCP-1 Login #qa', 'SCP-2 Export', 'SCP-3 #dev #qa', '#qa'], {
      voters: ['dev'],
      requestId: 'req-1',
    });
    expect(sim.state.tasks.map((t) => [t.key, t.title, t.voters])).toEqual([
      ['SCP-1', 'Login', ['qa']],
      ['SCP-2', 'Export', ['dev']],
      ['SCP-3', null, ['dev', 'qa']],
    ]);
    expect(outbox(r, 'ca')).toContainEqual({
      type: 'tasks.added',
      requestId: 'req-1',
      taskIds: sim.state.tasks.map((t) => t.id),
    });
    const none = addTasks(sim, ['  ']);
    expect(outbox(none, 'ca')).toContainEqual({ type: 'tasks.added', taskIds: [] });
    expect(errorsOf(addTasks(sim, ['SCP-4'], { voters: ['ops'] }))).toEqual(['unknown_team']);
    expect(sim.state.tasks).toHaveLength(3);
  });

  it('leaves tags in titles when the room has no teams', () => {
    const sim = newRoom();
    join(sim, 'ca', 'Ada', { admin: true });
    addTasks(sim, ['SCP-1 Login #qa']);
    expect(sim.state.tasks[0]).toMatchObject({ title: 'Login #qa', voters: null });
  });

  it('changes voters per task, for facilitators only', () => {
    const { sim } = teamRoom();
    addTasks(sim, ['SCP-1']);
    const taskId = sim.state.tasks[0]?.id ?? '';
    send(sim, 'ca', { type: 'admin.tasks.voters', taskId, voters: ['qa', 'qa'] });
    expect(sim.state.tasks[0]?.voters).toEqual(['qa']);
    expect(
      errorsOf(send(sim, 'ca', { type: 'admin.tasks.voters', taskId, voters: ['x'] })),
    ).toEqual(['unknown_team']);
    expect(
      errorsOf(send(sim, 'ca', { type: 'admin.tasks.voters', taskId: 'nope', voters: null })),
    ).toEqual(['unknown_task']);
    expect(
      errorsOf(send(sim, 'c-dan', { type: 'admin.tasks.voters', taskId, voters: null })),
    ).toEqual(['forbidden']);
    send(sim, 'ca', { type: 'admin.tasks.voters', taskId, voters: null });
    expect(sim.state.tasks[0]?.voters).toBeNull();
  });
});

describe('voting on a restricted task', () => {
  function qaTask(config = {}) {
    const room = teamRoom(config);
    addTasks(room.sim, ['SCP-1 Test plan #qa', 'SCP-2 Build']);
    send(room.sim, 'ca', { type: 'admin.next' });
    return room;
  }

  it('accepts votes only from eligible voters', () => {
    const { sim } = qaTask();
    expect(errorsOf(vote(sim, 'c-dan', '5'))).toEqual(['not_eligible']);
    expect(errorsOf(vote(sim, 'c-nell', '5'))).toEqual(['not_eligible']);
    expect(errorsOf(vote(sim, 'ca', '5'))).toEqual(['forbidden']);
    expect(errorsOf(vote(sim, 'c-quin', '5'))).toEqual([]);
    expect(current(sim).r?.votes).toEqual([
      expect.objectContaining({ name: 'Quin', team: 'qa', value: '5' }),
    ]);
  });

  it('auto-reveals once every eligible voter has voted', () => {
    const { sim } = qaTask({ autoReveal: true });
    vote(sim, 'c-quin', '3');
    expect(current(sim).r?.revealedAt).not.toBeNull();
    const view = project(sim.state, null);
    expect(view.tasks[0]?.rounds[0]?.votes?.map((x) => x.name)).toEqual(['Quin']);
    expect(view.tasks[0]?.voters).toEqual(['qa']);
  });

  it('does not auto-reveal while nobody eligible is connected', () => {
    const { sim } = qaTask({ autoReveal: true });
    step(sim, { type: 'disconnect', conn: 'c-quin' });
    vote(sim, 'c-dan', '3');
    expect(current(sim).r?.revealedAt).toBeNull();
  });

  it('drops votes that become ineligible before the reveal', () => {
    const { sim, people } = teamRoom();
    addTasks(sim, ['SCP-1']);
    send(sim, 'ca', { type: 'admin.next' });
    for (const c of ['c-dan', 'c-dora', 'c-quin', 'c-nell']) vote(sim, c, '5');
    const { taskId } = current(sim);
    send(sim, 'ca', {
      type: 'admin.participant',
      participantId: people.Dora ?? '',
      role: 'spectator',
    });
    expect(current(sim).r?.votes.map((x) => x.name)).toEqual(['Dan', 'Quin', 'Nell']);
    send(sim, 'ca', { type: 'admin.participant', participantId: people.Nell ?? '', team: 'qa' });
    expect(current(sim).r?.votes.find((x) => x.name === 'Nell')?.team).toBe('qa');
    send(sim, 'ca', { type: 'admin.tasks.voters', taskId, voters: ['qa'] });
    expect(current(sim).r?.votes.map((x) => x.name)).toEqual(['Quin', 'Nell']);
    send(sim, 'ca', { type: 'admin.reveal' });
    send(sim, 'ca', { type: 'admin.participant', participantId: people.Quin ?? '', team: 'dev' });
    expect(current(sim).r?.votes.map((x) => [x.name, x.team])).toEqual([
      ['Quin', 'qa'],
      ['Nell', 'qa'],
    ]);
  });
});

describe('per-team results', () => {
  function everyone(config = {}) {
    const room = teamRoom(config);
    addTasks(room.sim, ['SCP-1']);
    send(room.sim, 'ca', { type: 'admin.next' });
    vote(room.sim, 'c-dan', '5');
    vote(room.sim, 'c-dora', '8');
    vote(room.sim, 'c-quin', '3');
    vote(room.sim, 'c-nell', '2');
    send(room.sim, 'ca', { type: 'admin.reveal' });
    return room;
  }

  it('shows a breakdown with names in a named round', () => {
    const { sim, admin } = everyone();
    const round = project(sim.state, admin).tasks[0]?.rounds[0];
    expect(round?.teams).toEqual({
      hidden: false,
      groups: [
        { team: 'dev', count: 2, median: '6.5' },
        { team: 'qa', count: 1, median: '3' },
        { team: null, count: 1, median: '2' },
      ],
    });
    expect(round?.votes?.find((x) => x.name === 'Quin')?.team).toBe('qa');
  });

  it('never ties names or teams to values in an anonymous round', () => {
    const { sim, admin } = everyone({ anonymousAfterReveal: true });
    const view = project(sim.state, admin);
    const round = view.tasks[0]?.rounds[0];
    expect(round?.teams).toEqual({ hidden: true, groups: [] });
    expect(round?.votes?.every((x) => x.team === null && x.name === null)).toBe(true);
    expect(toCsv(view)).not.toMatch(/Dan|Quin|,Dev,|,QA,/);
    expect(toJson(view)).not.toMatch(/"team": "(dev|qa)"/);
  });

  it('adds team columns to every export', () => {
    const { sim, admin } = everyone();
    const view = project(sim.state, admin);
    const csv = toCsv(view).split('\r\n');
    expect(csv[0]).toBe(
      'task_key,task_title,task_url,final,round,participant,vote,median,average,consensus,estimated_by,participant_team,team_summary',
    );
    expect(csv[1]).toContain(',Dan,5,');
    expect(csv[1]).toMatch(
      /,Everyone,Dev,Dev 6\.5 \(2 votes\) · QA 3 \(1 vote\) · No team 2 \(1 vote\)$/,
    );
    const json = JSON.parse(toJson(view));
    expect(json.teams).toEqual(TEAMS);
    expect(json.tasks[0].voters).toBeNull();
    expect(json.tasks[0].rounds[0].votes[0]).toEqual({ name: 'Dan', team: 'dev', value: '5' });
    expect(json.tasks[0].rounds[0].teams.groups).toHaveLength(3);
    const md = toMarkdown(view).split('\n');
    expect(md[0]).toContain('| Estimated by |');
    expect(md[2]).toContain('Dev 6\\.5 \\(2 votes\\)');
    expect(toSummary(view)).toContain('By team: Dev 6.5 (2 votes) · QA 3 (1 vote)');
    send(sim, 'ca', {
      type: 'admin.tasks.voters',
      taskId: view.tasks[0]?.id ?? '',
      voters: ['qa'],
    });
    expect(toSummary(project(sim.state, admin))).toContain('Estimated by: QA');
  });

  it('keeps exports of rooms without teams exactly as before', () => {
    const sim = newRoom({ autoReveal: false });
    const admin = join(sim, 'ca', 'Ada', { admin: true });
    addTasks(sim, ['SCP-1']);
    const view = project(sim.state, admin);
    expect(toCsv(view).split('\r\n')[0]).toBe(
      'task_key,task_title,task_url,final,round,participant,vote,median,average,consensus',
    );
    expect(JSON.parse(toJson(view)).teams).toBeUndefined();
    expect(toMarkdown(view)).not.toContain('Estimated by');
  });
});

describe('managing people', () => {
  it('lets host and co-host change role and team within the co-host rules', () => {
    const { sim, admin, people } = teamRoom();
    const dan = people.Dan ?? '';
    const quin = people.Quin ?? '';
    send(sim, 'ca', { type: 'admin.promote', participantId: dan });
    const m = (participantId: string, change: object) =>
      ({ type: 'admin.participant', participantId, ...change }) as never;
    expect(errorsOf(send(sim, 'c-dan', m(quin, { role: 'spectator', team: null })))).toEqual([]);
    expect(sim.state.participants.find((p) => p.id === quin)).toMatchObject({
      role: 'spectator',
      team: null,
    });
    expect(errorsOf(send(sim, 'c-dan', m(admin, { team: 'qa' })))).toEqual(['forbidden']);
    expect(errorsOf(send(sim, 'c-dan', m(dan, { team: 'qa' })))).toEqual([]);
    expect(errorsOf(send(sim, 'c-quin', m(dan, { team: 'dev' })))).toEqual(['forbidden']);
    expect(errorsOf(send(sim, 'c-dan', m(quin, { team: 'ops' })))).toEqual(['unknown_team']);
    expect(errorsOf(send(sim, 'c-dan', m('nobody', { team: 'qa' })))).toEqual([
      'unknown_participant',
    ]);
    expect(errorsOf(send(sim, 'ca', m(admin, { role: 'voter', team: 'dev' })))).toEqual([]);
    send(sim, 'ca', { type: 'admin.promote', participantId: people.Dora ?? '' });
    expect(errorsOf(send(sim, 'c-dan', m(people.Dora ?? '', { role: 'spectator' })))).toEqual([
      'forbidden',
    ]);
    expect(errorsOf(send(sim, 'ca', m(people.Dora ?? '', { role: 'spectator' })))).toEqual([]);
  });

  it('does not touch people waiting in the lobby', () => {
    const sim = newRoom({ teams: TEAMS, lobby: true });
    join(sim, 'ca', 'Ada', { admin: true });
    step(sim, { type: 'message', conn: 'cw', msg: hello('Wes'), auth: auth() });
    const wes = sim.state.participants.find((p) => p.name === 'Wes')?.id ?? '';
    expect(
      errorsOf(send(sim, 'ca', { type: 'admin.participant', participantId: wes, team: 'qa' })),
    ).toEqual(['unknown_participant']);
  });

  it('edits the team list (host only) and cleans up removed teams', () => {
    const { sim, people } = teamRoom();
    addTasks(sim, ['SCP-1 #qa', 'SCP-2 #dev #qa']);
    send(sim, 'ca', { type: 'admin.promote', participantId: people.Dan ?? '' });
    expect(errorsOf(send(sim, 'c-dan', { type: 'admin.teams', teams: [] }))).toEqual(['forbidden']);
    send(sim, 'ca', {
      type: 'admin.teams',
      teams: [
        { id: 'dev', name: 'Developers' },
        { id: 'ba', name: 'BA' },
      ],
    });
    expect(sim.state.config.teams.map((t) => t.name)).toEqual(['Developers', 'BA']);
    expect(teamOf(sim, 'Quin')).toBeNull();
    expect(teamOf(sim, 'Dan')).toBe('dev');
    expect(sim.state.tasks.map((t) => t.voters)).toEqual([null, ['dev']]);
  });
});

describe('links with a team hint', () => {
  it('parses and formats the team suffix, keeping old links valid', () => {
    const old = parseRoomFragment(`#${ROOM}.${JOIN}`);
    expect(old).toEqual({ roomId: ROOM, joinSecret: JOIN, adminSecret: null, contentKey: null });
    const team = parseRoomFragment(`#${ROOM}.${JOIN}@qa`);
    expect(team).toEqual({
      roomId: ROOM,
      joinSecret: JOIN,
      adminSecret: null,
      contentKey: null,
      team: 'qa',
    });
    const key = 'k'.repeat(43);
    expect(parseRoomFragment(`${ROOM}.${JOIN}~${key}@qa`)?.team).toBe('qa');
    for (const bad of [
      `${ROOM}.${JOIN}@`,
      `${ROOM}.${JOIN}@a@b`,
      `${ROOM}.${JOIN}@a b`,
      `${ROOM}.${JOIN}.${JOIN}@qa`,
    ]) {
      expect(parseRoomFragment(bad), bad).toBeNull();
    }
    const admin = { roomId: ROOM, joinSecret: JOIN, adminSecret: 'a'.repeat(22), contentKey: null };
    expect(formatRoomFragment(teamLinkOf(admin, 'qa'))).toBe(`${ROOM}.${JOIN}@qa`);
    expect(formatRoomFragment(teamLinkOf(admin, null))).toBe(`${ROOM}.${JOIN}`);
    expect(joinLinkOf({ ...admin, adminSecret: null, team: 'qa' })).toEqual({
      ...admin,
      adminSecret: null,
    });
  });
});

describe('presets with teams', () => {
  const config = { scale: presetScale('fibonacci'), teams: TEAMS };

  it('writes version 2 and still reads version 1', () => {
    const text = serializePreset(config);
    expect(JSON.parse(text)).toMatchObject({ v: 2, config: { teams: TEAMS } });
    expect(parsePreset(text)).toMatchObject({ ok: true, msg: { config: { teams: TEAMS } } });
    const v1 = { format: 'backlogfit-preset', v: 1, config: { scale: config.scale } };
    expect(parsePreset(v1)).toMatchObject({ ok: true, msg: { config: { teams: [] } } });
    expect(parsePreset({ ...v1, config })).toEqual({ ok: false, code: 'invalid_message' });
  });
});

describe('shared rules', () => {
  it('matches the reducer for people management', () => {
    const host = { id: 'h', authority: 'admin' as const };
    const co = { id: 'c', authority: 'coadmin' as const };
    const none = { id: 'n', authority: 'none' as const };
    expect(can(host, 'manage', host)).toBe(true);
    expect(can(co, 'manage', none)).toBe(true);
    expect(can(co, 'manage', co)).toBe(true);
    expect(can(co, 'manage', { id: 'c2', authority: 'coadmin' })).toBe(false);
    expect(can(co, 'manage', host)).toBe(false);
    expect(can(none, 'manage', none)).toBe(false);
    expect(can(co, 'manage')).toBe(false);
    expect(can(host, 'teams')).toBe(true);
    expect(can(co, 'teams')).toBe(false);
    expect(can(co, 'kick', none)).toBe(true);
    expect(can(co, 'kick', { id: 'c2', authority: 'coadmin' })).toBe(false);
    expect(can(host, 'promote', none)).toBe(true);
    expect(can(co, 'promote', none)).toBe(false);
    expect(can(host, 'demote', co)).toBe(true);
    expect(can(co, 'facilitate')).toBe(true);
    expect(can(none, 'lock')).toBe(false);
  });

  it('finds the next task on states and views alike', () => {
    const tasks = [
      { id: 'a', final: '1' },
      { id: 'b', final: null },
      { id: 'c', final: null },
    ];
    expect(nextTaskId({ tasks, currentTaskId: null })).toBe('b');
    expect(nextTaskId({ tasks, currentTaskId: 'b' })).toBe('c');
    expect(nextTaskId({ tasks, currentTaskId: 'c' })).toBe('b');
    expect(nextTaskId({ tasks: [{ id: 'a', final: '1' }], currentTaskId: 'a' })).toBeNull();
  });
});

describe('stored state from an older build', () => {
  it('fills in team fields and leaves current state untouched', () => {
    const { sim } = teamRoom();
    addTasks(sim, ['SCP-1']);
    send(sim, 'ca', { type: 'admin.next' });
    vote(sim, 'c-dan', '5');
    expect(normalizeRoomState(sim.state)).toBe(sim.state);
    const old = structuredClone(sim.state) as unknown as Record<string, unknown> & RoomState;
    delete (old.config as { teams?: unknown }).teams;
    for (const p of old.participants) delete (p as { team?: unknown }).team;
    for (const t of old.tasks) {
      delete (t as { voters?: unknown }).voters;
      for (const r of t.rounds) for (const x of r.votes) delete (x as { team?: unknown }).team;
    }
    const fixed = normalizeRoomState(old);
    expect(fixed.config.teams).toEqual([]);
    expect(fixed.participants.every((p) => p.team === null)).toBe(true);
    expect(fixed.tasks[0]?.voters).toBeNull();
    expect(fixed.tasks[0]?.rounds[0]?.votes[0]?.team).toBeNull();
  });
});
