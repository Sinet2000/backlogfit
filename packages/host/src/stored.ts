import { normalizeRoomState, type RoomState } from '@backlogfit/core';

/** RoomState.v this build reads. Rooms live at most 24 h, so other versions are dropped. */
export const STATE_VERSION = 1;

/** Parses a stored row; null means "unreadable or another version: delete it". */
export function readStoredState(json: string, roomId?: string): RoomState | null {
  let state: RoomState;
  try {
    state = JSON.parse(json) as RoomState;
  } catch {
    return null;
  }
  if (
    typeof state !== 'object' ||
    state === null ||
    state.v !== STATE_VERSION ||
    typeof state.roomId !== 'string' ||
    (roomId !== undefined && state.roomId !== roomId) ||
    typeof state.expiresAt !== 'number' ||
    !Array.isArray(state.participants) ||
    !Array.isArray(state.tasks) ||
    typeof state.config !== 'object' ||
    state.config === null
  ) {
    return null;
  }
  return normalizeRoomState(state);
}
