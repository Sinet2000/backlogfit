<script lang="ts">
  import { DEFAULT_ID_PATTERN } from '@backlogfit/core';
  import { onMount } from 'svelte';
  import { cardName } from '#lib/cards.ts';
  import Button from '#lib/components/Button.svelte';
  import Card from '#lib/components/Card.svelte';
  import ChipEditor from '#lib/components/ChipEditor.svelte';
  import CopyField from '#lib/components/CopyField.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import QR from '#lib/components/QR.svelte';
  import Stepper from '#lib/components/Stepper.svelte';
  import Toasts from '#lib/components/Toasts.svelte';
  import { setColor } from '#lib/config/chips.ts';
  import {
    type Draft,
    defaultDraft,
    draftErrors,
    exampleLink,
    LIFETIMES,
    loadLastDraft,
    parsePresetFile,
    presetFileJson,
    type ScaleChoice,
    saveLastDraft,
    toRoomConfig,
    withPreset,
  } from '#lib/config/draft.ts';
  import { downloadText } from '#lib/download.ts';
  import { CREATE_ERROR_TEXT, CreateRoomError, createRoomOnServer } from '#lib/room/create.ts';
  import { createDemoRoom } from '#lib/room/demo.ts';
  import { type RoomLink, roomUrls } from '#lib/room/link.ts';
  import { localStore } from '#lib/room/storage.ts';
  import Seo from '#lib/seo/Seo.svelte';
  import { toasts } from '#lib/toast.svelte.ts';

  const STEPS = [
    'Estimation scale',
    'Task identifiers',
    'Session rules',
    'Review & create',
  ] as const;
  const CHOICES: { id: ScaleChoice; name: string; hint: string }[] = [
    {
      id: 'fibonacci',
      name: 'Fibonacci',
      hint: '0, 1, 2, 3, 5, 8, 13, 21 and ? ☕ ∞. The most common choice.',
    },
    {
      id: 'modifiedFibonacci',
      name: 'Modified Fibonacci',
      hint: '0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100.',
    },
    { id: 'tshirt', name: 'T-shirt sizes', hint: 'XS to XXL. Good for rough, early sizing.' },
    { id: 'powersOf2', name: 'Powers of 2', hint: '0, 1, 2, 4, 8, 16, 32, 64.' },
    { id: 'linear', name: 'Linear 1–10', hint: 'Every number from 1 to 10.' },
    { id: 'custom', name: 'Custom', hint: 'Type your own cards.' },
  ];
  const TIMERS: (number | null)[] = [null, 30, 60, 120, 180, 300];
  const timerLabel = (t: number | null) =>
    t === null ? 'No timer' : t < 60 ? `${t} seconds` : `${t / 60} min`;

  let draft = $state<Draft>(defaultDraft());
  let step = $state(0);
  let showErrors = $state(false);
  let creating = $state(false);
  let createError = $state<string | null>(null);
  let offerDemo = $state(false);
  let created = $state<{ link: RoomLink; demo: boolean } | null>(null);
  let allowInput = $state('');
  let fileInput: HTMLInputElement | undefined = $state();
  let heading: HTMLHeadingElement | undefined = $state();
  let forceDemo = $state(false);

  const errors = $derived(draftErrors(draft));
  const stepErrors = $derived.by(() => {
    if (step === 0) return errors.scale ? [errors.scale] : [];
    if (step === 1)
      return [errors.idPattern, errors.linkTemplate, errors.allowlist].filter(Boolean) as string[];
    if (step === 2) return [errors.maxParticipants, errors.passcode].filter(Boolean) as string[];
    return Object.values(errors).filter(Boolean) as string[];
  });
  const example = $derived(exampleLink(draft));
  const urls = $derived(
    created ? roomUrls(location.origin, created.link, created.demo ? 'demo' : '') : null,
  );

  onMount(() => {
    forceDemo = new URLSearchParams(location.search).has('demo');
    const last = loadLastDraft(localStore());
    if (last) draft = last;
  });

  function focusHeading() {
    queueMicrotask(() => heading?.focus());
  }

  function go(to: number) {
    if (to > step && stepErrors.length > 0) {
      showErrors = true;
      return;
    }
    showErrors = false;
    step = Math.max(0, Math.min(STEPS.length - 1, to));
    focusHeading();
  }

  function choose(id: ScaleChoice) {
    draft = withPreset(draft, id);
  }

  function addAllow() {
    const entries = allowInput
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== '' && !draft.allowlist.includes(s));
    if (entries.length) draft.allowlist = [...draft.allowlist, ...entries].slice(0, 50);
    allowInput = '';
  }

  function exportPreset() {
    const json = presetFileJson(draft, 'Backlogfit preset');
    if (!json) {
      toasts.show('Fix the highlighted settings before saving a preset.', 'error');
      return;
    }
    downloadText('backlogfit-preset.json', json, 'application/json');
  }

  async function importPreset(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024) {
      toasts.show('The file is too large.', 'error');
      return;
    }
    const r = parsePresetFile(await file.text());
    if (r.ok) {
      draft = r.draft;
      toasts.show(`Loaded preset “${r.name}”.`, 'success');
    } else toasts.show(r.error, 'error');
    if (fileInput) fileInput.value = '';
  }

  async function create(demo = forceDemo) {
    if (Object.keys(errors).length > 0) {
      showErrors = true;
      return;
    }
    const config = toRoomConfig(draft);
    if (!config) {
      createError = CREATE_ERROR_TEXT.rejected;
      return;
    }
    creating = true;
    createError = null;
    offerDemo = false;
    try {
      const input = { config, lifetimeHours: draft.lifetimeHours, passcode: draft.passcode };
      const link = demo
        ? await createDemoRoom({
            config,
            lifetimeHours: draft.lifetimeHours,
            passcode: draft.passcode,
          })
        : (await createRoomOnServer(input)).link;
      saveLastDraft(localStore(), draft);
      created = { link, demo };
      focusHeading();
    } catch (err) {
      const kind = err instanceof CreateRoomError ? err.kind : 'server';
      createError = CREATE_ERROR_TEXT[kind];
      offerDemo = kind === 'network' || kind === 'server';
    } finally {
      creating = false;
    }
  }

  function reset() {
    created = null;
    step = 0;
    draft = defaultDraft();
  }

  const policyText = {
    ids: 'Only task IDs like SCP-3655 are stored. Pasted links are shortened to their ID.',
    links: 'People can add full links to any website. Links open in a new tab.',
    allowlist: 'Links are allowed only to the domains you list, for example your company tracker.',
  } as const;
