import type { DraftErrors, ScaleChoice } from './draft.ts';

export const STEPS = ['Estimation scale', 'Tasks', 'Session rules', 'Review & create'] as const;
export type StepIndex = 0 | 1 | 2 | 3;
export const LAST_STEP = STEPS.length - 1;

export const SCALE_CHOICES: readonly { id: ScaleChoice; name: string; hint: string }[] = [
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

export function choiceName(id: ScaleChoice): string {
  return SCALE_CHOICES.find((c) => c.id === id)?.name ?? 'your deck';
}

const STEP_FIELDS: Record<number, (keyof DraftErrors)[]> = {
  0: ['scale'],
  1: ['teams', 'idPattern', 'linkTemplate', 'allowlist'],
  2: ['maxParticipants', 'passcode'],
};

/** Errors that block leaving `step`; the last step is blocked by any error. */
export function stepErrorsFor(step: number, errors: DraftErrors): string[] {
  const fields = STEP_FIELDS[step] ?? (Object.keys(errors) as (keyof DraftErrors)[]);
  return fields.map((f) => errors[f]).filter((e): e is string => !!e);
}
