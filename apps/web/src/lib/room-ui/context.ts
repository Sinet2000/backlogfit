import type { RoomView } from '@backlogfit/core';
import { getContext, setContext } from 'svelte';
import type { RoomStore } from '../room/room.svelte.ts';

const KEY = Symbol('room');

export function provideRoom(get: () => RoomStore): void {
  setContext(KEY, get);
}

export function useRoom(): RoomStore {
  const get = getContext<(() => RoomStore) | undefined>(KEY);
  if (!get) throw new Error('useRoom() outside a room');
  return get();
}

export function viewOf(room: RoomStore): RoomView {
  const view = room.view;
  if (!view) throw new Error('room has no view yet');
  return view;
}
