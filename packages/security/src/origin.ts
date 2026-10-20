/** Exact origin match (scheme, host, port). A missing Origin header is rejected. */
export function isAllowedOrigin(
  origin: string | null | undefined,
  allowed: readonly string[],
): boolean {
  if (!origin || origin === 'null') return false;
  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  return allowed.some((a) => {
    try {
      return new URL(a).origin === normalized;
    } catch {
      return false;
    }
  });
}