</script>

<Seo title="New session" description="Set up a new estimation session in four short steps." path="/new" noindex />

<div class="container page">
  {#if created && urls}
    <section class="done" aria-labelledby="done-h">
      <span class="ok-icon" aria-hidden="true"><Icon name="check" size={28} /></span>
      <h1 id="done-h" bind:this={heading} tabindex="-1">Your session is ready</h1>
      <p class="muted">Share the join link with your team. Keep the host link for yourself.</p>
      {#if created.demo}
        <p class="note">Offline demo: this session lives only in this browser tab, with simulated teammates.</p>
      {/if}

      <div class="share panel">
        <div class="share-main">
          <CopyField label="Join link for your team" value={urls.join} inputTestId="join-link" buttonTestId="copy-join-link" hint="Anyone with this link can join. Paste it in your meeting chat." />
          {#if urls.admin}
            <div class="admin-box">
              <CopyField label="Host link (only for you)" value={urls.admin} inputTestId="admin-link" buttonTestId="copy-admin-link" tone="warning" />
              <p class="warn"><Icon name="alert" size={18} /> <span><strong>Keep this link private.</strong> It gives full control of the session and cannot be shown again. Save it if you want to switch devices.</span></p>
            </div>
          {/if}
        </div>
        <div class="share-qr">
          <QR value={urls.join} label="QR code of the join link" size={180} />
          <p class="muted small">Scan to join from a phone</p>
        </div>
      </div>

      <div class="done-actions">
        <Button href={urls.admin ?? urls.join} variant="primary" size="lg" iconAfter="right" data-testid="open-room">Open the room</Button>
        <Button variant="ghost" onclick={reset}>Set up another session</Button>
      </div>
    </section>
  {:else}
    <header class="head">
      <div>
        <p class="eyebrow">New session</p>
        <h1 bind:this={heading} tabindex="-1">{STEPS[step]}</h1>
      </div>
      <div class="preset-tools">
        <Button size="sm" variant="ghost" icon="download" onclick={exportPreset} data-testid="preset-export">Save preset</Button>
        <Button size="sm" variant="ghost" icon="upload" onclick={() => fileInput?.click()} data-testid="preset-import">Load preset</Button>
        <input bind:this={fileInput} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-hidden="true" onchange={importPreset} data-testid="preset-file" />
      </div>
    </header>

    <Stepper steps={STEPS} current={step} onselect={(i) => go(i)} />

    <div class="layout">
      <form class="main panel" onsubmit={(e) => { e.preventDefault(); if (step < 3) go(step + 1); else void create(); }} novalidate>
        {#if step === 0}
          <fieldset class="group">
            <legend class="visually-hidden">Estimation scale</legend>
            <p class="intro muted">Pick the cards people vote with. You can change colors later; the value is always printed on the card.</p>
            <div class="choices">
              {#each CHOICES as c (c.id)}
                <label class="choice" class:on={draft.scaleChoice === c.id} data-testid="scale-preset-{c.id}">
                  <input type="radio" name="scale" value={c.id} checked={draft.scaleChoice === c.id} onchange={() => choose(c.id)} />
                  <span class="choice-text"><span class="choice-name">{c.name}</span><span class="field-hint">{c.hint}</span></span>
                </label>
              {/each}
            </div>
          </fieldset>
          {#if draft.scaleChoice === 'custom'}
            <ChipEditor deck={draft.scale} onchange={(d) => (draft.scale = d)} />
          {:else}
            <details class="colors">
              <summary>Edit card colors</summary>
              <div class="swatches">
                {#each draft.scale as card, i (card.value)}
                  <label class="sw">
                    <input type="color" value={card.color} oninput={(e) => (draft.scale = setColor(draft.scale, i, e.currentTarget.value))} aria-label="Color of card {cardName(card)}" />
                    <span>{card.value}</span>
                  </label>
                {/each}
              </div>
              <Button size="sm" variant="quiet" icon="refresh" onclick={() => choose(draft.scaleChoice)}>Use automatic colors</Button>
            </details>
          {/if}
        {:else if step === 1}
          <div class="group">
            <div class="field">
              <label class="field-label" for="id-pattern">Task ID format <span class="muted">(optional)</span></label>
              <input id="id-pattern" class="input mono" bind:value={draft.idPattern} placeholder={DEFAULT_ID_PATTERN} aria-describedby="id-pattern-hint" data-testid="setting-id-pattern" />
              <p class="field-hint" id="id-pattern-hint">Leave empty to recognise IDs like <code>SCP-3655</code> or <code>PAY-12</code> (letters, a dash, a number).</p>
              {#if showErrors && errors.idPattern}<p class="error">{errors.idPattern}</p>{/if}
            </div>

            <div class="field">
              <label class="field-label" for="link-tpl">Link to your tracker <span class="muted">(optional)</span></label>
              <input id="link-tpl" class="input mono" bind:value={draft.linkTemplate} placeholder="https://yourtracker/browse/{'{id}'}" aria-describedby="link-tpl-hint" inputmode="url" data-testid="setting-link-template" />
              <p class="field-hint" id="link-tpl-hint">
                Put <code>{'{id}'}</code> where the task ID goes.
                {#if example}Example: <span class="mono example">{example}</span>{/if}
              </p>
              {#if showErrors && errors.linkTemplate}<p class="error">{errors.linkTemplate}</p>{/if}
            </div>

            <fieldset class="field">
              <legend class="field-label">Links in task lists</legend>
              {#each ['ids', 'links', 'allowlist'] as const as p (p)}
                <label class="check">
                  <input type="radio" name="policy" value={p} checked={draft.taskPolicy === p} onchange={() => (draft.taskPolicy = p)} data-testid="setting-policy-{p}" />
                  <span class="check-text">
                    <span>{p === 'ids' ? 'IDs only' : p === 'links' ? 'Links allowed' : 'Only these domains'}</span>
                    <span class="field-hint">{policyText[p]}</span>
                  </span>
                </label>
              {/each}
            </fieldset>

            {#if draft.taskPolicy === 'allowlist'}
              <div class="field">
                <label class="field-label" for="allow">Allowed domains</label>
                <div class="add-row">
                  <input id="allow" class="input" bind:value={allowInput} placeholder="jira.yourcompany.com" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllow(); } }} data-testid="setting-allowlist-input" />
                  <Button icon="plus" onclick={addAllow}>Add</Button>
                </div>
                <ul class="chips" aria-label="Allowed domains">
                  {#each draft.allowlist as host (host)}
                    <li class="chip">
                      {host}
                      <button type="button" class="chip-x" aria-label="Remove {host}" onclick={() => (draft.allowlist = draft.allowlist.filter((h) => h !== host))}><Icon name="x" size={14} /></button>
                    </li>
                  {/each}
                </ul>
                <p class="field-hint">Subdomains are included. Add one domain at a time or separate them with commas.</p>
                {#if showErrors && errors.allowlist}<p class="error">{errors.allowlist}</p>{/if}
              </div>
            {/if}
          </div>
        {:else if step === 2}
          <div class="group">
            <div class="row2">
              <div class="field">
                <label class="field-label" for="expiry">Session length</label>
                <select id="expiry" class="select" bind:value={draft.lifetimeHours} data-testid="setting-expiry">
                  {#each LIFETIMES as h (h)}
                    <option value={h}>{h} {h === 1 ? 'hour' : 'hours'}{h === 2 ? ' (recommended)' : ''}</option>
                  {/each}
                </select>
                <p class="field-hint">Everything is deleted when the time is up.</p>
              </div>
              <div class="field">
                <label class="field-label" for="timer">Round timer</label>
                <select id="timer" class="select" bind:value={draft.timerSeconds} data-testid="setting-timer">
                  {#each TIMERS as t (t)}<option value={t}>{timerLabel(t)}</option>{/each}
                </select>
                <p class="field-hint">The host starts it when needed.</p>
              </div>
            </div>

            <label class="check">
              <input type="checkbox" bind:checked={draft.autoReveal} data-testid="setting-auto-reveal" />
              <span class="check-text"><span>Reveal automatically</span><span class="field-hint">Show the cards as soon as everyone has voted.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" bind:checked={draft.anonymousAfterReveal} data-testid="setting-anonymous" />
              <span class="check-text"><span>Anonymous results</span><span class="field-hint">Show the votes without names, so nobody feels put on the spot.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" bind:checked={draft.allowSpectators} data-testid="setting-spectators" />
              <span class="check-text"><span>Allow spectators</span><span class="field-hint">Stakeholders can watch without voting.</span></span>
            </label>
            <label class="check">
              <input type="checkbox" bind:checked={draft.lobby} data-testid="setting-lobby" />
              <span class="check-text"><span>Approve people before they join</span><span class="field-hint">You let each person in from a waiting list.</span></span>
            </label>

            <div class="row2">
              <div class="field">
                <label class="field-label" for="passcode">Passcode <span class="muted">(optional)</span></label>
                <input id="passcode" class="input" type="text" bind:value={draft.passcode} maxlength="64" autocomplete="off" spellcheck="false" aria-describedby="pass-hint" data-testid="setting-passcode" />
                <p class="field-hint" id="pass-hint">Tell it to people out loud. It is never saved in presets.</p>
              </div>
              <div class="field">
                <label class="field-label" for="maxp">Maximum people</label>
                <input id="maxp" class="input" type="number" min="2" max="500" bind:value={draft.maxParticipants} data-testid="setting-max-participants" />
                {#if showErrors && errors.maxParticipants}<p class="error">{errors.maxParticipants}</p>{/if}
              </div>
            </div>

            <fieldset class="field">
              <legend class="field-label">Look for everyone</legend>
              <div class="inline">
                {#each ['corporate', 'colorful'] as const as t (t)}
                  <label class="check">
                    <input type="radio" name="theme" value={t} checked={draft.theme === t} onchange={() => (draft.theme = t)} />
                    <span>{t === 'corporate' ? 'Corporate' : 'Colorful'}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          </div>
        {:else}
          <div class="group">
            <h2 class="sub">Summary</h2>
            <dl class="summary">
              <div><dt>Cards</dt><dd>{draft.scale.map((c) => c.value).join('  ')}</dd></div>
              <div><dt>Task links</dt><dd>{draft.taskPolicy === 'ids' ? 'IDs only' : draft.taskPolicy === 'links' ? 'Links allowed' : `Only ${draft.allowlist.join(', ')}`}{draft.linkTemplate ? `, IDs link to ${draft.linkTemplate}` : ''}</dd></div>
              <div><dt>Length</dt><dd>{draft.lifetimeHours} {draft.lifetimeHours === 1 ? 'hour' : 'hours'}, then everything is deleted</dd></div>
              <div><dt>Reveal</dt><dd>{draft.autoReveal ? 'Automatically when everyone has voted' : 'When you press Reveal'}{draft.anonymousAfterReveal ? ', without names' : ', with names'}</dd></div>
              <div><dt>Joining</dt><dd>{draft.lobby ? 'You approve each person' : 'Anyone with the link'}{draft.passcode ? ', passcode required' : ''}{draft.allowSpectators ? ', spectators allowed' : ''}, up to {draft.maxParticipants} people</dd></div>
              <div><dt>Timer</dt><dd>{timerLabel(draft.timerSeconds)}</dd></div>
            </dl>
            <p class="muted small"><Icon name="shield" size={16} /> Secret links are created in your browser. The server only receives a fingerprint of them, never the links themselves.</p>
            {#if createError}
              <div class="error banner" role="alert">
                <p>{createError}</p>
                {#if offerDemo}
                  <Button size="sm" onclick={() => create(true)} data-testid="create-demo">Try an offline demo instead</Button>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if showErrors && stepErrors.length > 0}
          <div class="error banner" role="alert">
            <p>Please fix this before you continue:</p>
            <ul>{#each stepErrors as e (e)}<li>{e}</li>{/each}</ul>
          </div>
        {/if}

        <div class="nav">
          {#if step > 0}
            <Button variant="ghost" icon="left" onclick={() => go(step - 1)} data-testid="wizard-back">Back</Button>
          {/if}
          <span class="spacer"></span>
          {#if step < STEPS.length - 1}
            <Button type="submit" variant="primary" iconAfter="right" data-testid="wizard-next">Continue</Button>
          {:else}
            <Button type="submit" variant="primary" size="lg" icon="play" disabled={creating} data-testid="wizard-create">
              {creating ? 'Creating…' : 'Create session'}
            </Button>
          {/if}
        </div>
      </form>

      <aside class="preview panel" aria-label="Preview of the deck">
        <h2 class="sub">Preview</h2>
        <div class="deck-preview">
          {#each draft.scale as card (card.value)}
            <Card {card} size="sm" />
          {/each}
        </div>
        {#if errors.scale}<p class="error small">{errors.scale}</p>{/if}
        <ul class="facts">
          <li><Icon name="clock" size={16} /> {draft.lifetimeHours} h, then deleted</li>
          <li><Icon name={draft.anonymousAfterReveal ? 'eyeoff' : 'eye'} size={16} /> {draft.anonymousAfterReveal ? 'Anonymous results' : 'Names shown at reveal'}</li>
          <li><Icon name={draft.lobby || draft.passcode ? 'lock' : 'users'} size={16} /> {draft.lobby ? 'You approve joiners' : draft.passcode ? 'Passcode protected' : 'Open to link holders'}</li>
        </ul>
      </aside>
    </div>
  {/if}
</div>

<Toasts />

<style>
  .page {
    padding-block: var(--space-8) var(--space-16);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  h1 {
    font-size: var(--text-3xl);
    margin-top: var(--space-1);
  }

  h1:focus {
    outline: none;
  }

  .preset-tools {
    display: flex;
    gap: var(--space-2);
  }

  .layout {
    display: grid;
    gap: var(--space-6);
    margin-top: var(--space-6);
    align-items: start;
  }

  @media (min-width: 960px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 320px;
    }

    .preview {
      position: sticky;
      top: var(--space-6);
    }
  }

  .main {
    padding: var(--space-6);
    display: grid;
    gap: var(--space-6);
  }

  .group {
    display: grid;
    gap: var(--space-5);
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .intro {
    margin-bottom: var(--space-1);
  }

  .choices {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  .choice {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    cursor: pointer;
  }

  .choice.on {
    border: 2px solid var(--color-accent);
    background: var(--color-accent-soft);
    padding: calc(var(--space-4) - 1px);
  }

  .choice input {
    width: 20px;
    height: 20px;
    margin: 2px 0 0;
    accent-color: var(--color-accent);
    flex: none;
  }

  .choice-text {
    display: grid;
    gap: 2px;
  }

  .choice-name {
    font-weight: var(--weight-semibold);
  }

  .colors summary {
    cursor: pointer;
    min-height: var(--target-min);
    display: flex;
    align-items: center;
    color: var(--color-accent);
    font-weight: var(--weight-medium);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-block: var(--space-2);
  }

  .sw {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: var(--text-sm);
  }

  .sw input {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .example {
    overflow-wrap: anywhere;
    color: var(--color-text);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .field {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .row2 {
    display: grid;
    gap: var(--space-5);
  }

  @media (min-width: 640px) {
    .row2 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .inline {
    display: flex;
    gap: var(--space-6);
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
  }

  .add-row .input {
    flex: 1;
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

  .chips:empty {
    display: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
  }

  .chip-x {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    cursor: pointer;
  }

  .chip-x:hover {
    background: var(--color-surface-2);
  }

  .error {
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .banner {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    background: var(--color-danger-soft);
    color: var(--color-text);
  }

  .banner ul {
    margin: 0;
    padding-left: var(--space-5);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .spacer {
    flex: 1;
  }

  .sub {
    font-size: var(--text-md);
  }

  .summary {
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }

  .summary div {
    display: grid;
    gap: 2px;
  }

  @media (min-width: 640px) {
    .summary div {
      grid-template-columns: 9rem 1fr;
    }
  }

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .small {
    font-size: var(--text-sm);
  }

  .small :global(.icon) {
    margin-right: var(--space-1);
  }

  .preview {
    padding: var(--space-5);
    display: grid;
    gap: var(--space-4);
  }

  .deck-preview {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .facts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .facts li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .done {
    max-width: 880px;
    margin-inline: auto;
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  .ok-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--radius-full);
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .note {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    font-size: var(--text-sm);
  }

  .share {
    width: 100%;
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  @media (min-width: 760px) {
    .share {
      grid-template-columns: 1fr auto;
    }
  }

  .share-main {
    display: grid;
    gap: var(--space-6);
    min-width: 0;
  }

  .share-qr {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: var(--space-2);
  }

  .admin-box {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    background: var(--color-warning-soft);
  }

  .warn {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .warn :global(.icon) {
    color: var(--color-warning);
    margin-top: 2px;
  }

  .done-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  @media (max-width: 480px) {
    .main,
    .share {
      padding: var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
