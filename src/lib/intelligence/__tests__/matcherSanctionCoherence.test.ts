// ─────────────────────────────────────────────────────────────────────────────
// P0-B2 — Cohérence SANCTION : `topRiskClass` ne peut pas affirmer une sanction
// qu'aucune observation ACTIVE ne soutient.
//
// Cas reproduit : 0xa5b0edf6b55128e0ddae8e51ac538c3188401d41, mesuré en
// production le 2026-08-25 sur ep-square-band. L'entité porte
// riskClass='SANCTION' et deux observations : une `ofac` SANCTION tier 1
// AVEC listIsActive=false, et une `forta` HIGH tier 2 active. `matchEntity`
// ne charge que les observations actives — la ligne ofac est donc exclue du
// compte et de `hasSanction` — mais lisait `topRiskClass` sur `entity.riskClass`,
// figé à SANCTION. La surface publique renvoyait donc, littéralement :
//   {"hasSanction":false, ..., "topRiskClass":"SANCTION"}
// soit le mot « SANCTION » sans aucune observation active pour le porter.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { canonicalEntity: { findUnique: vi.fn() } },
}));

import { matchEntity } from "../matcher";
import { prisma } from "@/lib/prisma";

/** `matchEntity` inclut `observations: { where: { listIsActive: true } }` :
 *  le mock rend donc UNIQUEMENT les observations actives, comme Prisma. */
function entityWith(riskClass: string, activeObservations: unknown[]) {
  return {
    id: "e1",
    type: "ADDRESS",
    value: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    riskClass,
    observations: activeObservations,
  };
}

const obsFortaHigh = {
  id: "o-forta",
  sourceSlug: "forta",
  sourceTier: 2,
  riskClass: "HIGH",
  matchBasis: "INFERRED_LINKAGE",
  listIsActive: true,
  externalUrl: null,
  observedAt: null,
  ingestedAt: new Date("2026-04-08T18:58:32.595Z"),
};

const obsOfacSanctionActive = {
  id: "o-ofac",
  sourceSlug: "ofac",
  sourceTier: 1,
  riskClass: "SANCTION",
  matchBasis: "EXACT_ADDRESS",
  listIsActive: true,
  externalUrl: "https://sanctionssearch.ofac.treas.gov/",
  observedAt: null,
  ingestedAt: new Date("2026-08-25T01:03:16Z"),
};

describe("P0-B2 — topRiskClass ne peut pas inventer une SANCTION", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reproduit 0xa5b0edf6…01d41 : entité SANCTION, seule obs ACTIVE = forta HIGH → pas de SANCTION rendue", async () => {
    vi.mocked(prisma.canonicalEntity.findUnique).mockResolvedValue(
      entityWith("SANCTION", [obsFortaHigh]) as never
    );

    const signal = await matchEntity({
      type: "ADDRESS",
      value: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    });

    // L'état d'aujourd'hui, celui qui a été servi publiquement :
    expect(signal.hasSanction).toBe(false);
    expect(signal.matchCount).toBe(1);

    // Ce que le patch doit garantir : aucune sanction affirmée sans porteur actif.
    expect(signal.topRiskClass).not.toBe("SANCTION");
    expect(signal.topRiskClass).toBe("HIGH");
  });

  it("une SANCTION réellement ACTIVE reste rendue — pas de sur-correction", async () => {
    vi.mocked(prisma.canonicalEntity.findUnique).mockResolvedValue(
      entityWith("SANCTION", [obsOfacSanctionActive, obsFortaHigh]) as never
    );

    const signal = await matchEntity({
      type: "ADDRESS",
      value: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    });

    expect(signal.hasSanction).toBe(true);
    expect(signal.topRiskClass).toBe("SANCTION");
  });

  it("hors SANCTION, le patch ne change rien : entité HIGH, obs active HIGH → HIGH", async () => {
    vi.mocked(prisma.canonicalEntity.findUnique).mockResolvedValue(
      entityWith("HIGH", [obsFortaHigh]) as never
    );

    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" });
    expect(signal.topRiskClass).toBe("HIGH");
  });

  it("entité SANCTION sans AUCUNE observation active → aucun match, aucune sanction", async () => {
    vi.mocked(prisma.canonicalEntity.findUnique).mockResolvedValue(
      entityWith("SANCTION", []) as never
    );

    const signal = await matchEntity({ type: "ADDRESS", value: "0xdead" });
    expect(signal.matchCount).toBe(0);
    expect(signal.topRiskClass).toBeNull();
    expect(signal.hasSanction).toBe(false);
  });
});
