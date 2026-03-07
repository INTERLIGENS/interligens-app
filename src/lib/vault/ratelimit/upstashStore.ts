// src/lib/vault/ratelimit/upstashStore.ts
import type { RateLimitStore, RateLimitEntry } from "./store";

export function createUpstashStore(url: string, token: string): RateLimitStore {
  async function req(path: string, body?: unknown) {
    const res = await fetch(`${url}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    return res.json();
  }

  return {
    async get(key) {
      try {
        const data = await req(`/get/${encodeURIComponent(key)}`);
        if (!data.result) return null;
        return JSON.parse(data.result) as RateLimitEntry;
      } catch { return null; }
    },
    async set(key, value, ttlMs) {
      try {
        const ttlSec = Math.ceil(ttlMs / 1000);
        await req(`/set/${encodeURIComponent(key)}`, [JSON.stringify(value), "EX", ttlSec]);
      } catch { /* fail-open */ }
    },
  };
}
