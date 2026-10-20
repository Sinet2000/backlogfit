import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  csvCell,
  mdCell,
  project,
  type RoomView,
  RoomViewSchema,
  toCsv,
  toJson,
  toMarkdown,
  toSummary,
} from '../src/index.ts';
import { current, join, newRoom, send } from './helpers.ts';

function room(config = {}) {
  const sim = newRoom({ autoReveal: false, ...config });
  const admin = join(sim, 'ca', 'Ada', { admin: true });
  const bob = join(sim, 'cb', 'Bob');
  const cy = join(sim, 'cc', '=cmd|calc', {});
  send(sim, 'ca', {
    type: 'admin.tasks.add',
    lines: ['SCP-1 [click](javascript:x) | pipe', '=HYPERLINK("x")', 'B-2'],
  });
  send(sim, 'ca', { type: 'admin.next' });
  const { taskId, round } = current(sim);
  send(sim, 'ca', { type: 'vote', taskId, round, value: '3' });
  send(sim, 'cb', { type: 'vote', taskId, round, value: '8' });
  send(sim, 'cc', { type: 'vote', taskId, round, value: '?' });
  return { sim, admin, bob, cy, taskId };
}

describe('project', () => {
  it('hides other votes before reveal and secrets always', () => {
    const { sim, admin, bob } = room();
    const vb = project(sim.state, bob);
    expect(vb.myVote).toBe('8');
    expect(vb.tasks[0]?.rounds[0]).toMatchObject({
      revealed: false,
      votes: null,
      stats: null,
      voteCount: 3,
    });
    expect(vb.participants.every((p) => p.hasVoted)).toBe(true);
    const json = JSON.stringify(vb);
    for (const secret of [
      sim.state.secrets.joinHash,
      sim.state.secrets.adminHash,
      ...sim.state.participants.map((p) => p.resumeHash),
      'cb',
      'ca',
    ]) {
      expect(json).not.toContain(`"${secret}"`);
    }
    expect(project(sim.state, admin).myVote).toBe('3');
    expect(project(sim.state, null).myVote).toBeNull();
    expect(project(sim.state, 'stranger').me).toBeNull();
    expect(v.safeParse(RoomViewSchema, vb).success).toBe(true);
  });

  it('shows the allowlist and passcode lock to facilitators only', () => {
    const sim = newRoom({ taskPolicy: 'allowlist', allowlist: ['x.example'] });
    const a = join(sim, 'ca', 'Ada', { admin: true });
    const b = join(sim, 'cb', 'Bob');
    expect(project(sim.state, a).config.allowlist).toEqual(['x.example']);
    expect(project(sim.state, b).config.allowlist).toEqual([]);
  });

  it('reveals named votes, or sorted anonymous values', () => {
    const { sim, bob } = room();
    send(sim, 'ca', { type: 'admin.reveal' });
    const named = project(sim.state, bob).tasks[0]?.rounds[0];
    expect(named?.votes?.map((x) => x.name)).toEqual(['Ada', 'Bob', '=cmd|calc']);
    expect(named?.stats?.median).toBe(5.5);

    const anon = room({ anonymousAfterReveal: true });
    send(anon.sim, 'ca', { type: 'admin.reveal' });
    const r = project(anon.sim.state, anon.bob).tasks[0]?.rounds[0];
    expect(r?.votes).toEqual([
      { participantId: null, name: null, value: '3' },
      { participantId: null, name: null, value: '8' },
      { participantId: null, name: null, value: '?' },
    ]);
    expect(JSON.stringify(project(anon.sim.state, anon.bob).tasks)).not.toContain('Ada');
  });
});

describe('exports', () => {
  function revealed(anonymous = false): RoomView {
    const { sim, admin, taskId } = room({ anonymousAfterReveal: anonymous });
    send(sim, 'ca', { type: 'admin.reveal' });
    send(sim, 'ca', { type: 'admin.final', taskId, value: '-5' });
    return project(sim.state, admin);
  }

  it('csvCell quotes and neutralizes formulas', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('\r=x')).toBe('"\'\r=x"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });

  it('CSV has one row per revealed vote and no names when anonymous', () => {
    const csv = toCsv(revealed());
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(1 + 3 + 2);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'-5");
    const anon = toCsv(revealed(true));
    expect(anon).not.toContain('Ada');
    expect(anon).not.toContain('Bob');
  });

  it('JSON, Markdown and summary respect anonymity and escape markup', () => {
    const named = revealed();
    const json = JSON.parse(toJson(named));
    expect(json).toMatchObject({ format: 'backlogfit-export', v: 1, generatedAt: null });
    expect(json.tasks[0].rounds[0].votes[1]).toEqual({ name: 'Bob', value: '8' });
    expect(toJson(revealed(true))).not.toContain('Bob');

    const md = toMarkdown(named);
    expect(md).toContain('\\[click\\]\\(javascript:x\\) \\| pipe');
    expect(md.split('\n')[2]?.split(' | ')).toHaveLength(7);
    expect(mdCell(null)).toBe('');
    expect(mdCell('a\nb')).toBe('a b');

    const summary = toSummary(named);
    expect(summary).toContain('Votes: Ada 3, Bob 8, =cmd|calc ?');
    expect(summary).toContain('Other: 1×?');
    expect(summary).toContain('Median 5.5, range 3–8, consensus split');
    expect(toSummary(revealed(true))).not.toContain('Votes:');
    const links = newRoom({ taskPolicy: 'links' });
    const la = join(links, 'ca', 'Ada', { admin: true });
    send(links, 'ca', { type: 'admin.tasks.add', lines: ['https://x.example/'] });
    expect(toSummary(project(links.state, la))).toBe('Untitled task\nhttps://x.example/');
  });

  it('summarizes tasks without votes and ordinal medians', () => {
    const tshirt = newRoom({
      autoReveal: false,
      scale: [
        { value: 'S', label: 'S', kind: 'tshirt', color: '#000000' },
        { value: 'M', label: 'M', kind: 'tshirt', color: '#111111' },
        { value: 'L', label: 'L', kind: 'tshirt', color: '#222222' },
      ],
    });
    const a = join(tshirt, 'ca', 'Ada', { admin: true });
    send(tshirt, 'ca', { type: 'admin.tasks.add', lines: ['Plain', 'Second'] });
    send(tshirt, 'ca', { type: 'admin.next' });
    const { taskId, round } = current(tshirt);
    send(tshirt, 'ca', { type: 'vote', taskId, round, value: 'L' });
    send(tshirt, 'ca', { type: 'admin.reveal' });
    send(tshirt, 'ca', { type: 'admin.revote' });
    send(tshirt, 'ca', { type: 'admin.reveal' });
    const view = project(tshirt.state, a);
    expect(toSummary(view)).toContain('Round 2: no votes');
    expect(toMarkdown(view)).toContain('| Plain |');
    const csv = toCsv(view);
    expect(csv).toContain(',Plain,,,1,Ada,L,L,L,full');
    expect(csv).toContain(',Plain,,,2,,,,,');
    expect(csv).toContain(',Second,,,,,,,,');
  });
});
