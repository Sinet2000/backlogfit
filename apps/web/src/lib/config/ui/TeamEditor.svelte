<script lang="ts">
  import { TEAM_NAME_MAX, TEAMS_MAX, type Team, teamTag } from '@backlogfit/core';
  import { tick } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Icon from '../../components/Icon.svelte';
  import { teamNameError } from '../draft.ts';

  interface Props {
    teams: readonly Team[];
    onadd: (name: string) => void;
    onrename: (id: string, name: string) => void;
    onremove: (id: string) => void;
    disabled?: boolean;
    hint?: string;
  }
  let { teams, onadd, onrename, onremove, disabled = false, hint }: Props = $props();

  const SUGGESTIONS = ['Dev', 'QA', 'BA', 'Design'];
  const uid = $props.id();
  let name = $state('');
  let error = $state<string | null>(null);
  let editing = $state<string | null>(null);
  let editName = $state('');
  let editError = $state<string | null>(null);
  let input: HTMLInputElement | undefined = $state();
  let editor: HTMLInputElement | undefined = $state();

  const full = $derived(teams.length >= TEAMS_MAX);
  const suggestions = $derived(
    SUGGESTIONS.filter((s) => !teams.some((t) => teamTag(t.name) === teamTag(s))),
  );

  function add(value = name) {
    const err = teamNameError(value, teams);
    if (err) {
      error = err;
      input?.focus();
      return;
    }
    onadd(value.normalize('NFC').trim());
    if (value === name) name = '';
    error = null;
  }

  async function startEdit(t: Team) {
    editing = t.id;
    editName = t.name;
    editError = null;
    await tick();
    editor?.focus();
    editor?.select();
  }

  function finishEdit(save: boolean) {
    const id = editing;
    if (id === null) return;
    if (save) {
      const current = teams.find((t) => t.id === id);
      if (current && editName.trim() !== current.name) {
        const err = teamNameError(editName, teams, id);
        if (err) {
          editError = err;
          return;
        }
        onrename(id, editName.normalize('NFC').trim());
      }
    }
    editing = null;
    editError = null;
  }
</script>

<div class="teams" data-testid="team-editor">
  {#if teams.length > 0}
    <ul class="chips" aria-label="Teams">
      {#each teams as t (t.id)}
        <li class="chip" data-testid="team-chip" data-team={t.id} data-name={t.name}>
          {#if editing === t.id}
            <input
              bind:this={editor}
              class="input rename"
              bind:value={editName}
              maxlength={TEAM_NAME_MAX * 2}
              aria-label="New name for {t.name}"
              aria-invalid={editError ? 'true' : undefined}
              aria-describedby={editError ? `${uid}-edit-err` : undefined}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  finishEdit(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  finishEdit(false);
                }
              }}
              onblur={() => finishEdit(true)}
              data-testid="team-rename-input"
            />
          {:else}
            <Icon name="users" size={14} />
            <span class="name">{t.name}</span>
            {#if !disabled}
              <button type="button" class="x" aria-label="Rename {t.name}" title="Rename" onclick={() => void startEdit(t)} data-testid="team-rename">
                <Icon name="edit" size={14} />
              </button>
              <button type="button" class="x" aria-label="Remove {t.name}" title="Remove" onclick={() => onremove(t.id)} data-testid="team-remove">
                <Icon name="x" size={14} />
              </button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
    {#if editError}<p class="form-error" id="{uid}-edit-err" role="alert">{editError}</p>{/if}
  {/if}

  {#if !disabled && !full}
    <div class="add-row">
      <label class="visually-hidden" for="{uid}-team">Team name</label>
      <input
        bind:this={input}
        id="{uid}-team"
        class="input"
        bind:value={name}
        maxlength={TEAM_NAME_MAX * 2}
        placeholder="Team name, for example Mobile"
        autocomplete="off"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby="{uid}-hint{error ? ` ${uid}-err` : ''}"
        oninput={() => (error = null)}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        data-testid="team-input"
      />
      <Button icon="plus" onclick={() => add()} data-testid="team-add">Add team</Button>
    </div>
    {#if suggestions.length > 0}
      <div class="suggest">
        <span class="muted">Quick add:</span>
        {#each suggestions as s (s)}
          <button type="button" class="suggestion" onclick={() => add(s)} data-testid="team-suggest" data-name={s}>
            <Icon name="plus" size={14} />{s}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
  {#if error}<p class="form-error" id="{uid}-err" role="alert">{error}</p>{/if}
  <p class="field-hint" id="{uid}-hint">
    {#if full}You have the maximum of {TEAMS_MAX} teams.{:else}{hint ?? 'Up to 6 teams.'}{/if}
  </p>
</div>

<style>
  .teams {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
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
    min-height: var(--control-sm);
    padding: 0 var(--space-1) 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .chip:has(.rename) {
    padding: 2px;
  }

  .chip > :global(.icon) {
    color: var(--color-text-muted);
  }

  .name {
    margin-right: var(--space-1);
    overflow-wrap: anywhere;
  }

  .rename {
    min-height: 0;
    height: calc(var(--control-sm) - 4px);
    width: 12rem;
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
  }

  .x {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
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

  .add-row {
    display: flex;
    gap: var(--space-2);
  }

  .add-row .input {
    flex: 1;
    min-width: 0;
    max-width: 22rem;
  }

  .suggest {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .suggestion {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 0 var(--space-3);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .suggestion:hover {
    border-style: solid;
    background: var(--color-surface-2);
  }

  @media (pointer: coarse) {
    .x {
      width: 36px;
      height: 36px;
    }

    .suggestion {
      min-height: var(--target-min);
    }
  }
</style>
