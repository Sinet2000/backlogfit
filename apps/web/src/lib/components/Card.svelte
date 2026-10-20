<script lang="ts">
import type { Card } from '@backlogfit/core';
import { cardName, inkFor } from '../cards.ts';

interface Props {
  card: Pick<Card, 'value' | 'label' | 'kind' | 'color'>;
  /** Face up shows the value; face down shows the back (a vote is hidden). */
  faceUp?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Extra caption under the card (e.g. a participant name). */
  caption?: string;
}
let { card, faceUp = true, selected = false, size = 'md', caption }: Props = $props();
const special = $derived(card.kind === 'special');
const sub = $derived(special ? cardName(card) : card.label !== card.value ? card.label : '');
</script>

<span
  class="card {size}"
  class:selected
  class:down={!faceUp}
  style:--card-color={card.color}
  style:--card-ink={inkFor(card.color)}
>
  <span class="inner">
    <span class="face front">
      <span class="band" aria-hidden="true"></span>
      <span class="value" class:symbol={special}>{card.value}</span>
      {#if sub}<span class="sub">{sub}</span>{/if}
      {#if selected}
        <span class="tick" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      {/if}
    </span>
    <span class="face back" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="28" height="28">
        <rect x="7" y="5" width="18" height="22" rx="3" />
        <path d="M11 16l3.5 3.5L21 13" />
      </svg>
    </span>
  </span>
  {#if caption !== undefined}<span class="caption">{caption}</span>{/if}
</span>

<style>
  .card {
    --w: 72px;
    --h: 100px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    perspective: 600px;
  }

  .card.sm {
    --w: 52px;
    --h: 72px;
  }

  .card.lg {
    --w: 96px;
    --h: 132px;
  }

  .inner {
    position: relative;
    display: block;
    width: var(--w);
    height: var(--h);
    transform-style: preserve-3d;
    transition: transform var(--duration-flip) var(--ease-out);
  }

  .down .inner {
    transform: rotateY(180deg);
  }

  .face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: var(--radius-md);
    backface-visibility: hidden;
    overflow: hidden;
  }

  .front {
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    box-shadow: var(--shadow-sm);
    color: var(--color-text);
  }

  .band {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 8px;
    background: var(--card-color);
  }

  .value {
    font-size: calc(var(--h) * 0.3);
    font-weight: var(--weight-bold);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .value.symbol {
    font-size: calc(var(--h) * 0.28);
  }

  .sub {
    max-width: 90%;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.15;
  }

  .sm .sub {
    display: none;
  }

  .selected .front {
    border: 2px solid var(--color-accent);
    background: var(--color-accent-soft);
    box-shadow: var(--shadow-md);
  }

  .tick {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  .tick path {
    fill: none;
    stroke: var(--color-accent-text);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .back {
    transform: rotateY(180deg);
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    background-image: repeating-linear-gradient(
      45deg,
      transparent 0 6px,
      rgba(255, 255, 255, 0.08) 6px 12px
    );
  }

  .back rect {
    fill: none;
    stroke: var(--color-accent-text);
    stroke-width: 2;
    opacity: 0.6;
  }

  .back path {
    fill: none;
    stroke: var(--color-accent-text);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .caption {
    max-width: calc(var(--w) + 24px);
    font-size: var(--text-sm);
    color: var(--color-text);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (forced-colors: active) {
    .front,
    .back {
      border: 2px solid CanvasText;
    }
  }

  @media print {
    .inner {
      transition: none;
    }
  }
</style>
