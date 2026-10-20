<script lang="ts">
import type { ErrorCode } from '@backlogfit/core';
import Button from '../components/Button.svelte';
import Icon from '../components/Icon.svelte';
import type { EndReason } from '../room/connection.ts';
import { endedText } from '../room/messages.ts';

interface Props {
  reason: EndReason;
  joinError: ErrorCode | null;
  demo?: boolean;
  onretry?: () => void;
}
let { reason, joinError, demo = false, onretry }: Props = $props();
const t = $derived(endedText(reason, joinError));
let heading: HTMLHeadingElement | undefined = $state();
$effect(() => heading?.focus());
</script>

<section class="ended panel" data-testid="room-closed" data-reason={reason} data-error={joinError ?? ''}>
  <span class="icon-wrap" aria-hidden="true"><Icon name={t.canRetry ? 'refresh' : 'shield'} size={28} /></span>
  <h1 bind:this={heading} tabindex="-1">{t.title}</h1>
  <p class="muted">{t.body}</p>
  {#if demo && reason === 'not_found'}
    <p class="muted">Demo sessions live only in the tab that created them.</p>
  {/if}
  <div class="actions">
    {#if t.canRetry && onretry}
      <Button variant="primary" icon="refresh" onclick={onretry}>
        {reason === 'replaced' ? 'Continue here' : 'Try again'}
      </Button>
    {/if}
    {#if reason === 'left'}
      <Button variant="primary" onclick={() => location.reload()}>Join again</Button>
    {/if}
    <Button href={demo ? '/r?demo' : '/new'} variant={t.canRetry ? 'secondary' : 'primary'}>
      {demo ? 'Start a new demo' : 'Start a new session'}
    </Button>
    <Button href="/" variant="ghost">Home</Button>
  </div>
</section>

<style>
  .ended {
    max-width: 520px;
    margin: var(--space-16) auto;
    padding: var(--space-10) var(--space-6);
    text-align: center;
    display: grid;
    justify-items: center;
    gap: var(--space-3);
  }

  .icon-wrap {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  h1 {
    font-size: var(--text-2xl);
  }

  h1:focus {
    outline: none;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
</style>
