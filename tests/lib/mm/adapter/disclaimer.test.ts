import { describe, it, expect } from "vitest";
import { generateDisclaimer } from "@/lib/mm/adapter/disclaimer";
import type { Freshness } from "@/lib/mm/adapter/types";

const fresh: Freshness = {
  computedAt: new Date().toISOString(),
  ageMinutes: 15,
  staleness: "fresh",
};
const aging: Freshness = { ...fresh, ageMinutes: 600, staleness: "aging" };
const stale: Freshness = { ...fresh, ageMinutes: 30 * 60, staleness: "stale" };

describe("generateDisclaimer", () => {
  it("ENTITY never carries a freshness prefix", () => {
    const msg = generateDisclaimer({
      subjectType: "ENTITY",
      dominantDriver: "REGISTRY",
      confidence: "high",
      coverage: "high",
      freshness: stale,
    });
    expect(msg).toBe("Fiche éditoriale. Voir méthodologie et droit de réponse.");
  });

  it("WALLET + REGISTRY + high confidence → entity attribution copy", () => {
    const msg = generateDisclaimer({
      subjectType: "WALLET",
      dominantDriver: "REGISTRY",
      confidence: "high",
      coverage: "high",
      freshness: fresh,
    });
    expect(msg).toContain("Wallet attribué à une entité documentée");
  });

  it("WALLET + BEHAVIORAL + high confidence → behavioral copy", () => {
    const msg = generateDisclaimer({
      subjectType: "WALLET",
      dominantDriver: "BEHAVIORAL",
      confidence: "high",
      coverage: "high",
      freshness: fresh,
    });
    expect(msg).toContain("Comportement on-chain suspect");
    expect(msg).not.toMatch(/^Analyse/); // no prefix when fresh
  });

  it("WALLET + MIXED driver → concordant signal copy", () => {
    const msg = generateDisclaimer({
      subjectType: "WALLET",
      dominantDriver: "MIXED",
      confidence: "medium",
      coverage: "medium",
      freshness: aging,
    });
    expect(msg).toContain("Attribution entité ET patterns comportementaux");
    expect(msg.startsWith("Analyse de moins de 24h.")).toBe(true);
  });

  it("WALLET + low coverage gets a partial-data disclaimer", () => {
    const msg = generateDisclaimer({
      subjectType: "WALLET",
      dominantDriver: "BEHAVIORAL",
      confidence: "low",
      coverage: "low",
      freshness: fresh,
    });
    expect(msg).toContain("Données partielles");
  });

  it("TOKEN + BEHAVIORAL + high confidence → token pattern copy + stale prefix", () => {
    const msg = generateDisclaimer({
      subjectType: "TOKEN",
      dominantDriver: "BEHAVIORAL",
      confidence: "high",
      coverage: "medium",
      freshness: stale,
    });
    expect(msg.startsWith("Analyse datant de plus de 24h.")).toBe(true);
    expect(msg).toContain("Patterns de manipulation détectés sur ce token");
  });

  it("TOKEN + REGISTRY driver → attributed-wallets copy", () => {
    const msg = generateDisclaimer({
      subjectType: "TOKEN",
      dominantDriver: "REGISTRY",
      confidence: "medium",
      coverage: "high",
      freshness: fresh,
    });
    expect(msg).toContain("wallets actifs sur ce token sont attribués");
  });

  it("TOKEN fallback when no dominant driver or coverage issue", () => {
    const msg = generateDisclaimer({
      subjectType: "TOKEN",
      dominantDriver: "NONE",
      confidence: "low",
      coverage: "high",
      freshness: fresh,
    });
    expect(msg).toContain("Aucun pattern significatif détecté");
  });
});
