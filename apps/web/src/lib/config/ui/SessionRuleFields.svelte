<script lang="ts">
  import { type RuleField, type RuleValues, TIMER_CHOICES, timerLabel } from '../rules.ts';

  interface Props {
    value: RuleValues;
    fields: readonly RuleField[];
    mode: 'create' | 'live';
    disabled?: boolean;
    onchange: (patch: Partial<RuleValues>) => void;
  }
  let { value, fields, mode, disabled = false, onchange }: Props = $props();
  const uid = $props.id();

  type Check = Exclude<RuleField, 'timerSeconds'>;
  const CHECKS: Record<
    Check,
    { label: string; hint: Record<'create' | 'live', string>; testid: string }
  > = {
    autoReveal: {
      label: 'Reveal automatically',
      hint: {
        create: 'Show the cards as soon as everyone has voted.',
        live: 'Show the cards as soon as everyone has voted.',
      },
      testid: 'setting-auto-reveal',
    },
    anonymousAfterReveal: {
      label: 'Anonymous results',
      hint: {
        create: 'Show the votes without names, so nobody feels put on the spot.',
        live: 'Show the votes without names. Applies from the next round.',
      },
      testid: 'setting-anonymous',
    },
    allowSpectators: {
      label: 'Allow spectators',
      hint: {
        create: 'People can watch without voting.',
        live: 'People can watch without voting.',
      },
      testid: 'setting-spectators',
    },
    lobby: {
      label: 'Approve people before they join',
      hint: {
        create: 'You let each person in from a waiting list.',
        live: 'You let each person in. Turning this off lets everyone who is waiting in.',
      },
      testid: 'setting-lobby',
    },
  };
</script>

{#each fields as f (f)}
  {#if f === 'timerSeconds'}
    <div class="field">
      <label class="field-label" for="{uid}-timer">Round timer</label>
      <select
        id="{uid}-timer"
        class="select"
        value={value.timerSeconds === null ? '' : String(value.timerSeconds)}
        onchange={(e) => onchange({ timerSeconds: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}
        {disabled}
        aria-describedby="{uid}-timer-hint"
        data-testid="setting-timer"
      >
        {#each TIMER_CHOICES as t (t)}
          <option value={t === null ? '' : String(t)}>{timerLabel(t)}</option>
        {/each}
      </select>
      <p class="field-hint" id="{uid}-timer-hint">The host starts it when needed.</p>
    </div>
  {:else}
    {@const c = CHECKS[f]}
    <label class="check">
      <input
        type="checkbox"
        checked={value[f]}
        onchange={(e) => onchange({ [f]: e.currentTarget.checked } as Partial<RuleValues>)}
        {disabled}
        data-testid={c.testid}
      />
      <span class="check-text"><span>{c.label}</span><span class="field-hint">{c.hint[mode]}</span></span>
    </label>
  {/if}
{/each}

<style>
  .select {
    max-width: 20rem;
  }
</style>
