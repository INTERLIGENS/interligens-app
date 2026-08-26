// ─────────────────────────────────────────────────────────────────────────────
// Réconciliation stale — la rétraction, enfin, pour les grosses sources.
//
// L'audit du 2026-08-26 a mesuré : 0 observation ScamSniffer radiée sur
// 339 901, parce que le marquage était gardé par `if (unique.length < 10000)`.
// ScamSniffer en livre 339 889 : le marquage n'a JAMAIS tourné. Huit domaines
// retirés de la blacklist amont depuis avril portaient toujours
// listIsActive=true. Le `recordsRemoved = 0` des runs ne voulait pas dire
// « rien à retirer », il voulait dire « on n'a pas regardé ».
//
// LE DANGER, et c'est le cœur de ce chantier : réconcilier sur une livraison
// INCOMPLÈTE radierait en masse des entrées parfaitement valides. Un fetch
// tronqué à 10 % radierait 90 % du dataset. La réconciliation est donc couplée
// à l'invariant de couverture — elle ne tourne QUE sur un snapshot prouvé
// complet — et plafonnée : au-delà d'un seuil, elle refuse et alerte.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/prisma", () => {
  const tx: Record<string, any> = {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  const prisma: Record<string, any> = {
    intelIngestionBatch: { create: vi.fn(), update: vi.fn() },
    canonicalEntity: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    sourceObservation: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    intelAuditLog: { create: vi.fn() },
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    __tx: tx,
  };
  prisma.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(tx)
  );
  return { prisma };
});

vi.mock("../sources/scamsniffer", () => ({ fetchScamSniffer: vi.fn() }));

import { ingestSource } from "../ingest";
import { prisma } from "@/lib/prisma";
import { fetchScamSniffer } from "../sources/scamsniffer";
import { buildDedupKey } from "../normalize";

const tx = () => (prisma as any).__tx;
const txExec = () => tx().$executeRawUnsafe as Mock;
const txQuery = () => tx().$queryRawUnsafe as Mock;
const rawQuery = () => prisma.$queryRawUnsafe as unknown as Mock;
const rawExec = () => prisma.$executeRawUnsafe as unknown as Mock;

/** Les 8 domaines retirés de la blacklist amont, mesurés en production. */
const RADIES_AMONT = [
  "cryptopulse.top", "hype.what.exchange", "injective.network", "omar-thing.site",
  "portal.openeden.com", "quanttoken.org", "sorcery.finance", "terra-claim.com",
];

const val = (i: number) => `phish-${i}.example`;

/** Une livraison de n domaines — au-delà de 10 000 pour prouver que le gate est levé. */
function livraison(n: number) {
  (fetchScamSniffer as unknown as Mock).mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      sourceSlug: "scamsniffer", sourceTier: 2, entityType: "DOMAIN" as const,
      value: val(i), riskClass: "HIGH" as const, matchBasis: "EXACT_DOMAIN" as const,
      label: "phishing", externalUrl: `https://scamsniffer.io/${i}`,
    }))
  );
}

/** L'upsert d'entités rend `rendus` identifiants ; en rendre moins tronque la couverture. */
function entitesRendues(total: number, rendus = total) {
  rawQuery().mockResolvedValue(
    Array.from({ length: rendus }, (_, i) => ({ id: `ent_${i}`, dedupKey: buildDedupKey("DOMAIN", val(i)) }))
  );
}

/** Le moteur : `candidats` lignes à radier, puis des lots de `parLot`. */
function moteurReconciliation(candidats: number, actives = 20000, parLot = 5000) {
  txQuery().mockImplementation(async (sql: string) => {
    if (/count\(\*\)/i.test(sql) && /listIsActive/i.test(sql) && !/l\.dk IS NULL/i.test(sql)) {
      return [{ n: BigInt(actives) }];               // total actif de la source
    }
    return [{ n: BigInt(candidats) }];               // candidats à la radiation
  });
  let restant = candidats;
  txExec().mockImplementation(async (sql: string) => {
    if (/UPDATE/i.test(sql)) {
      const lot = Math.min(parLot, restant);
      restant -= lot;
      return lot;
    }
    return 0;                                        // CREATE TEMP / INSERT / ANALYZE
  });
}

const sqlTx = () => [...txExec().mock.calls, ...txQuery().mock.calls].map((c) => String(c[0]));

