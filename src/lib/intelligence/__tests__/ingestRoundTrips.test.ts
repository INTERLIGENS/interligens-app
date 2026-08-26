// ─────────────────────────────────────────────────────────────────────────────
// Réduction des allers-retours Neon sur le chemin bulk.
//
// Avant : chunk de 500 et TROIS requêtes par chunk — upsert entités,
// `findMany` pour retrouver les id, upsert observations. Sur 275 000 lignes :
// 550 chunks × 3 = 1 650 allers-retours, soit ~250 s de latence pure avant
// tout travail utile. C'est ce qui tuait le cycle à maxDuration=300 s, PAS
// l'écriture — mesuré le 2026-08-26 : 206 lignes écrites, et pourtant coupé.
//
// Après : chunk de 5 000 et DEUX requêtes par chunk. Les id reviennent
// directement de l'upsert d'entités.
//
// LE PIÈGE, et la raison de la forme CTE + UNION ALL : `RETURNING` sur un
// `ON CONFLICT` ne rend QUE les lignes réellement écrites. Or la garde
// `IS DISTINCT FROM` en écarte 99,93 % en régime stationnaire (mesuré :
// 206 écrites sur 275 000 soumises). Un `RETURNING` nu ferait donc perdre la
// quasi-totalité des id, et les observations seraient silencieusement
// abandonnées. Le CTE réunit les lignes écrites ET les lignes déjà présentes.
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

const execRaw = () => prisma.$executeRawUnsafe as unknown as Mock;
const queryRaw = () => prisma.$queryRawUnsafe as unknown as Mock;

const valeur = (i: number) => `phish-${i}.example`;
const dk = (i: number) => buildDedupKey("DOMAIN", valeur(i));

function livraison(n: number) {
  (fetchScamSniffer as unknown as Mock).mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
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

/**
 * L'upsert d'entités rend les couples (id, dedupKey) — dans un ORDRE
 * ARBITRAIRE, comme le ferait un vrai UNION ALL. Si le code appariait par
 * position au lieu d'apparier par dedupKey, les tests ci-dessous le verraient.
 */
function entitesRendues(indices: number[], melange = true) {
  const rows = indices.map((i) => ({ id: `ent_${i}`, dedupKey: dk(i) }));
  if (melange) rows.reverse();
  queryRaw().mockResolvedValue(rows);
}

const sqlObs = () =>
  execRaw().mock.calls.map((c) => c[0] as string).filter((s) => s.includes("intel_source_observations"));

describe("bulkUpsert — moins d'allers-retours, sémantique intacte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([]);
    (prisma.sourceObservation.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    execRaw().mockResolvedValue(0);
  });

  it("le findMany intermédiaire a DISPARU du chemin bulk", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    await ingestSource("scamsniffer", "test");

    expect(prisma.canonicalEntity.findMany as Mock).not.toHaveBeenCalled();
  });

  it("chunk de 5 000 : 600 lignes → UN seul chunk, DEUX requêtes", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    await ingestSource("scamsniffer", "test");

    expect(queryRaw()).toHaveBeenCalledOnce();   // upsert entités + id
    expect(sqlObs()).toHaveLength(1);            // upsert observations
  });

  it("chunk de 5 000 : 5 001 lignes → DEUX chunks", async () => {
    livraison(5001);
    entitesRendues(Array.from({ length: 5001 }, (_, i) => i));

    await ingestSource("scamsniffer", "test");

    expect(queryRaw()).toHaveBeenCalledTimes(2);
    expect(sqlObs()).toHaveLength(2);
  });

  it("RETURNING — l'appariement id ↔ value se fait par dedupKey, pas par position", async () => {
    // > 500 lignes uniques : c'est la condition d'entrée du chemin bulk.
    livraison(600);
    // Rendu dans l'ordre INVERSE : un appariement positionnel donnerait
    // ent_599 à phish-0, et le test le verrait.
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    await ingestSource("scamsniffer", "test");

    const sql = sqlObs()[0];
    for (const i of [0, 1, 42, 599]) {
      const idx = sql.indexOf(`'ent_${i}', 'scamsniffer'`);
      expect(idx).toBeGreaterThan(-1);
      const fin = sql.indexOf(")", idx);
      // Le tuple qui porte ent_i doit porter l'URL de l'index i, et pas une autre.
      expect(sql.slice(idx, fin)).toContain(`scamsniffer.io/${i}'`);
    }
  });

  it("une entité absente du RETURNING ne produit PAS d'observation orpheline", async () => {
    livraison(600);
    // L'index 1 manque : l'upsert d'entités ne l'a pas rendu.
    entitesRendues(Array.from({ length: 600 }, (_, i) => i).filter((i) => i !== 1));

    await ingestSource("scamsniffer", "test");

    const sql = sqlObs()[0];
    expect(sql).toContain("'ent_0', 'scamsniffer'");
    expect(sql).toContain("'ent_2', 'scamsniffer'");
    expect(sql).not.toContain("'ent_1', 'scamsniffer'");
    expect(sql).not.toContain("scamsniffer.io/1'");
  });

  it("NON-RÉGRESSION — recordsAffected / recordsUnchanged sur la population soumise", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));
    execRaw().mockImplementation(async (sql: string) =>
      sql.includes("intel_source_observations") ? 7 : 0
    );

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsAffected).toBe(7);
    expect(res.recordsUnchanged).toBe(593);
    expect(res.recordsNew).toBeNull();
    expect(res.recordsUpdated).toBeNull();
  });

  it("NON-RÉGRESSION — dédup : les doublons ne produisent qu'une ligne", async () => {
    // 600 valeurs uniques livrées DEUX fois = 1200 reçues, 600 soumises.
    const indices = [
      ...Array.from({ length: 600 }, (_, i) => i),
      ...Array.from({ length: 600 }, (_, i) => i),
    ];
    (fetchScamSniffer as unknown as Mock).mockResolvedValue(
      indices.map((i) => ({
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
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    const res = await ingestSource("scamsniffer", "test");

    // 1200 reçues, 600 uniques soumises : la dédup précède l'upsert.
    expect(res.recordsFetched).toBe(1200);
    expect(res.recordsUnchanged).toBe(600);
    const sql = sqlObs()[0];
    expect(sql.match(/'scamsniffer', 2,/g) ?? []).toHaveLength(600);
  });

  it("NON-RÉGRESSION — sémantique de recordsRemoved intacte", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsRemoved).toBe(2);
    const critere = (prisma.sourceObservation.findMany as Mock).mock.calls[0][0];
    expect(critere.where.entity.value.notIn).toHaveLength(600);
    expect(JSON.stringify(critere.where)).not.toContain("lastVerifiedAt");
  });

  it("l'upsert d'entités réunit les lignes écrites ET celles déjà présentes", async () => {
    livraison(600);
    entitesRendues(Array.from({ length: 600 }, (_, i) => i));

    await ingestSource("scamsniffer", "test");

    const sql = queryRaw().mock.calls[0][0] as string;
    expect(sql).toContain("RETURNING");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("IS DISTINCT FROM");
  });
});
