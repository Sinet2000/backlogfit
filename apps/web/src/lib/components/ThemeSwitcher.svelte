<script lang="ts">
import { onMount } from 'svelte';
import {
  applyTheme,
  MODE_LABELS,
  type Mode,
  readTheme,
  THEME_LABELS,
  type Theme,
} from '../theme.ts';
import Icon from './Icon.svelte';

let open = $state(false);
let theme = $state<Theme>('corporate');
let mode = $state<Mode>('system');
let root: HTMLDivElement | undefined = $state();

onMount(() => {
  ({ theme, mode } = readTheme());
  const close = (e: Event) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  };
  document.addEventListener('pointerdown', close);
  return () => document.removeEventListener('pointerdown', close);
});

function set(t: Theme, m: Mode) {
  theme = t;
  mode = m;
  applyTheme(t, m);
}

function onkeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open) {
    open = false;
    root?.querySelector<HTMLButtonElement>('.trigger')?.focus();
  }
}
</script>

<div class="theme-switcher" bind:this={root} {onkeydown} role="presentation">
  <button
    type="button"
    class="trigger"
    aria-expanded={open}
    aria-controls="theme-panel"
    data-testid="theme-switcher"
    onclick={() => (open = !open)}
  >
    <Icon name="palette" />
    <span class="visually-hidden">Appearance</span>
  </button>
  <div id="theme-panel" class="panel-pop" hidden={!open}>
    <fieldset>
      <legend>Style</legend>
      {#each Object.entries(THEME_LABELS) as [value, text] (value)}
        <label class="opt">
          <input
            type="radio"
            name="bf-theme"
            {value}
            checked={theme === value}
            onchange={() => set(value as Theme, mode)}
            data-testid="theme-{value}"
          />
          {text}
        </label>
      {/each}
    </fieldset>
    <fieldset>
      <legend>Colors</legend>
      {#each Object.entries(MODE_LABELS) as [value, text] (value)}
        <label class="opt">
          <input
            type="radio"
            name="bf-mode"
            {value}
            checked={mode === value}
            onchange={() => set(theme, value as Mode)}
            data-testid="mode-{value}"
          />
          {text}
        </label>
      {/each}
    </fieldset>
  </div>
</div>

<style>
  .theme-switcher {
    position: relative;
  }

  .trigger {
    display: inline-grid;
    place-items: center;
    width: var(--target-min);
    height: var(--target-min);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    background: var(--color-surface-2);
  }

  .panel-pop {
    position: absolute;
    right: 0;
    top: calc(100% + var(--space-2));
    z-index: 40;
    width: 240px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  fieldset + fieldset {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  legend {
    padding: 0;
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .opt {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 36px;
    cursor: pointer;
  }

  .opt input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--color-accent);
  }
</style>
