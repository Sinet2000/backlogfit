import { makeTeamId, splitTeamTags, type Team, withTeamTags } from '@backlogfit/core';
import { downloadText } from '../download.ts';
import { CREATE_ERROR_TEXT, CreateRoomError, createRoomOnServer } from '../room/create.ts';
import { createDemoRoom } from '../room/demo.ts';
import type { RoomLink } from '../room/link.ts';
import {
  moveItem,
  type PreparedItem,
  parsePrepared,
  savePrepared,
  uniqueLines,
} from '../room/prepared-tasks.ts';
import { localStore, sessionStore } from '../room/storage.ts';
import { toasts } from '../toast.svelte.ts';
import {
  type Draft,
  defaultDraft,
  draftErrors,
  loadLastDraft,
  parsePresetFile,
  presetFileJson,
  type ScaleChoice,
  saveLastDraft,
  teamNameError,
  toRoomConfig,
  withPreset,
} from './draft.ts';
import { LAST_STEP, STEPS, stepErrorsFor } from './wizard.ts';

const PRESET_FILE_MAX = 64 * 1024;

/** State and actions of the /new configurator. Prepared tasks never enter the draft or presets. */
export class SessionWizard {
  draft = $state<Draft>(defaultDraft());
  step = $state(0);
  showErrors = $state(false);
  creating = $state(false);
  createError = $state<string | null>(null);
  offerDemo = $state(false);
  created = $state<{
    link: RoomLink;
    demo: boolean;
    prepared: string[];
    teams: Team[];
  } | null>(null);
  tasksText = $state('');
  customFrom = $state<ScaleChoice | null>(null);
  forceDemo = false;

  errors = $derived(draftErrors(this.draft));
  stepErrors = $derived(stepErrorsFor(this.step, this.errors));
  parseOpts = $derived.by(() => {
    const c = toRoomConfig(this.draft);
    return c
      ? {
          policy: c.taskPolicy,
          allowlist: c.allowlist,
          idPattern: c.idPattern,
          linkTemplate: c.linkTemplate,
        }
      : { policy: this.draft.taskPolicy, allowlist: this.draft.allowlist };
  });
  lines = $derived(uniqueLines(this.tasksText));
  items = $derived<PreparedItem[]>(parsePrepared(this.lines, this.parseOpts, this.draft.teams));
  validLines = $derived(this.items.filter((i) => i.task !== null).map((i) => i.line));
  invalidCount = $derived(this.items.length - this.validLines.length);

  load(search: string): void {
    this.forceDemo = new URLSearchParams(search).has('demo');
    const last = loadLastDraft(localStore());
    if (last) this.draft = last;
  }

  /** Moves to another step; moving forward is refused while the current step has errors. */
  go(to: number): boolean {
    if (to > this.step && this.stepErrors.length > 0) {
      this.showErrors = true;
      return false;
    }
    this.showErrors = false;
    this.step = Math.max(0, Math.min(LAST_STEP, to));
    return true;
  }

  get title(): string {
    return STEPS[this.step] ?? STEPS[0];
  }

  chooseScale(id: ScaleChoice): void {
    if (id === 'custom' && this.draft.scaleChoice !== 'custom')
      this.customFrom = this.draft.scaleChoice;
    this.draft = withPreset(this.draft, id);
  }

  clearDeck(): void {
    this.customFrom = null;
    this.draft = { ...this.draft, scale: [] };
  }

  setLines(lines: readonly string[]): void {
    this.tasksText = lines.join('\n');
  }

  moveLine(from: number, to: number): void {
    this.setLines(moveItem(this.lines, from, to));
  }

  removeLines(indexes: readonly number[]): void {
    const drop = new Set(indexes);
    const before = this.tasksText;
    this.setLines(this.lines.filter((_, i) => !drop.has(i)));
    this.#undoable(drop.size === 1 ? 'Line removed.' : `${drop.size} lines removed.`, before);
  }

  replaceLine(index: number, text: string): void {
    const next = [...this.lines];
    if (text.trim() === '') next.splice(index, 1);
    else next[index] = text.trim();
    this.setLines(next);
  }

