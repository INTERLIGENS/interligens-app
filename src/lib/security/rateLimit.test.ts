import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  __resetStoreForTest,
  type RateLimitConfig,
} from "./rateLimit";

// Config serrée pour les tests (pas les presets prod)
const CFG: RateLimitConfig = { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "test" };

beforeEach(() => {
  __resetStoreForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Sliding window ────────────────────────────────────────────────────────────

describe("sliding window — in-memory", () => {
  it("autorise les 10 premières requêtes", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await checkRateLimit("1.1.1.1", CFG);
      expect(r.allowed).toBe(true);
    }
  });

  it("bloque la 11ème requête → 429", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("1.1.1.2", CFG);
    const r = await checkRateLimit("1.1.1.2", CFG);

    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("remaining décroît correctement", async () => {
    for (let i = 0; i < 7; i++) await checkRateLimit("1.1.1.3", CFG);
    const r = await checkRateLimit("1.1.1.3", CFG);

    expect(r.remaining).toBe(2); // 8 utilisées, max 10
  });

  it("reset complet après expiration de la fenêtre", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("1.1.1.4", CFG);
    const blocked = await checkRateLimit("1.1.1.4", CFG);
    expect(blocked.allowed).toBe(false);

    // Avance le temps au-delà de la fenêtre
    vi.advanceTimersByTime(CFG.windowMs + 1);

    const r = await checkRateLimit("1.1.1.4", CFG);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9); // 1 utilisée dans la nouvelle fenêtre
  });

  it("IPs différentes ont des compteurs indépendants", async () => {
    const small: RateLimitConfig = { windowMs: 60_000, max: 3, keyPrefix: "iso" };
    for (let i = 0; i < 3; i++) await checkRateLimit("10.0.0.1", small);

    const blocked = await checkRateLimit("10.0.0.1", small);
    expect(blocked.allowed).toBe(false);

    const other = await checkRateLimit("10.0.0.2", small);
    expect(other.allowed).toBe(true);
  });

  it("keyPrefix différent = compteurs séparés pour la même IP", async () => {
    const cfgA: RateLimitConfig = { windowMs: 60_000, max: 2, keyPrefix: "ns:a" };
    const cfgB: RateLimitConfig = { windowMs: 60_000, max: 2, keyPrefix: "ns:b" };

    await checkRateLimit("5.5.5.5", cfgA);
    await checkRateLimit("5.5.5.5", cfgA);
    const blockedA = await checkRateLimit("5.5.5.5", cfgA);
    expect(blockedA.allowed).toBe(false);

    const freeB = await checkRateLimit("5.5.5.5", cfgB);
    expect(freeB.allowed).toBe(true);
  });
});

// ── retryAfter ────────────────────────────────────────────────────────────────

describe("retryAfter", () => {
  it("retryAfter est 0 quand allowed", async () => {
    const r = await checkRateLimit("2.2.2.2", CFG);
    expect(r.retryAfter).toBe(0);
  });

  it("retryAfter > 0 et <= windowMs/1000 quand bloqué", async () => {
    for (let i = 0; i < 10; i++) await checkRateLimit("2.2.2.3", CFG);
    const r = await checkRateLimit("2.2.2.3", CFG);

    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(CFG.windowMs / 1000);
  });
});

// ── rateLimitResponse ─────────────────────────────────────────────────────────

describe("rateLimitResponse", () => {
  const makeResult = (retryAfter = 42) => ({
    allowed: false,
    remaining: 0,
    limit: 10,
    retryAfter,
    resetAt: Date.now() + retryAfter * 1000,
  });

  it("retourne HTTP 429", () => {
    const res = rateLimitResponse(makeResult());
    expect(res.status).toBe(429);
  });

  it("header Retry-After présent et correct", () => {
    const res = rateLimitResponse(makeResult(42));
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("header X-RateLimit-Limit présent", () => {
    const res = rateLimitResponse(makeResult());
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("message EN correct", async () => {
    const res  = rateLimitResponse(makeResult(5), "en");
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/5 seconds/);
  });

  it("message FR correct", async () => {
    const res  = rateLimitResponse(makeResult(1), "fr");
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/1 seconde/);
    expect(body.error).not.toMatch(/secondes/); // singulier
  });

  it("singulier anglais pour 1 seconde", async () => {
    const res  = rateLimitResponse(makeResult(1), "en");
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/1 second[^s]/); // "second" pas "seconds"
  });
});

// ── getClientIp ───────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  const makeReq = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("préfère x-real-ip", () => {
    const req = makeReq({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("fallback sur x-forwarded-for (premier)", () => {
    const req = makeReq({ "x-forwarded-for": "8.8.8.8, 1.1.1.1" });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });

  it("retourne unknown si aucun header", () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe("unknown");
  });
});

// ── detectLocale ──────────────────────────────────────────────────────────────

describe("detectLocale", () => {
  const makeReq = (al: string) =>
    new Request("https://example.com", { headers: { "accept-language": al } });

  it("détecte fr", () => {
    expect(detectLocale(makeReq("fr-FR,fr;q=0.9"))).toBe("fr");
  });

  it("retourne en par défaut", () => {
    expect(detectLocale(makeReq("en-US,en;q=0.9"))).toBe("en");
  });

  it("retourne en si pas de header", () => {
    expect(detectLocale(new Request("https://example.com"))).toBe("en");
  });
});
