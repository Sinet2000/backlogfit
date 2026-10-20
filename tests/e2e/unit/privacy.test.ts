import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFrames, revealedVotes } from '../fixtures/privacy.ts';

const room = (overrides: Record<string, unknown> = {}) => ({
  roomId: 'r1',
  me: { participantId: 'p1', role: 'voter', authority: 'none' },
  config: { scale: [{ value: '5', label: '5', numeric: 5, kind: 'number', color: '#000000' }] },
  participants: [
    { id: 'p1', name: 'Ada', role: 'voter', authority: 'none', connected: true, hasVoted: true },
    { id: 'p2', name: 'Bob', role: 'voter', authority: 'none', connected: true, hasVoted: true },
  ],
  lobby: [],
  tasks: [
    {
      id: 't1',
      key: 'SCP-1',
      title: null,
      url: null,
      final: null,
      rounds: [{ n: 1, revealed: false, anonymous: false, voteCount: 2, votes: null, stats: null }],
    },
  ],
  phase: 'voting',
  myVote: '3',
  timer: null,
  ...overrides,
});

const frame = (r: unknown) => JSON.stringify({ type: 'state', rev: 1, room: r });

test('a clean pre-reveal snapshot passes', () => {
  assert.deepEqual(checkFrames([frame(room())], new Set(['3'])), []);
});

test('non-room frames are ignored, non-JSON frames are reported', () => {
  const v = checkFrames(['{"type":"pong","serverTime":1}', 'nope'], new Set());
  assert.equal(v.length, 1);
  assert.equal(v[0]?.detail, 'frame is not JSON');
});

test('votes before reveal are a violation', () => {
  const r = room();
  r.tasks[0]?.rounds.splice(0, 1, {
    n: 1,
    revealed: false,
    anonymous: false,
    voteCount: 2,
    votes: [{ participantId: 'p2', name: 'Bob', value: '8' }] as never,
    stats: null,
  });
  const v = checkFrames([frame(r)], new Set(['3']));
  assert.ok(v.some((x) => x.path === 'tasks[0].rounds[0].votes'));
});

test('a myVote the viewer never cast is a violation', () => {
  const v = checkFrames([frame(room({ myVote: '8' }))], new Set(['3']));
  assert.ok(v.some((x) => x.path === 'myVote'));
});

test('a vote smuggled into a participant is a violation', () => {
  const r = room();
  (r.participants[1] as Record<string, unknown>).vote = '8';
  const v = checkFrames([frame(r)], new Set(['3']));
  assert.ok(v.some((x) => x.path === 'participants[1].vote'));
});

test('revealed rounds may carry votes and revealedVotes lists them', () => {
  const r = room({ phase: 'revealed' });
  r.tasks[0]?.rounds.splice(0, 1, {
    n: 1,
    revealed: true,
    anonymous: false,
    voteCount: 1,
    votes: [{ participantId: 'p2', name: 'Bob', value: '8' }] as never,
    stats: null,
  });
  assert.deepEqual(checkFrames([frame(r)], new Set(['3'])), []);
  assert.deepEqual(revealedVotes(r as never), [{ task: 't1', round: 1, name: 'Bob', value: '8' }]);
});
