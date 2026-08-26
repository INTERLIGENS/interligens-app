// ─────────────────────────────────────────────────────────────────────────────
// Instrumentation HONNÊTE de l'ingestion.
//
// Le chemin `bulkUpsert` comptait `recordsNew += obsValues.length` : TOUT
// était compté comme nouveau, et `recordsUpdated` restait à 0. Le compteur
// mentait, avant comme après la garde IS DISTINCT FROM.
//
// `INSERT … ON CONFLICT` ne permet PAS de distinguer proprement les lignes
// insérées des lignes mises à jour : le seul procédé connu, `RETURNING
// xmax = 0`, est un détail d'implémentation non contractuel. On ne remplace
// donc pas un mensonge par un autre — sur ce chemin, `recordsNew` et
// `recordsUpdated` valent NULL (= inconnu), et on publie ce qui est mesurable :
//
//   recordsAffected  = lignes réellement écrites par l'upsert d'observations
//                      (retour de $executeRawUnsafe : inserts + updates)
//   recordsUnchanged = lignes soumises mais NON écrites, écartées par la garde
//                      = soumises - affectées, sur la MÊME population dédupliquée
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

const rawExec = () => prisma.$executeRawUnsafe as unknown as Mock;
const rawQuery = () => prisma.$queryRawUnsafe as unknown as Mock;

function livraison(n: number) {
  (fetchScamSniffer as unknown as Mock).mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      sourceSlug: "scamsniffer",
      sourceTier: 2,
      entityType: "DOMAIN" as const,
      value: `phish-${i}.example`,
      riskClass: "HIGH" as const,
      matchBasis: "EXACT_DOMAIN" as const,
      label: "phishing",
      externalUrl: `https://scamsniffer.io/${i}`,
    }))
  );
}

function entitesRelues(n: number) {
  rawQuery().mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      id: `ent_${i}`,
      dedupKey: buildDedupKey("DOMAIN", `phish-${i}.example`),
    }))
  );
}

/**
 * Le moteur écrit `parAppelObs` lignes sur CHAQUE appel d'upsert d'observations
 * (un par lot). Depuis le lot de 5 000, 501 enregistrements tiennent en UN lot ;
 * la signature variadique reste pour couvrir l'accumulation multi-lots.
 */
function moteurEcrit(...parAppelObs: number[]) {
  let i = 0;
  rawExec().mockImplementation(async (sql: string) =>
    sql.includes("intel_source_observations") ? (parAppelObs[i++] ?? 0) : 0
  );
}

const batchUpdate = () => prisma.intelIngestionBatch.update as unknown as Mock;
const auditCreate = () => prisma.intelAuditLog.create as unknown as Mock;

/** Le dernier `update` du batch est la finalisation. */
function finalisation() {
  const calls = batchUpdate().mock.calls;
  return calls[calls.length - 1][0].data as Record<string, unknown>;
}

function auditIngest() {
  const c = auditCreate().mock.calls.find(
    (x) => (x[0] as any).data.action === "ingest.completed"
  );
  return (c?.[0] as any).data.detail as Record<string, unknown>;
}

describe("ingest — compteurs honnêtes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([]);
    (prisma.sourceObservation.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    rawExec().mockResolvedValue(0);
  });

  it("chemin BULK — recordsNew et recordsUpdated valent NULL, pas un chiffre inventé", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsNew).toBeNull();
    expect(res.recordsUpdated).toBeNull();
    expect(finalisation().recordsNew).toBeNull();
    expect(finalisation().recordsUpdated).toBeNull();
  });

  it("chemin BULK — recordsAffected = lignes réellement écrites", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsAffected).toBe(12);
  });

  it("chemin BULK — recordsUnchanged = soumises - affectées, sur la population dédupliquée", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);

    const res = await ingestSource("scamsniffer", "test");

    // 501 observations soumises, 12 écrites → 489 écartées par la garde.
    expect(res.recordsUnchanged).toBe(489);
    expect(res.recordsAffected! + res.recordsUnchanged!).toBe(501);
  });

  it("régime stationnaire — 0 ligne écrite, tout est inchangé", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(0);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsAffected).toBe(0);
    expect(res.recordsUnchanged).toBe(501);
  });

  it("le journal d'audit publie les deux compteurs mesurables", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);

    await ingestSource("scamsniffer", "test");

    const d = auditIngest();
    expect(d.affected).toBe(12);
    expect(d.unchanged).toBe(489);
    expect(d.new).toBeNull();
    expect(d.updated).toBeNull();
  });

  it("recordsFetched reste le nombre d'entrées REÇUES, avant dédup", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsFetched).toBe(501);
    // Et il n'est PAS utilisé pour calculer recordsUnchanged : la soustraction
    // se fait sur la population soumise à l'upsert, après dédup.
    expect(res.recordsUnchanged).toBe(489);
  });

  it("chemin PRISMA (< 500) — recordsNew/recordsUpdated restent des CHIFFRES, ils sont connus", async () => {
    livraison(10);
    (prisma.canonicalEntity.findMany as Mock).mockResolvedValue([]);
    (prisma.canonicalEntity.create as Mock).mockResolvedValue({});

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsNew).toBe(10);
    expect(res.recordsUpdated).toBe(0);
    // Ce chemin n'a aucune garde : toute ligne soumise est écrite.
    expect(res.recordsUnchanged).toBe(0);
    expect(res.recordsAffected).toBe(10);
  });

  it("NON-RÉGRESSION — recordsRemoved intact sur le chemin bulk", async () => {
    livraison(501);
    entitesRelues(501);
    moteurEcrit(12);
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsRemoved).toBe(2);
    expect(finalisation().recordsRemoved).toBe(2);
  });
});