  addTeam(name: string): boolean {
    const teams = this.draft.teams;
    if (teamNameError(name, teams) !== null) return false;
    const clean = name.normalize('NFC').trim();
    const id = makeTeamId(
      clean,
      teams.map((t) => t.id),
    );
    this.draft = { ...this.draft, teams: [...teams, { id, name: clean }] };
    return true;
  }

  renameTeam(id: string, name: string): boolean {
    const teams = this.draft.teams;
    if (teamNameError(name, teams, id) !== null) return false;
    const clean = name.normalize('NFC').trim();
    const next = teams.map((t) => (t.id === id ? { ...t, name: clean } : t));
    this.setLines(
      this.lines.map((l) => {
        const tagged = splitTeamTags(l, teams);
        return tagged.voters ? withTeamTags(tagged.line, tagged.voters, next) : l;
      }),
    );
    this.draft = { ...this.draft, teams: next };
    return true;
  }

  removeTeam(id: string): void {
    const teams = this.draft.teams;
    this.setLines(
      this.lines.map((l) => {
        const tagged = splitTeamTags(l, teams);
        if (!tagged.voters?.includes(id)) return l;
        const left = tagged.voters.filter((v) => v !== id);
        return withTeamTags(l, left.length > 0 ? left : null, teams);
      }),
    );
    this.draft = { ...this.draft, teams: teams.filter((t) => t.id !== id) };
  }

  setLineVoters(index: number, voters: string[] | null): void {
    const line = this.lines[index];
    if (line === undefined) return;
    const next = [...this.lines];
    next[index] = withTeamTags(line, voters, this.draft.teams);
    this.setLines(next);
  }

  clearLines(): void {
    const before = this.tasksText;
    this.tasksText = '';
    this.#undoable('Task list cleared.', before);
  }

  exportPreset(): void {
    const json = presetFileJson(this.draft, 'Backlogfit settings');
    if (!json) {
      toasts.show('Fix the highlighted settings before saving them.', 'error');
      return;
    }
    downloadText('backlogfit-settings.json', json, 'application/json');
  }

  async importPreset(file: File): Promise<void> {
    if (file.size > PRESET_FILE_MAX) {
      toasts.show('The file is too large.', 'error');
      return;
    }
    const r = parsePresetFile(await file.text());
    if (r.ok) {
      this.draft = r.draft;
      this.customFrom = null;
      toasts.show(`Loaded settings “${r.name}”.`, 'success');
    } else toasts.show(r.error, 'error');
  }

  async create(demo = this.forceDemo): Promise<boolean> {
    if (Object.keys(this.errors).length > 0) {
      this.showErrors = true;
      return false;
    }
    const config = toRoomConfig(this.draft);
    if (!config) {
      this.createError = CREATE_ERROR_TEXT.rejected;
      return false;
    }
    this.creating = true;
    this.createError = null;
    this.offerDemo = false;
    const input = {
      config,
      lifetimeHours: this.draft.lifetimeHours,
      passcode: this.draft.passcode,
    };
    try {
      const link = demo ? await createDemoRoom(input) : (await createRoomOnServer(input)).link;
      const prepared = [...this.validLines];
      saveLastDraft(localStore(), this.draft);
      savePrepared(sessionStore(), link.roomId, prepared);
      this.created = { link, demo, prepared, teams: config.teams.map((t) => ({ ...t })) };
      return true;
    } catch (err) {
      const kind = err instanceof CreateRoomError ? err.kind : 'server';
      this.createError = CREATE_ERROR_TEXT[kind];
      this.offerDemo = kind === 'network' || kind === 'server';
      return false;
    } finally {
      this.creating = false;
    }
  }

  reset(): void {
    this.created = null;
    this.step = 0;
    this.draft = defaultDraft();
    this.tasksText = '';
    this.customFrom = null;
  }

  #undoable(text: string, before: string): void {
    toasts.show(text, 'info', {
      ms: 5000,
      action: { label: 'Undo', run: () => (this.tasksText = before) },
    });
  }
}
