// ─────────────────────────────────────────────────────────────────────────────
// Invariant de couverture d'un run d'ingestion.
//
// L'audit du 2026-08-26 a dû reconstituer la couverture À LA MAIN — récupérer
// le snapshot source, rejouer la normalisation et la déduplication, comparer
// les ensembles — parce que le run ne disait pas s'il avait tout parcouru.
// `recordsFetched` compte ce qui a été REÇU, pas ce qui a été TRAVERSÉ : entre
// les deux il y a la déduplication, et le silencieux `if (!entityId) continue`
// qui laisse tomber une ligne dont l'identifiant n'est pas revenu.
//
// Le run publie désormais son propre invariant :
//   expectedCount  population après normalisation ET déduplication
//   processedCount population réellement soumise aux upserts
//   coveragePct    processed / expected
//   completed      VRAI seulement si couverture pleine ET statut terminal sain
//
// `completed` est une conjonction : une couverture pleine sur un run qui a
// échoué ne vaut rien, et un run réussi qui a sauté des lignes non plus.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prisma: Record<string, any> = {
    intelIngestionBatch: { create: vi.fn(), update: vi.fn() },
    canonicalEntity: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    sourceObservation: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    intelAuditLog: { create: vi.fn() },
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  prisma.$transaction = vi.fn(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (p: unknown) => unknown)(prisma)
  );
  return { prisma };
});

vi.mock("../sources/scamsniffer", () => ({ fetchScamSniffer: vi.fn() }));

import { ingestSource } from "../ingest";
import { prisma } from "@/lib/prisma";
import { fetchScamSniffer } from "../sources/scamsniffer";
import { buildDedupKey } from "../normalize";

const rawQuery = () => prisma.$queryRawUnsafe as unknown as Mock;
const rawExec = () => prisma.$executeRawUnsafe as unknown as Mock;
const batchUpdate = () => prisma.intelIngestionBatch.update as unknown as Mock;
const auditCreate = () => prisma.intelAuditLog.create as unknown as Mock;

const valeur = (i: number) => `phish-${i}.example`;

function livraison(n: number, doublons = 0) {
  const idx = [
    ...Array.from({ length: n }, (_, i) => i),
    ...Array.from({ length: doublons }, (_, i) => i),
  ];
  (fetchScamSniffer as unknown as Mock).mockResolvedValue(
    idx.map((i) => ({
      sourceSlug: "scamsniffer",
      sourceTier: 2,
      entityType: "DOMAIN" as const,
      value: valeur(i),
      riskClass: "HIGH" as const,
      matchBasis: "EXACT_DOMAIN" as const,
      label: "phishing",
      externalUrl: `https://scamsniffer.io/${i}`,
    }))
  );
}

/** L'upsert d'entités ne rend QUE les `indices` demandés. */
function entitesRendues(indices: number[]) {
  rawQuery().mockResolvedValue(
    indices.map((i) => ({ id: `ent_${i}`, dedupKey: buildDedupKey("DOMAIN", valeur(i)) }))
  );
}

function finalisation() {
  const calls = batchUpdate().mock.calls;
  return calls[calls.length - 1][0].data as Record<string, unknown>;
}
function auditIngest() {
  const c = auditCreate().mock.calls.find((x) => (x[0] as any).data.action === "ingest.completed");
  return (c?.[0] as any)?.data?.detail as Record<string, unknown> | undefined;
}

