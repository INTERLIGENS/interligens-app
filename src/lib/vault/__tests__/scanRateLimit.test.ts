// src/lib/vault/__tests__/scanRateLimit.test.ts
//
// Le module délègue désormais à src/lib/security/rateLimit.ts. Sans
// UPSTASH_REDIS_REST_URL/_TOKEN (le cas en CI), checkRateLimit retombe sur le
// store mémoire partagé : ces tests valident les plafonds et le cloisonnement
// des buckets, pas l'adaptateur Upstash lui-même.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __resetStoreForTest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { checkScanLimit, checkScanJobLimit, checkExplainLimit } from "../scanRateLimit";

beforeEach(() => {
  __resetStoreForTest();
});

describe("checkScanLimit — preset scan, 20 / 1 min / IP", () => {
  it("permet les premières requêtes", async () => {
    const result = await checkScanLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("bloque au-delà du plafond du preset", async () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < RATE_LIMIT_PRESETS.scan.max; i++) {
      expect((await checkScanLimit(ip)).allowed).toBe(true);
    }
    const blocked = await checkScanLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("compte par IP", async () => {
    for (let i = 0; i < RATE_LIMIT_PRESETS.scan.max + 5; i++) await checkScanLimit("9.9.9.9");
    expect((await checkScanLimit("8.8.8.8")).allowed).toBe(true);
  });
});

describe("checkScanJobLimit — bucket et politique distincts", () => {
  it("ne partage PAS son compteur avec checkScanLimit", async () => {
    const ip = "7.7.7.7";
    // On épuise entièrement le bucket scan…
    for (let i = 0; i < RATE_LIMIT_PRESETS.scan.max; i++) await checkScanLimit(ip);
    expect((await checkScanLimit(ip)).allowed).toBe(false);
    // …le bucket scanJob doit rester intact (keyPrefix différent).
    expect((await checkScanJobLimit(ip)).allowed).toBe(true);
  });

  it("respecte le plafond 60 / 5 min repris de l'ancien checkScanLimit", async () => {
    const ip = "6.6.6.6";
    for (let i = 0; i < 60; i++) {
      expect((await checkScanJobLimit(ip)).allowed).toBe(true);
    }
    expect((await checkScanJobLimit(ip)).allowed).toBe(false);
  });

  it("SCAN_RATE_LIMIT reste un override du plafond", async () => {
    vi.stubEnv("SCAN_RATE_LIMIT", "3");
    const ip = "4.4.4.4";
    for (let i = 0; i < 3; i++) {
      expect((await checkScanJobLimit(ip)).allowed).toBe(true);
    }
    expect((await checkScanJobLimit(ip)).allowed).toBe(false);
    vi.unstubAllEnvs();
  });

  it("une valeur SCAN_RATE_LIMIT illisible retombe sur le défaut du preset", async () => {
    vi.stubEnv("SCAN_RATE_LIMIT", "pas-un-nombre");
    const ip = "3.3.3.3";
    for (let i = 0; i < RATE_LIMIT_PRESETS.scanJob.max; i++) {
      expect((await checkScanJobLimit(ip)).allowed).toBe(true);
    }
    expect((await checkScanJobLimit(ip)).allowed).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("checkExplainLimit — bucket séparé", () => {
  it("ne partage pas son compteur avec checkScanLimit", async () => {
    const ip = "2.2.2.2";
    for (let i = 0; i < RATE_LIMIT_PRESETS.scan.max; i++) await checkScanLimit(ip);
    expect((await checkScanLimit(ip)).allowed).toBe(false);
    expect((await checkExplainLimit(ip)).allowed).toBe(true);
  });
});

/**
 * Politique d'échec (décision David) : seul le POST qui déclenche un coût
 * Helius est fail-closed. Les surfaces de lecture restent fail-open pour
 * qu'une panne Upstash ne mette pas le produit à terre.
 */
describe("politique d'échec quand Upstash est configuré mais en panne", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://invalid.upstash.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("scanJob : FAIL-CLOSED sur erreur HTTP", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
    const r = await checkScanJobLimit("1.1.1.1");
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("scanJob : FAIL-CLOSED quand fetch REJETTE (Upstash injoignable)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = await checkScanJobLimit("1.1.1.2");
    expect(r.allowed).toBe(false);
  });

  it("scan : FAIL-OPEN sur erreur HTTP", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
    expect((await checkScanLimit("1.1.1.3")).allowed).toBe(true);
  });

  it("scan : FAIL-OPEN quand fetch REJETTE, et ne propage pas l'exception", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ENOTFOUND");
    });
    await expect(checkScanLimit("1.1.1.4")).resolves.toMatchObject({ allowed: true });
  });
});
