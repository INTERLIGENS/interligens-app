const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const store = new Map<string, number[]>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Clean expired entries and get current window
  const timestamps = (store.get(ip) ?? []).filter((t) => t > cutoff);

  const allowed = timestamps.length < MAX_REQUESTS;
  if (allowed) timestamps.push(now);

  if (timestamps.length > 0) {
    store.set(ip, timestamps);
  } else {
    store.delete(ip);
  }

  const oldest = timestamps[0] ?? now;
  const resetAt = oldest + WINDOW_MS;

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - timestamps.length),
    resetAt,
  };
}

/** Reset store — tests only */
export function __resetForTest(): void {
  store.clear();
}
