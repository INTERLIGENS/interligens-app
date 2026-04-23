import { describe, it, expect } from "vitest";
import {
  buildTemplateNarrative,
  computeInputCompleteness,
  generateNarrative,
  type NarrativeInput,
} from "@/lib/narrative/generator";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_INPUT: NarrativeInput = {
  kolHandle: "GordonGekko",
  tokenSymbol: "BOTIFY",
  tokenMint: "TokenMint111111111111111111111111111111111",
  totalProceedsUsd: 40627,
  cashoutDestination: "Binance",
  intermediateWallets: 2,
  shillFollowers: 50000,
  priceDropPct: 94,
  deltaHours: 4,
  chain: "solana",
};

const PARTIAL_INPUT: NarrativeInput = {
  kolHandle: "planted",
  tokenSymbol: "SCAM",
  totalProceedsUsd: 15000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildTemplateNarrative", () => {
  it("test 1 — all fields → narrative complète EN+FR", () => {
    const { en, fr } = buildTemplateNarrative(FULL_INPUT);

    expect(en).toContain("GordonGekko");
    expect(en).toContain("$BOTIFY");
    expect(en).toContain("Binance");
    expect(en).toContain("94%");
    expect(en).toContain("2 intermediate wallets");

    expect(fr).toContain("GordonGekko");
    expect(fr).toContain("$BOTIFY");
    expect(fr).toContain("Binance");
    expect(fr).toContain("94%");
    expect(fr).toContain("2 wallets intermédiaires");
  });

  it("test 2 — champs partiels → pas de chiffres inventés", () => {
    const minimal: NarrativeInput = { tokenSymbol: "RUG" };
    const { en, fr } = buildTemplateNarrative(minimal);

    // No invented numbers
    expect(en).not.toMatch(/\$\d+K/);
    expect(en).toContain("undisclosed amount");
    expect(fr).toContain("non divulgué");

    // No price drop sentence when priceDropPct absent
    expect(en).not.toContain("lost");
    expect(fr).not.toContain("perdu");
  });

  it("test 3 — narrative_en et narrative_fr toujours présents", () => {
    const { en, fr } = buildTemplateNarrative({});
    expect(typeof en).toBe("string");
    expect(en.length).toBeGreaterThan(0);
    expect(typeof fr).toBe("string");
    expect(fr.length).toBeGreaterThan(0);
  });
});

describe("computeInputCompleteness", () => {
  it("test 4 — 10/10 champs fournis → 100%", () => {
    expect(computeInputCompleteness(FULL_INPUT)).toBe(100);
  });

  it("test 5 — 3/10 champs → 30%", () => {
    expect(computeInputCompleteness(PARTIAL_INPUT)).toBe(30);
  });

  it("test 6 — aucun champ → 0%", () => {
    expect(computeInputCompleteness({})).toBe(0);
  });
});

describe("generateNarrative", () => {
  it("test 7 — confidence HIGH si completeness > 70%", async () => {
    const result = await generateNarrative(FULL_INPUT);
    expect(result.confidence).toBe("HIGH");
    expect(result.input_completeness).toBe(100);
  });

  it("test 8 — fallback template si pas de API key (env non défini)", async () => {
    const orig = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await generateNarrative(FULL_INPUT);
      expect(result.narrative_en.length).toBeGreaterThan(0);
      expect(result.narrative_fr.length).toBeGreaterThan(0);
      // Template mode — should contain known data
      expect(result.narrative_en).toContain("GordonGekko");
    } finally {
      if (orig !== undefined) process.env.ANTHROPIC_API_KEY = orig;
    }
  });
});
