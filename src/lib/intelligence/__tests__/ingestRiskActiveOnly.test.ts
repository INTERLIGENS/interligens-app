// ─────────────────────────────────────────────────────────────────────────────
// Le résumé `entity.riskClass` ne doit refléter QUE les observations ACTIVES.
//
// Défaut reproduit : `prismaUpsert` chargeait les observations existantes SANS
// filtre (`ingest.ts:337` — `select: { riskClass, sourceSlug }`, aucun `where`)
// puis pliait `strongerRisk()` sur TOUTES. Une observation radiée d'une liste
// — `listIsActive = false`, cas normal d'une sortie de liste OFAC — continuait
// donc de tirer le résumé vers le haut, à perpétuité.
//
// Constaté en production le 2026-08-26 sur
// 0xa5b0edf6b55128e0ddae8e51ac538c3188401d41 : `riskClass = SANCTION` alors que
// son unique observation `ofac` porte `listIsActive = false` et
// `removedAt = 2026-08-15T01:20:34Z`, et que la seule observation active est un
// `forta` HIGH. C'est la CAUSE ; la donnée est corrigée séparément.
//
// Le mock de `findMany` applique le `where` des observations comme Prisma le
// ferait. Sans cela, le test ne pourrait pas distinguer « le code filtre » de
// « le mock rend déjà des données filtrées ».
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prisma: Record<string, any> = {
    intelIngestionBatch: { create: vi.fn(), update: vi.fn() },
    canonicalEntity: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    sourceObservation: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    intelAuditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (p: unknown) => unknown)(prisma)
  );
  return { prisma };
});

vi.mock("../sources/forta", () => ({ fetchForta: vi.fn() }));

import { ingestSource } from "../ingest";
import { prisma } from "@/lib/prisma";
import { fetchForta } from "../sources/forta";
import { buildDedupKey } from "../normalize";

const CIBLE = "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41";
// La clé doit être la VRAIE : `prismaUpsert` retrouve l'entité existante par
// dedupKey. Une clé bidon enverrait le test dans la branche « création ».
const DEDUP = buildDedupKey("ADDRESS", CIBLE);

const entityFindMany = () => prisma.canonicalEntity.findMany as unknown as Mock;
const entityUpdate = () => prisma.canonicalEntity.update as unknown as Mock;

/** Observation telle que stockée. `listIsActive` porte la radiation. */
function obs(sourceSlug: string, riskClass: string, listIsActive: boolean) {
  return { sourceSlug, riskClass, listIsActive };
}

/**
 * Installe une entité existante et ses observations.
 * `findMany` se comporte comme Prisma : si l'appelant demande
 * `include.observations.where.listIsActive`, le mock filtre.
 */
function existingEntity(observations: ReturnType<typeof obs>[]) {
  entityFindMany().mockImplementation(async (args: any) => {
    const where = args?.include?.observations?.where;
    const visibles =
      where?.listIsActive === true
        ? observations.filter((o) => o.listIsActive)
        : observations;
    return [
      {
        id: "ent_1",
        dedupKey: DEDUP,
        value: CIBLE,
        type: "ADDRESS",
        riskClass: "SANCTION",
        strongestSource: "ofac",
        sourceCount: observations.length,
        observations: visibles,
      },
    ];
  });
}

/** Ce que la source re-livre pour cette entité. */
function livraison(riskClass: string) {
  (fetchForta as unknown as Mock).mockResolvedValue([
    {
      sourceSlug: "forta",
      sourceTier: 2,
      entityType: "ADDRESS",
      value: CIBLE,
      chain: "ethereum",
      riskClass,
      matchBasis: "EXACT_ADDRESS",
      label: "scammer_eoa",
      externalUrl: `https://explorer.forta.network/address/${CIBLE}`,
      meta: { confidence: 0.9, fortaLabel: "scammer_eoa" },
    },
  ]);
}

/** Le `riskClass` réellement écrit sur l'entité. */
function riskEcrit(): string | undefined {
  const call = entityUpdate().mock.calls.at(0);
  return call?.[0]?.data?.riskClass;
}

function sourceCountEcrit(): number | undefined {
  return entityUpdate().mock.calls.at(0)?.[0]?.data?.sourceCount;
}

describe("ingest — riskClass ne doit refléter que les observations ACTIVES", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([]);
    (prisma.sourceObservation.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.sourceObservation.update as Mock).mockResolvedValue({});
    (prisma.canonicalEntity.update as Mock).mockResolvedValue({});
    (prisma.canonicalEntity.create as Mock).mockResolvedValue({});
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
  });

  it("RÉGRESSION — une SANCTION RADIÉE ne tire plus le résumé : SANCTION(off) + HIGH(on) → HIGH", async () => {
    existingEntity([obs("ofac", "SANCTION", false), obs("forta", "HIGH", true)]);
    livraison("HIGH");

    await ingestSource("forta", "test");

    expect(entityUpdate()).toHaveBeenCalled();
    expect(riskEcrit()).toBe("HIGH");
    expect(riskEcrit()).not.toBe("SANCTION");
  });

  it("une SANCTION ENCORE ACTIVE continue de primer — pas de sur-correction", async () => {
    existingEntity([obs("ofac", "SANCTION", true), obs("forta", "HIGH", true)]);
    livraison("HIGH");

    await ingestSource("forta", "test");

    expect(riskEcrit()).toBe("SANCTION");
  });

  it("toutes les observations radiées → seule la livraison du jour compte", async () => {
    existingEntity([obs("ofac", "SANCTION", false), obs("amf", "HIGH", false)]);
    livraison("LOW");

    await ingestSource("forta", "test");

    expect(riskEcrit()).toBe("LOW");
  });

  it("plusieurs radiées, une active MEDIUM → MEDIUM l'emporte sur la livraison LOW", async () => {
    existingEntity([
      obs("ofac", "SANCTION", false),
      obs("fca", "HIGH", false),
      obs("scamsniffer", "MEDIUM", true),
    ]);
    livraison("LOW");

    await ingestSource("forta", "test");

    expect(riskEcrit()).toBe("MEDIUM");
  });

  it("NON-RÉGRESSION — sourceCount ne dérive pas quand la source re-livre après radiation", async () => {
    // L'observation forta a été radiée ; forta la re-livre. L'upsert
    // d'observation est unique sur (entityId, sourceSlug) : il RÉACTIVE la
    // ligne, il n'en crée pas une seconde. sourceCount ne doit donc PAS
    // s'incrémenter — c'est le piège d'un filtre posé trop haut, sur la
    // requête, plutôt qu'au seul endroit où le risque est calculé.
    existingEntity([obs("forta", "HIGH", false), obs("ofac", "SANCTION", false)]);
    livraison("HIGH");

    await ingestSource("forta", "test");

    expect(sourceCountEcrit()).toBe(2);
  });
});
