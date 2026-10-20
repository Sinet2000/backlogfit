<script lang="ts">
import type { RoomView } from '@backlogfit/core';
import Dialog from '../components/Dialog.svelte';
import type { RoomStore } from '../room/room.svelte.ts';

let {
  room,
  view,
  open = $bindable(),
}: { room: RoomStore; view: RoomView; open: boolean } = $props();

const s = $derived(view.settings);
const set = (patch: Record<string, boolean | number | null>) =>
  room.send({ type: 'admin.settings', ...patch });
const TIMERS = [null, 30, 60, 120, 180, 300];
const timerLabel = (t: number | null) =>
  t === null ? 'No default timer' : t < 60 ? `${t} seconds` : `${t / 60} min`;
</script>

<Dialog bind:open title="Session settings">
  <div class="list">
    <label class="check">
      <input type="checkbox" checked={s.autoReveal} onchange={(e) => set({ autoReveal: e.currentTarget.checked })} data-testid="setting-auto-reveal" />
      <span class="check-text"><span>Reveal automatically</span><span class="field-hint">Show the cards as soon as everyone has voted.</span></span>
    </label>
    <label class="check">
      <input type="checkbox" checked={s.anonymousAfterReveal} onchange={(e) => set({ anonymousAfterReveal: e.currentTarget.checked })} data-testid="setting-anonymous" />
      <span class="check-text"><span>Anonymous results</span><span class="field-hint">Show the votes without names. Applies from the next round.</span></span>
    </label>
    <label class="check">
      <input type="checkbox" checked={s.allowSpectators} onchange={(e) => set({ allowSpectators: e.currentTarget.checked })} data-testid="setting-spectators" />
      <span class="check-text"><span>Allow spectators</span><span class="field-hint">People can watch without voting.</span></span>
    </label>
    <label class="check">
      <input type="checkbox" checked={s.lobby} onchange={(e) => set({ lobby: e.currentTarget.checked })} data-testid="setting-lobby" />
      <span class="check-text"><span>Approve people before they join</span><span class="field-hint">Turning this off lets everyone who is waiting in.</span></span>
    </label>
    <div class="field">
      <label class="field-label" for="set-timer">Default round timer</label>
      <select id="set-timer" class="select" value={s.timerSeconds === null ? '' : String(s.timerSeconds)} onchange={(e) => set({ timerSeconds: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })} data-testid="setting-timer">
        {#each TIMERS as t (t)}
          <option value={t === null ? '' : String(t)}>{timerLabel(t)}</option>
        {/each}
      </select>
    </div>
  </div>
</Dialog>

<style>
  .list {
    display: grid;
    gap: var(--space-2);
  }

  .field {
    margin-top: var(--space-3);
  }
</style>
