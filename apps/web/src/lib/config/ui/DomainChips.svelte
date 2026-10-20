<script lang="ts">
  import { ALLOWLIST_MAX } from '@backlogfit/core';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';

  interface Props {
    hosts: readonly string[];
    error: string | null;
    onchange: (hosts: string[]) => void;
  }
  let { hosts, error, onchange }: Props = $props();
  let input = $state('');
  const uid = $props.id();

  function add() {
    const entries = input
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== '' && !hosts.includes(s));
    if (entries.length) onchange([...hosts, ...entries].slice(0, ALLOWLIST_MAX));
    input = '';
  }
</script>

<div class="field">
  <label class="field-label" for="{uid}-allow">Allowed domains</label>
  <div class="add-row">
    <input
      id="{uid}-allow"
      class="input"
      bind:value={input}
      placeholder="jira.yourcompany.com"
      aria-describedby="{uid}-hint{error ? ` ${uid}-err` : ''}"
      aria-invalid={error ? 'true' : undefined}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      }}
      data-testid="setting-allowlist-input"
    />
    <Button icon="plus" onclick={add}>Add</Button>
  </div>
  {#if hosts.length > 0}
    <ul class="chips" aria-label="Allowed domains">
      {#each hosts as host (host)}
        <li class="chip">
          {host}
          <button type="button" class="x" aria-label="Remove {host}" onclick={() => onchange(hosts.filter((h) => h !== host))}>
            <Icon name="x" size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="field-hint" id="{uid}-hint">Subdomains are included. Add one domain at a time or separate them with commas.</p>
  {#if error}<p class="form-error" id="{uid}-err">{error}</p>{/if}
</div>

<style>
  .add-row {
    display: flex;
    gap: var(--space-2);
  }

  .add-row .input {
    flex: 1;
    min-width: 0;
    max-width: 24rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-sm);
    padding: 0 var(--space-1) 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
  }

  .x {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .x:hover {
    background: var(--color-surface-2);
    color: var(--color-text);
  }
</style>
