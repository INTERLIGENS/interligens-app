import { describe, it, expect } from "vitest";
import { SEED_ENTITIES, SEED_SOURCES } from "@/lib/mm/registry/seedData";

describe("SEED_ENTITIES", () => {
  it("seeds exactly 4 entities", () => {
    expect(SEED_ENTITIES).toHaveLength(4);
  });

  it("contains the 3 Tier S+ (CONVICTED) and 1 Tier S (CHARGED)", () => {
    const convicted = SEED_ENTITIES.filter((e) => e.status === "CONVICTED").map(
      (e) => e.slug,
    );
    const charged = SEED_ENTITIES.filter((e) => e.status === "CHARGED").map(
      (e) => e.slug,
    );
    expect(convicted.sort()).toEqual(["cls-global", "gotbit", "mytrade"]);
    expect(charged).toEqual(["zm-quant"]);
  });

  it("every entity has at least one FACT claim", () => {
    for (const e of SEED_ENTITIES) {
      expect(e.claims.length, `entity ${e.slug}`).toBeGreaterThan(0);
      for (const c of e.claims) {
        expect(c.claimType, `${e.slug}:${c.sourceKey}`).toBe("FACT");
      }
    }
  });

  it("every claim references a known source key", () => {
    const sourceKeys = new Set(SEED_SOURCES.map((s) => s.key));
    for (const e of SEED_ENTITIES) {
      for (const c of e.claims) {
        expect(sourceKeys.has(c.sourceKey), `missing source ${c.sourceKey}`).toBe(true);
      }
    }
  });

  it("every source URL is https", () => {
    for (const s of SEED_SOURCES) {
      expect(s.url.startsWith("https://"), s.key).toBe(true);
    }
  });

  it("every source is Tier 1 (DOJ or SEC)", () => {
    for (const s of SEED_SOURCES) {
      expect(s.credibilityTier, s.key).toBe("TIER_1");
      expect(["DOJ", "SEC"]).toContain(s.sourceType);
    }
  });
});
