<script lang="ts">
  import { type Card, SPECIAL_COFFEE } from '@backlogfit/core';
  import { type CardTone, cardName, NO_TONE } from '../cards.ts';
  import Icon from './Icon.svelte';

  interface Props {
    card: Pick<Card, 'value' | 'label' | 'kind'>;
    tone?: CardTone;
    faceUp?: boolean;
    selected?: boolean;
    size?: 'sm' | 'md' | 'lg';
    caption?: string;
  }
  let {
    card,
    tone = NO_TONE,
    faceUp = true,
    selected = false,
    size = 'md',
    caption,
  }: Props = $props();
  const special = $derived(card.kind === 'special');
  const sub = $derived(special ? cardName(card) : card.label !== card.value ? card.label : '');
  const iconSize = $derived(size === 'sm' ? 20 : size === 'lg' ? 36 : 28);
</script>

<span
  class="card {size}"
  class:selected
  class:special
  class:custom={tone.custom !== null}
  class:down={!faceUp}
  data-step={special ? undefined : (tone.step ?? undefined)}
  style:--card-custom={tone.custom ?? undefined}
>
  <span class="inner">
    <span class="face front">
      <span class="band" aria-hidden="true"></span>
      {#if card.value === SPECIAL_COFFEE}
        <span class="value symbol"><Icon name="cup" size={iconSize} /></span>
      {:else}
        <span class="value" class:symbol={special}>{card.value}</span>
      {/if}
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
    --face: var(--step-face, var(--color-surface));
    --ink: var(--step-ink, var(--color-text));
    --edge: var(--step-edge, var(--color-border-strong));
    --band: var(--step-band, transparent);
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

  .card.custom {
    --face: var(--color-surface);
    --ink: var(--color-text);
    --edge: var(--color-border-strong);
    --band: var(--card-custom);
  }

  .card.special {
    --face: var(--card-special-face);
    --ink: var(--card-special-ink);
    --edge: var(--card-special-edge);
    --band: transparent;
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
    gap: var(--space-1);
    border-radius: var(--radius-md);
    backface-visibility: hidden;
    overflow: hidden;
  }

  .front {
    background: var(--face);
    border: var(--card-edge-width) solid var(--edge);
    box-shadow: var(--shadow-sm);
    color: var(--ink);
    transition:
      box-shadow var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .special .front {
    border-style: dashed;
    border-width: var(--card-special-edge-width);
    box-shadow: none;
  }

  .band {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--band);
  }

  .value {
    font-size: calc(var(--h) * 0.3);
    font-weight: var(--weight-bold);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .value.symbol {
    display: grid;
    place-items: center;
    font-size: calc(var(--h) * 0.28);
  }

  .sub {
    max-width: 90%;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    text-align: center;
    line-height: 1.15;
  }

  .sm .sub {
    display: none;
  }

  .selected .front {
    border: 2px solid var(--color-accent);
    box-shadow:
      0 0 0 2px var(--color-surface),
      0 0 0 4px var(--color-accent),
      var(--shadow-md);
  }

  :global(:root:not([data-theme='colorful'])) .selected .value {
    color: var(--color-accent);
  }

  .tick {
    position: absolute;
    right: 5px;
    bottom: 5px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  .sm .tick {
    right: 3px;
    bottom: 3px;
    width: 16px;
    height: 16px;
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
    max-width: calc(var(--w) + var(--space-6));
    font-size: var(--text-sm);
    color: var(--color-text);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(:root[data-mode='contrast']) .selected .front {
    background: #000000;
    color: #ffffff;
    border-color: #000000;
    box-shadow: none;
    outline: 3px solid #000000;
    outline-offset: 2px;
  }

  :global(:root[data-mode='contrast']) .selected .value {
    color: #ffffff;
  }

  :global(:root[data-mode='contrast']) .selected .tick {
    background: #ffffff;
  }

  :global(:root[data-mode='contrast']) .selected .tick path {
    stroke: #000000;
  }

  @media (prefers-contrast: more) {
    :global(:root:not([data-mode])) .selected .front {
      background: #000000;
      color: #ffffff;
      border-color: #000000;
      box-shadow: none;
      outline: 3px solid #000000;
      outline-offset: 2px;
    }

    :global(:root:not([data-mode])) .selected .value {
      color: #ffffff;
    }

    :global(:root:not([data-mode])) .selected .tick {
      background: #ffffff;
    }

    :global(:root:not([data-mode])) .selected .tick path {
      stroke: #000000;
    }
  }

  @media (forced-colors: active) {
    .front,
    .back {
      border: 2px solid CanvasText;
      background: Canvas;
      color: CanvasText;
    }

    .band {
      display: none;
    }

    .selected .front {
      background: CanvasText;
      color: Canvas;
      outline: 3px solid CanvasText;
      outline-offset: 2px;
    }

    .selected .value {
      color: Canvas;
    }
  }

  @media print {
    .inner {
      transition: none;
    }
  }
</style>
