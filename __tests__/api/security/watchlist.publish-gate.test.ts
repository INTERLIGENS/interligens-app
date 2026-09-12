// cc-offline-49 T2 — /api/watchlist redacts sensitive analytics on NON-published
// entries WITHOUT dropping any row (all tracked handles stay visible).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/watcher/handles", () => ({
  handlesV2: [
    { handle: "pubguy", priority: "high", category: "paid_undisclosed", source: "seed", chainFocus: "SOL", followerCount: 1000, notes: null },
    { handle: "draftguy", priority: "medium", category: "pump_fun_caller", source: "seed", chainFocus: "SOL", followerCount: 500, notes: null },
  ],
}));

vi.mock("@/lib/kol/canonical", () => ({
  buildKolCanonicalSnapshotBatch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolTokenLink: { findMany: vi.fn() },
    kolPromotionMention: { findMany: vi.fn() },
    kolTokenInvolvement: { findMany: vi.fn() },
    socialPostCandidate: { groupBy: vi.fn() },
    influencer: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { buildKolCanonicalSnapshotBatch } from "@/lib/kol/canonical";
import { GET } from "@/app/api/watchlist/route";

const mockBatch = vi.mocked(buildKolCanonicalSnapshotBatch as unknown as (...a: unknown[]) => unknown);

function profile(handle: string, published: boolean) {
  return {
    handle,
    displayName: handle,
    followerCount: published ? 1000 : 500,
    behaviorFlags: JSON.stringify(["REPEATED_CASHOUT"]),
    tier: "T1",
    riskFlag: "high",
    totalDocumented: 12345,
    // P0 containment — le gate proceeds est fail-closed : une fixture qui
    // n'expose pas cet etat voit son montant ET ses buckets cashout retires.
    // C'est le comportement voulu (voir src/lib/kol/proceedsGate.ts) ; la
    // fixture doit donc declarer explicitement l'etat qu'elle veut tester.
    proceedsPublication: "published",
    // A15 — un état absent ne publie pas (fail-closed, monetaryGate.ts).
    monetaryClaimsPublication: "published",
    totalScammed: 67890,
    proceedsCoverage: "partial",
    evidenceDepth: "strong",
    completenessLevel: "substantial",
    rugCount: 4,
    verified: true,
    _count: { evidences: 2, kolWallets: 1, kolCases: 1, tokenLinks: 1 },
    publishStatus: published ? "published" : "draft",
    publishable: false,
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    proceedsComputedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.kolTokenLink.findMany as any).mockResolvedValue([
    { kolHandle: "draftguy", tokenSymbol: "SCAM", createdAt: new Date() },
    { kolHandle: "pubguy", tokenSymbol: "REAL", createdAt: new Date() },
  ]);
  (prisma.kolPromotionMention.findMany as any).mockResolvedValue([]);
  // Both handles have real cashout proceeds (KolTokenInvolvement) so we can
  // assert the bucket is zeroed for the non-published one and kept for the published.
  (prisma.kolTokenInvolvement.findMany as any).mockResolvedValue([
    { kolHandle: "pubguy", proceedsUsd: 50000, firstSellAt: new Date() },
    { kolHandle: "draftguy", proceedsUsd: 90000, firstSellAt: new Date() },
  ]);
  (prisma.socialPostCandidate.groupBy as any).mockResolvedValue([]);
  (prisma.influencer.findMany as any).mockResolvedValue([]);
  mockBatch.mockResolvedValue([profile("pubguy", true), profile("draftguy", false)]);
});

async function corpsServi(): Promise<Record<string, unknown>> {
  const res = await GET();
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CE TÉMOIN A CHANGÉ D'OBJET, ET IL N'A PAS ÉTÉ SUPPRIMÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Il attestait d'une RÉDACTION par entrée : la ligne reste, les analytics
// tombent pour le non-publié. Cette propriété supposait qu'il y ait des
// entrées — donc que l'APPARTENANCE à la Watchlist soit elle-même servie.
//
// Or l'appartenance est une assertion publiée qu'aucune décision ne fonde
// (P0 · collection authority). Le refus est donc monté au niveau de la
// COLLECTION, et la rédaction par entrée n'a plus d'objet : il n'y a plus
// d'entrée à rédiger.
//
// Supprimer le fichier aurait ABSORBÉ le défaut — le retrait serait devenu
// invisible aux témoins. Il atteste désormais de la propriété PLUS FORTE qui
// remplace l'ancienne : les mêmes fixtures, publié ET brouillon, rendent la
// MÊME suite d'octets. Un lecteur ne peut plus distinguer les deux, ni
// compter, ni ordonner.
describe("GET /api/watchlist — le retrait est au niveau de la COLLECTION", () => {
  it("ne sert plus aucune entrée — ni publiée, ni brouillon", async () => {
    const corps = await corpsServi();
    expect(corps.entries).toBeUndefined();
    expect(corps.refus).toBe(true);
    expect(corps.surface).toBe("watchlist");
  });

  it("le corps ne porte NI compte, NI longueur, NI clé par membre", async () => {
    const corps = await corpsServi();
    // Trois champs, et le type `CorpsDeRefus` interdit d'y glisser un compte.
    expect(Object.keys(corps).sort()).toEqual(["code", "refus", "surface"]);
    // Aucun chiffre dans la charge : ni 2 entrées, ni 108, ni 0.
    expect(JSON.stringify(corps)).not.toMatch(/\d/);
    // Et aucun handle des fixtures n'y transparaît.
    expect(JSON.stringify(corps)).not.toMatch(/pubguy|draftguy|SCAM|REAL/);
  });

  it("MUTATION DISCRIMINANTE — publié seul, brouillon seul, ou aucun : MÊMES octets", async () => {
    const deux = JSON.stringify(await corpsServi());

    mockBatch.mockResolvedValue([profile("pubguy", true)]);
    const publieSeul = JSON.stringify(await corpsServi());

    mockBatch.mockResolvedValue([profile("draftguy", false)]);
    const brouillonSeul = JSON.stringify(await corpsServi());

    mockBatch.mockResolvedValue([]);
    const aucun = JSON.stringify(await corpsServi());

    // Si l'une de ces quatre différait d'un seul octet, la composition de la
    // Watchlist serait reconstructible — c'est exactement le différentiel que
    // le retrait ferme.
    expect(new Set([deux, publieSeul, brouillonSeul, aucun]).size).toBe(1);
  });

  it("le retrait est CAUSAL — la route ne lit plus aucune source", async () => {
    await corpsServi();
    // Rebrancher la route ne suffirait pas : plus rien n'est interrogé, et
    // `projeterWatchlist` lève si la table des fondations venait à déclarer
    // une décision d'appartenance.
    expect(mockBatch).not.toHaveBeenCalled();
    expect(prisma.kolTokenLink.findMany).not.toHaveBeenCalled();
    expect(prisma.kolTokenInvolvement.findMany).not.toHaveBeenCalled();
  });
});
