// ─────────────────────────────────────────────────────────────────────────────
// Amplification d'écriture des deux `ON CONFLICT DO UPDATE` de bulkUpsert.
//
// Sans garde, chaque run réécrit TOUTES les lignes reçues, même identiques :
// ~340 000 UPDATE par cycle ScamSniffer pour, en régime stationnaire, zéro
// changement de contenu. Coût en WAL, en bloat, en autovacuum — pour rien.
//
// La garde `WHERE (…) IS DISTINCT FROM (EXCLUDED.…)` ne laisse passer
// l'UPDATE que si une valeur de CONTENU diffère réellement. `IS DISTINCT FROM`
// et non `<>` : `<>` rend NULL dès qu'un opérande est NULL, donc NULL → valeur
// et valeur → NULL ne déclencheraient PAS l'UPDATE. C'est le piège de ce
// correctif, et la sémantique de PostgreSQL est vérifiée séparément, sur le
// moteur réel (voir le rapport §5 — table de vérité exécutée en READ ONLY).
//
// Ce fichier vérifie ce qu'un test unitaire PEUT prouver sans base : la forme
// du SQL émis, la liste des colonnes du SET, l'intégrité des compteurs et la
// non-régression de recordsRemoved. Le gain réel se mesure sur un cycle réel.
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

/** bulkUpsert n'est emprunté qu'au-delà de 500 enregistrements. */
function livraison(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({
    sourceSlug: "scamsniffer",
    sourceTier: 2,
    entityType: "DOMAIN" as const,
    value: `phish-${i}.example`,
    chain: undefined,
    riskClass: "HIGH" as const,
    matchBasis: "EXACT_DOMAIN" as const,
    label: "phishing",
    externalUrl: `https://scamsniffer.io/${i}`,
  }));
  (fetchScamSniffer as unknown as Mock).mockResolvedValue(rows);
  return rows;
}

/**
 * Depuis la réduction des allers-retours, l'upsert d'entités rend lui-même les
 * couples (id, dedupKey) : plus de `findMany` intermédiaire.
 */
function entitesRelues(n: number) {
  rawQuery().mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      id: `ent_${i}`,
      dedupKey: buildDedupKey("DOMAIN", `phish-${i}.example`),
    }))
  );
}

const sqlEntites = () =>
  rawQuery().mock.calls.map((c) => c[0] as string).find((s) => s.includes("intel_canonical_entities"));
const sqlObs = () =>
  rawExec().mock.calls.map((c) => c[0] as string).find((s) => s.includes("intel_source_observations") && s.includes("ON CONFLICT"));

/** Le fragment qui suit `DO UPDATE SET`, garde comprise. */
function clauseUpdate(sql: string | undefined): string {
  if (!sql) return "";
  return sql.slice(sql.indexOf("DO UPDATE SET"));
}

describe("bulkUpsert — les ON CONFLICT ne réécrivent que ce qui change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.sourceObservation.findMany as Mock).mockResolvedValue([]);
    (prisma.sourceObservation.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    rawExec().mockResolvedValue(0);
  });

  it("l'upsert ENTITÉS porte une garde IS DISTINCT FROM", async () => {
    livraison(501);
    entitesRelues(501);

    await ingestSource("scamsniffer", "test");

    const clause = clauseUpdate(sqlEntites());
    expect(clause).toContain("WHERE");
    expect(clause).toContain("IS DISTINCT FROM");
    expect(clause).toContain("EXCLUDED");
  });

  it("l'upsert OBSERVATIONS porte une garde IS DISTINCT FROM", async () => {
    livraison(501);
    entitesRelues(501);

    await ingestSource("scamsniffer", "test");

    const clause = clauseUpdate(sqlObs());
    expect(clause).toContain("WHERE");
    expect(clause).toContain("IS DISTINCT FROM");
    expect(clause).toContain("EXCLUDED");
  });

  it("la garde OBSERVATIONS couvre les 5 colonnes de contenu, et elles seules", async () => {
    livraison(501);
    entitesRelues(501);

    await ingestSource("scamsniffer", "test");

    const clause = clauseUpdate(sqlObs());
    const garde = clause.slice(clause.indexOf("WHERE"));
    for (const col of ['"riskClass"', "label", '"matchBasis"', '"externalUrl"', '"listIsActive"']) {
      expect(garde).toContain(col);
    }
    // Les horodatages de battement ne doivent PAS entrer dans la comparaison :
    // ils valent now() à chaque run et rendraient la garde toujours vraie.
    expect(garde).not.toContain("lastVerifiedAt");
    expect(garde).not.toContain("ingestedAt");
  });

  it("la garde ENTITÉS ne compare pas les horodatages de battement", async () => {
    livraison(501);
    entitesRelues(501);

    await ingestSource("scamsniffer", "test");

    const clause = clauseUpdate(sqlEntites());
    const garde = clause.slice(clause.indexOf("WHERE"));
    expect(garde).toContain('"isActive"');
    expect(garde).not.toContain("lastSeenAt");
    expect(garde).not.toContain("updatedAt");
  });

  it("NON-RÉGRESSION — les colonnes ÉCRITES par le SET sont inchangées", async () => {
    livraison(501);
    entitesRelues(501);

    await ingestSource("scamsniffer", "test");

    const setEnt = clauseUpdate(sqlEntites());
    const setEnt2 = setEnt.slice(0, setEnt.indexOf("WHERE"));
    expect(setEnt2).toContain('"lastSeenAt"');
    expect(setEnt2).toContain('"isActive"');
    expect(setEnt2).toContain('"updatedAt"');

    const setObs = clauseUpdate(sqlObs());
    const setObs2 = setObs.slice(0, setObs.indexOf("WHERE"));
    for (const col of ['"riskClass"', "label", '"matchBasis"', '"externalUrl"', '"listIsActive"', '"lastVerifiedAt"']) {
      expect(setObs2).toContain(col);
    }
  });

  it("NON-RÉGRESSION — compteurs et valeur de retour inchangés", async () => {
    livraison(501);
    entitesRelues(501);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.status).toBe("success");
    expect(res.recordsFetched).toBe(501);
    expect(res.recordsRemoved).toBe(0);
    // `recordsNew` valait 501 ici, mais c'était le MENSONGE du chemin bulk :
    // `recordsNew += obsValues.length` comptait tout comme nouveau. Depuis
    // l'instrumentation honnête, ce chemin rend NULL (= inconnu), parce que
    // INSERT … ON CONFLICT ne sait pas distinguer insert et update.
    // Les compteurs mesurables sont couverts par ingestCountersHonest.test.ts.
    expect(res.recordsNew).toBeNull();
    expect(res.recordsUpdated).toBeNull();
  });

  it("NON-RÉGRESSION — la garde n'affecte pas la rétraction", async () => {
    // Le marquage stale par `findMany` + `notIn` a été remplacé par une
    // réconciliation par table temporaire, gardée par l'invariant de
    // couverture. Ce test suivait l'ancienne mécanique ; il suit désormais le
    // contrat : la garde IS DISTINCT FROM ne doit pas empêcher une radiation.
    livraison(501);
    entitesRelues(501);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.completed).toBe(true);
    expect(res.recordsRemoved).not.toBeNull();
    expect(prisma.sourceObservation.findMany as Mock).not.toHaveBeenCalled();
  });
});
