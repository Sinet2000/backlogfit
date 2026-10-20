<script lang="ts">
import { onMount } from 'svelte';
import { formatClock } from '../room/format.ts';
import Icon from './Icon.svelte';

interface Props {
  endsAt: number;
  seconds: number;
  serverNow: () => number;
}
let { endsAt, seconds, serverNow }: Props = $props();

let now = $state(0);
let announced = $state('');
let lastMark = -1;

onMount(() => {
  now = serverNow();
  const id = setInterval(() => (now = serverNow()), 250);
  return () => clearInterval(id);
});

const left = $derived(now === 0 ? seconds * 1000 : Math.max(0, endsAt - now));
const pct = $derived(seconds > 0 ? (left / (seconds * 1000)) * 100 : 0);

// Announce sparingly: start, 30s, 10s, end (never every second).
$effect(() => {
  const s = Math.ceil(left / 1000);
  const mark = s === 0 ? 0 : s <= 10 ? 10 : s <= 30 ? 30 : seconds;
  if (mark === lastMark) return;
  lastMark = mark;
  announced =
    mark === 0
      ? 'Time is up.'
      : mark === seconds
        ? `Timer started: ${formatClock(seconds * 1000)}.`
        : `${mark} seconds left.`;
});
</script>

<div class="timer" class:low={left <= 10_000} data-testid="timer" role="timer" aria-label="Round timer">
  <Icon name="timer" size={18} />
  <span class="clock">{formatClock(left)}</span>
  <span class="track" aria-hidden="true"><span class="fill" style:--pct="{pct}%"></span></span>
  <span class="visually-hidden" aria-live="polite">{announced}</span>
</div>

<style>
  .timer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
  }

  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: var(--weight-semibold);
    min-width: 4ch;
  }

  .track {
    width: 64px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    width: var(--pct);
    background: var(--color-accent);
  }

  .low {
    border-color: var(--color-warning);
  }

  .low .fill {
    background: var(--color-warning);
  }
</style>
