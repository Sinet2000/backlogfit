/**
 * Where the app under test lives. Defaults match the shared dev conventions (Node server on 8080).
 * A second server with an accelerated clock (TEST_TIME_SCALE=60) serves the expiry specs so that
 * the 60x clock never makes ordinary specs flaky.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
export const FAST_URL = process.env.E2E_FAST_URL ?? 'http://localhost:8081';

/** 1 room minute per real second on the fast server. */
export const FAST_TIME_SCALE = Number(process.env.E2E_FAST_TIME_SCALE ?? '60');

/** Origins a page may talk to: the app itself (http + ws) and nothing else. */
export function allowedOrigins(base: string): Set<string> {
  const u = new URL(base);
  const ws = new URL(base);
  ws.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return new Set([u.origin, ws.origin]);
}
