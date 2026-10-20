<script lang="ts">
  interface Props {
    value: number;
    max: number;
    tone?: 'success' | 'accent' | 'warning';
    size?: 'sm' | 'md';
  }
  let { value, max, tone = 'success', size = 'sm' }: Props = $props();
  const pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<span class="progress {tone} {size}" aria-hidden="true">
  <span class="fill" style:--pct="{pct}%"></span>
</span>

<style>
  .progress {
    display: block;
    width: 100%;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .progress.md {
    height: 8px;
  }

  .fill {
    display: block;
    height: 100%;
    width: var(--pct);
    border-radius: var(--radius-full);
    background: var(--color-success);
    transition: width var(--duration-normal) var(--ease-out);
  }

  .accent .fill {
    background: var(--color-accent);
  }

  .warning .fill {
    background: var(--color-warning);
  }

  :global(:root[data-mode='contrast']) .progress {
    background: #ffffff;
    border: 1px solid #000000;
  }

  :global(:root[data-mode='contrast']) .fill {
    background: #000000;
  }

  @media (prefers-contrast: more) {
    :global(:root:not([data-mode])) .progress {
      background: #ffffff;
      border: 1px solid #000000;
    }

    :global(:root:not([data-mode])) .fill {
      background: #000000;
    }
  }

  @media (forced-colors: active) {
    .progress {
      border: 1px solid CanvasText;
    }

    .fill {
      background: CanvasText;
    }
  }
</style>
