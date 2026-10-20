// Texts are chosen by code only; nothing the server or another participant sent is echoed.
import type { ErrorCode } from '@backlogfit/core';
import type { EndReason } from './connection.ts';

export type EndedReason = EndReason | 'invalid_link';

const ERRORS: Partial<Record<ErrorCode, string>> = {
  forbidden: 'Only the host can do that.',
  room_locked: 'This session is locked. Ask the host to unlock it.',
  room_full: 'This session is full.',
  spectators_disabled: 'The host has turned off watching. Join as a voter instead.',
  bad_passcode: 'That passcode is not right. Check it with the host.',
  passcode_locked: 'Too many wrong passcodes. Ask the host to unlock the session.',
  not_voting: 'Voting is not open right now.',
  wrong_task: 'The task changed. Pick your card again.',
  wrong_round: 'A new round started. Pick your card again.',
  invalid_value: 'That card is not in this deck.',
  unknown_task: 'That task no longer exists.',
  unknown_participant: 'That person has left.',
  invalid_target: 'That action is not possible for this person.',
  too_many_tasks: 'Too many tasks. Remove some before adding more.',
  no_current_task: 'Pick a task first.',
  rate_limited: 'Slow down a little and try again.',
  too_large: 'That was too much text at once.',
  unauthorized: 'This host link is not valid.',
};

export function errorText(code: ErrorCode, ref?: string): string {
  if (code === 'invalid_task') {
    const lines = ref?.startsWith('lines:') ? ref.slice(6).split(',').length : 0;
    return lines > 0
      ? `${lines} ${lines === 1 ? 'line was' : 'lines were'} not added (not allowed by the link rules, or too long).`
      : 'Some lines were not added.';
  }
  return ERRORS[code] ?? 'Something went wrong. Please try again.';
}

export const DELETED_NOTE = 'Sessions are deleted automatically to protect your data.';

export function endedText(
  reason: EndedReason,
  joinError: ErrorCode | null,
): { title: string; body: string; canRetry: boolean } {
  switch (reason) {
    case 'expired':
      return {
        title: 'This session has ended.',
        body: `It reached its time limit. ${DELETED_NOTE}`,
        canRetry: false,
      };
    case 'idle':
      return {
        title: 'This session has ended.',
        body: `It was inactive for too long. ${DELETED_NOTE}`,
        canRetry: false,
      };
    case 'closed':
      return {
        title: 'This session has ended.',
        body: `The host closed it. ${DELETED_NOTE}`,
        canRetry: false,
      };
    case 'not_found':
      return {
        title: 'This session has ended.',
        body: `The session is over, or the link is incomplete. ${DELETED_NOTE}`,
        canRetry: false,
      };
    case 'invalid_link':
      return {
        title: 'This link doesn’t work.',
        body: 'It may be cut off. Ask the host to send the join link again, and copy it in full, including everything after #.',
        canRetry: false,
      };
    case 'kicked':
      return {
        title: 'You were removed from this session.',
        body: 'Ask the host if you think this was a mistake.',
        canRetry: false,
      };
    case 'denied':
      return {
        title: 'The host did not let you in.',
        body: 'Ask the host if you think this was a mistake.',
        canRetry: false,
      };
    case 'replaced':
      return {
        title: 'This session is open in another tab.',
        body: 'You can keep using it there, or continue here.',
        canRetry: true,
      };
    case 'unreachable':
      return {
        title: 'Cannot reach the server.',
        body: 'Check your connection. Your place is kept for a while, so you can try again.',
        canRetry: true,
      };
    case 'left':
      return {
        title: 'You left the session.',
        body: 'You can join again with the same link.',
        canRetry: false,
      };
    case 'rejected':
      return {
        title: 'You could not join.',
        body: joinError ? errorText(joinError) : 'The session refused the request.',
        canRetry: joinError !== 'unauthorized',
      };
  }
}
