<script lang="ts">
  import Button from './Button.svelte';

  interface Props {
    label: string;
    value: string;
    hint?: string;
    inputTestId?: string;
    buttonTestId?: string;
    tone?: 'normal' | 'warning';
  }
  let { label, value, hint, inputTestId, buttonTestId, tone = 'normal' }: Props = $props();

  let copied = $state(false);
  let input: HTMLInputElement | undefined = $state();
  const uid = $props.id();
  const id = `copy-${uid}`;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      input?.select();
      ok = document.execCommand?.('copy') ?? false;
    }
    copied = ok;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 2500);
  }
</script>

<div class="copy-field {tone}">
  <label class="field-label" for={id}>{label}</label>
  <div class="row">
    <input
      bind:this={input}
      {id}
      class="input mono"
      readonly
      {value}
      data-testid={inputTestId}
      onfocus={(e) => e.currentTarget.select()}
      aria-describedby={hint ? `${id}-hint` : undefined}
    />
    <Button
      variant="secondary"
      icon={copied ? 'check' : 'copy'}
      onclick={copy}
      data-testid={buttonTestId}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  </div>
  {#if hint}<p class="field-hint" id="{id}-hint">{hint}</p>{/if}
  <span class="visually-hidden" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
</div>

<style>
  .copy-field {
    display: grid;
    gap: var(--space-2);
  }

  .row {
    display: flex;
    gap: var(--space-2);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    min-width: 0;
    flex: 1;
  }

  .warning .mono {
    border-color: var(--color-warning);
  }
</style>
