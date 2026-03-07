// src/lib/vault/ratelimit/memoryStore.ts
import type { RateLimitStore, RateLimitEntry } from "./store";

const store = new Map<string, { value: RateLimitEntry; expiresAt: number }>();

export const memoryStore: RateLimitStore = {
  async get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.value;
  },
  async set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
};

export function _resetMemoryStore() { store.clear(); }
