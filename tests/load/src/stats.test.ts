import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOptions, percentile, summarize, wsUrl } from './stats.ts';

test('nearest-rank percentiles', () => {
  const xs = Array.from({ length: 100 }, (_, i) => 100 - i); // 100..1 unsorted
  assert.equal(percentile(xs, 50), 50);
  assert.equal(percentile(xs, 95), 95);
  assert.equal(percentile(xs, 99), 99);
  assert.equal(percentile(xs, 100), 100);
  assert.equal(percentile([7], 99), 7);
  assert.ok(Number.isNaN(percentile([], 50)));
});

test('summarize', () => {
  const s = summarize([1, 2, 3, 4]);
  assert.equal(s.n, 4);
  assert.equal(s.mean, 2.5);
  assert.equal(s.max, 4);
  assert.equal(s.p50, 2);
});

test('options: defaults and flags', () => {
  const d = parseOptions([]);
  assert.notEqual(d, 'help');
  if (d === 'help') return;
  assert.deepEqual(
    [d.url, d.origin, d.rooms, d.clients, d.rounds],
    ['http://localhost:8080', 'http://localhost:8080', 20, 20, 3],
  );
  const o = parseOptions(['--url', 'https://x.test:9443/path', '--rooms', '5', '--clients', '3']);
  if (o === 'help') throw new Error('unexpected help');
  assert.equal(o.url, 'https://x.test:9443');
  assert.equal(o.rooms, 5);
  assert.equal(o.clients, 3);
  assert.equal(parseOptions(['--help']), 'help');
  assert.throws(() => parseOptions(['--clients', '1']));
  assert.throws(() => parseOptions(['--rooms', 'x']));
  assert.throws(() => parseOptions(['--url', 'ftp://x']));
  assert.throws(() => parseOptions(['--bogus']));
  const t = parseOptions(['--think', '4000']);
  if (t === 'help') throw new Error('unexpected help');
  assert.equal(t.thinkMs, 4000);
  assert.throws(() => parseOptions(['--think', '-1']));
});

test('ws url', () => {
  assert.equal(wsUrl('https://a.test', 'r_1'), 'wss://a.test/ws/r_1');
  assert.equal(wsUrl('http://localhost:8080', 'abc'), 'ws://localhost:8080/ws/abc');
});
