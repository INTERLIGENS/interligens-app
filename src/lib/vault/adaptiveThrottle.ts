// src/lib/vault/adaptiveThrottle.ts
// Fingerprint = ip + user-agent, throttle adaptatif si trop de matches vault

import { envInt } from "@/lib/config/envNumber";

interface FingerprintState {
  matchCount: number;
  requestCount: number;
  windowStart: number;
  throttledUntil: number;
}

// Non fini -> défaut littéral. En NaN, `elapsed > WINDOW_MS` et
// `matches >= MATCH_LIMIT` sont tous deux false : la fenêtre ne se réinitialise
// jamais ET le throttle ne se déclenche jamais.
const WINDOW_MS    = envInt("RATE_WINDOW_MS", 300000); // 5min
const MATCH_LIMIT  = envInt("THROTTLE_MATCH_LIMIT", 20);
const COOLDOWN_MS  = 10 * 60 * 1000; // 10min

const store = new Map<string, FingerprintState>();

export function getFingerprint(ip: string, ua: string): string {
  return `${ip}|${ua.slice(0, 64)}`;
}

export function checkAdaptiveThrottle(
  ip: string,
  ua: string,
  matched: boolean
): { allowed: boolean; throttled: boolean } {
  const fp = getFingerprint(ip, ua);
  const now = Date.now();
  let state = store.get(fp);

  if (!state || now - state.windowStart > WINDOW_MS) {
    state = { matchCount: 0, requestCount: 0, windowStart: now, throttledUntil: 0 };
  }

  if (now < state.throttledUntil) {
    return { allowed: false, throttled: true };
  }

  state.requestCount++;
  if (matched) state.matchCount++;

  if (state.matchCount >= MATCH_LIMIT) {
    state.throttledUntil = now + COOLDOWN_MS;
    store.set(fp, state);
    return { allowed: false, throttled: true };
  }

  store.set(fp, state);
  return { allowed: true, throttled: false };
}

export function _resetThrottleStore() { store.clear(); }
