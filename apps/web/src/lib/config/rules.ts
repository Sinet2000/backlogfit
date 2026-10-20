export const TIMER_CHOICES: readonly (number | null)[] = [null, 30, 60, 120, 180, 300];

export function timerLabel(seconds: number | null): string {
  if (seconds === null) return 'No timer';
  return seconds < 60 ? `${seconds} seconds` : `${seconds / 60} min`;
}

export function hoursLabel(h: number): string {
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

export interface RuleValues {
  autoReveal: boolean;
  anonymousAfterReveal: boolean;
  allowSpectators: boolean;
  lobby: boolean;
  timerSeconds: number | null;
}

export type RuleField = keyof RuleValues;
