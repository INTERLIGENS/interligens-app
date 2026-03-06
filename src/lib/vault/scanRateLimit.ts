// src/lib/vault/scanRateLimit.ts
// Simple in-memory rate limiter. Best-effort on Vercel (stateless).
// For prod: swap store with Upstash Redis.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const SCAN_LIMIT    = parseInt(process.env.SCAN_RATE_LIMIT    ?? "60");
const EXPLAIN_LIMIT = parseInt(process.env.EXPLAIN_RATE_LIMIT ?? "30");
const WINDOW_MS     = parseInt(process.env.RATE_WINDOW_MS     ?? "300000"); // 5 min

function check(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const win = store.get(key);

  if (!win || now > win.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (win.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  win.count++;
  return { allowed: true, remaining: limit - win.count };
}

export function checkScanLimit(ip: string)    { return check(`scan:${ip}`,    SCAN_LIMIT); }
export function checkExplainLimit(ip: string) { return check(`explain:${ip}`, EXPLAIN_LIMIT); }