describe("réconciliation stale — le gate des 10 000 est levé", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    rawExec().mockResolvedValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("RUN SAIN — une source de 20 000 lignes réconcilie, et radie les candidats", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(8);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.completed).toBe(true);
    expect(res.recordsRemoved).toBe(8);
    // Le gate historique aurait sauté la réconciliation au-delà de 10 000.
    expect(sqlTx().join(" ")).toMatch(/TEMP TABLE/i);
  });

  it("RUN SAIN sans candidat — recordsRemoved vaut 0, pas NULL", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(0);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsRemoved).toBe(0);
    expect(res.completed).toBe(true);
  });

  it("l'anti-join ne passe PAS par un NOT IN sur 340k valeurs", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(3);

    await ingestSource("scamsniffer", "test");

    const sql = sqlTx().join(" ");
    expect(sql).toMatch(/LEFT JOIN|NOT EXISTS/i);
    expect(sql).not.toMatch(/NOT IN \(\s*'/i); // pas de littéraux inlinés en masse
  });

  it("la radiation est BATCHÉE — plusieurs UPDATE pour 12 000 candidats", async () => {
    livraison(20000);
    entitesRendues(20000);
    // 12 000 sur 3 000 000 actives = 0,4 % : sous le plafond. Avec 100 000
    // actives ce serait 12 %, et le plafond mordrait — à juste titre.
    moteurReconciliation(12000, 3000000, 5000);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsRemoved).toBe(12000);
    const updates = sqlTx().filter((s) => /UPDATE/i.test(s));
    expect(updates.length).toBeGreaterThan(1);
  });

  it("AUCUN DELETE — l'historique est préservé", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(8);

    await ingestSource("scamsniffer", "test");

    expect(prisma.sourceObservation.deleteMany as Mock).not.toHaveBeenCalled();
    expect(prisma.sourceObservation.delete as Mock).not.toHaveBeenCalled();
    expect(sqlTx().join(" ")).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
  });

  it("la radiation pose listIsActive=false ET removedAt", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(8);

    await ingestSource("scamsniffer", "test");

    const upd = sqlTx().find((s) => /UPDATE/i.test(s)) ?? "";
    expect(upd).toMatch(/"listIsActive"\s*=\s*false/i);
    expect(upd).toMatch(/"removedAt"/i);
  });
});

  it("LES 8 DOMAINES radiés amont passent listIsActive=false sur un run sain", async () => {
    // Les 8 mesurés en production le 2026-08-26 : retirés de la blacklist
    // ScamSniffer depuis avril, et pourtant toujours listIsActive=true parce
    // que le marquage stale n'avait jamais tourné pour cette source.
    livraison(20000);                       // la livraison du jour NE les contient pas
    entitesRendues(20000);
    moteurReconciliation(RADIES_AMONT.length);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.completed).toBe(true);
    expect(res.recordsRemoved).toBe(8);
    expect(RADIES_AMONT).toHaveLength(8);

    // Ce sont bien des candidats de l'anti-join : absents de la livraison,
    // actifs en base, et de la bonne source.
    const anti = sqlTx().find((s) => /l\.dk IS NULL/i.test(s)) ?? "";
    expect(anti).toMatch(/"sourceSlug"\s*=\s*\$1/);
    expect(anti).toMatch(/o\."listIsActive"/);
    expect(anti).toMatch(/LEFT JOIN _livre/i);
  });

describe("réconciliation stale — sûreté anti-radiation-massive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intelIngestionBatch.create as Mock).mockResolvedValue({ id: "batch_1" });
    (prisma.intelIngestionBatch.update as Mock).mockResolvedValue({});
    (prisma.intelAuditLog.create as Mock).mockResolvedValue({});
    rawExec().mockResolvedValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("LIVRAISON TRONQUÉE — couverture < 100 % → on ne radie RIEN, recordsRemoved NULL", async () => {
    livraison(20000);
    entitesRendues(20000, 19990); // 10 identifiants manquent : couverture incomplète
    moteurReconciliation(8);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.completed).toBe(false);
    expect(res.coveragePct).toBeLessThan(100);
    expect(res.recordsRemoved).toBeNull();
    // Aucune réconciliation n'a même été tentée.
    expect(sqlTx().join(" ")).not.toMatch(/TEMP TABLE/i);
  });

  it("PLAFOND — au-delà de 1 % du dataset, on refuse et on alerte", async () => {
    livraison(20000);
    entitesRendues(20000);
    // 5 000 candidats sur 100 000 actives = 5 % : bien au-delà du plafond.
    moteurReconciliation(5000, 100000);

    const res = await ingestSource("scamsniffer", "test");

    expect(res.completed).toBe(true);          // la couverture, elle, est bonne
    expect(res.recordsRemoved).toBeNull();     // mais rien n'a été radié
    const updates = sqlTx().filter((s) => /UPDATE/i.test(s));
    expect(updates).toHaveLength(0);
    const alerte = (console.error as unknown as Mock).mock.calls
      .concat((console.warn as unknown as Mock).mock.calls)
      .map((c) => c.join(" ")).join(" | ");
    expect(alerte).toMatch(/plafond|massive/i);
    expect(alerte).toContain("5000");
  });

  it("juste SOUS le plafond — la réconciliation passe", async () => {
    livraison(20000);
    entitesRendues(20000);
    moteurReconciliation(900, 100000); // 0,9 % < 1 %

    const res = await ingestSource("scamsniffer", "test");

    expect(res.recordsRemoved).toBe(900);
  });

  it("le journal d'audit distingue NULL de 0", async () => {
    livraison(20000);
    entitesRendues(20000, 19990);
    moteurReconciliation(8);

    await ingestSource("scamsniffer", "test");

    const c = (prisma.intelAuditLog.create as Mock).mock.calls.find(
      (x) => x[0].data.action === "ingest.completed"
    );
    expect(c![0].data.detail.removed).toBeNull();
    expect(c![0].data.detail.reconciliation).toMatch(/coverage|couverture/i);
  });
});