describe("invariant de couverture d'un run", () => {
  let warn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([]);
    (prisma.sourceObservation.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    rawExec().mockResolvedValue(0);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {}) as unknown as Mock;
  });

  it("couverture PLEINE — completed=true, 100 %, statut success, aucune alerte", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    const res = await ingestSource("scamsniffer", "test");

    expect(res.expectedCount).toBe(600);
    expect(res.processedCount).toBe(600);
    expect(res.coveragePct).toBe(100);
    expect(res.completed).toBe(true);
    expect(res.status).toBe("success");
    expect(warn).not.toHaveBeenCalled();
  });

  it("expectedCount est la population APRÈS dédup, pas les entrées reçues", async () => {
    livraison(600, 600); // 1200 reçues, 600 uniques

    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsFetched).toBe(1200);
    expect(res.expectedCount).toBe(600);
    expect(res.coveragePct).toBe(100);
    expect(res.completed).toBe(true);
  });

  it("couverture INCOMPLÈTE — completed=false, statut dégradé, alerte émise", async () => {
    livraison(600);
    // 3 identifiants ne reviennent pas : 3 lignes tombent silencieusement.
    entitesRendues(Array.from({ length: 600 }, (_, i) => i).filter((i) => i > 2));

    const res = await ingestSource("scamsniffer", "test");

    expect(res.expectedCount).toBe(600);
    expect(res.processedCount).toBe(597);
    expect(res.coveragePct).toBe(99.5);
    expect(res.completed).toBe(false);
    expect(res.status).toBe("partial");

    expect(warn).toHaveBeenCalled();
    const msg = warn.mock.calls.map((c) => c.join(" ")).join(" | ");
    expect(msg).toContain("couverture");
    expect(msg).toContain("597");
    expect(msg).toContain("600");
  });

  it("l'invariant est écrit dans le batch ET dans le journal d'audit", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i).filter((i) => i > 2));

    await ingestSource("scamsniffer", "test");

    expect(finalisation().status).toBe("partial");

    const d = auditIngest()!;
    expect(d.expected).toBe(600);
    expect(d.processed).toBe(597);
    expect(d.coveragePct).toBe(99.5);
    expect(d.completed).toBe(false);
  });

  it("statut terminal NON SAIN — completed=false même si tout a été parcouru", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));
    // L'échec survient APRÈS les upserts, dans la réconciliation stale : la
    // couverture est pleine, mais le run n'a pas abouti. `completed` doit
    // rester faux — c'est le sens de la conjonction.
    (prisma.$transaction as Mock).mockRejectedValueOnce(new Error("Neon indisponible"));

    const res = await ingestSource("scamsniffer", "test");

    expect(res.status).not.toBe("success");
    expect(res.processedCount).toBe(600);
    expect(res.expectedCount).toBe(600);
    expect(res.coveragePct).toBe(100);
    expect(res.completed).toBe(false);
  });

  it("échec AVANT tout parcours — couverture nulle, completed=false", async () => {
    (fetchScamSniffer as unknown as Mock).mockRejectedValue(new Error("source injoignable"));

    const res = await ingestSource("scamsniffer", "test");

    expect(res.status).toBe("failed");
    expect(res.completed).toBe(false);
    expect(res.expectedCount).toBe(0);
    expect(res.processedCount).toBe(0);
  });

  it("source vide — 0 sur 0 n'est pas une couverture nulle", async () => {
    (fetchScamSniffer as unknown as Mock).mockResolvedValue([]);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.expectedCount).toBe(0);
    expect(res.processedCount).toBe(0);
    expect(res.coveragePct).toBe(100);
    expect(res.completed).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("chemin PRISMA (< 500) — l'invariant vaut aussi là", async () => {
    livraison(10);
    (prisma.canonicalEntity.findMany as Mock).mockResolvedValue([]);
    (prisma.canonicalEntity.create as Mock).mockResolvedValue({});

    const res = await ingestSource("scamsniffer", "test");

    expect(res.expectedCount).toBe(10);
    expect(res.processedCount).toBe(10);
    expect(res.coveragePct).toBe(100);
    expect(res.completed).toBe(true);
  });

  it("NON-RÉGRESSION — les compteurs existants ne bougent pas", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));
    rawExec().mockImplementation(async (sql: string) =>
      sql.includes("INSERT INTO") && sql.includes("intel_source_observations") ? 4 : 0
    );

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsFetched).toBe(600);
    expect(res.recordsAffected).toBe(4);
    expect(res.recordsUnchanged).toBe(596);
    expect(res.recordsNew).toBeNull();
    expect(res.recordsUpdated).toBeNull();
    // La réconciliation a tourné sans rien trouver : 0, pas NULL.
    expect(res.recordsRemoved).toBe(0);
  });
});
