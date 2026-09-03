// --- Doctrine ratifiee le 2026-08-28 -------------------------------------
// Une exclusion persistante ne disparait QUE par une decision explicite de
// levee - jamais par absence de requalification dans un run ulterieur.
// Vaut au-dela de high_frequency.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shillBuyerObservation: { findMany: vi.fn() },
    shillCorrelationCandidate: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { aggregateCandidates, type ExistingExclusion } from "../aggregate";
import type { VetVerdict } from "../vetting";

const obsFindMany = vi.mocked(prisma.shillBuyerObservation.findMany as unknown as (...a: unknown[]) => unknown);

/** Un wallet vu sur UNE seule occasion : il tombe forcement en `watch`. */
function observationsFor(wallet: string, kol = "empire_sol1") {
  return [
    {
      shillEventId: "e1", wallet, chain: "solana", behaviorType: "pre_tweet",
      exitDeltaSeconds: null, firstSeenAt: new Date("2026-06-03T18:55:00Z"),
      firstBuyTxSignature: "sig1",
      shillEvent: { id: "e1", kolHandle: kol, tokenMint: "MINT_A", tweetTimestamp: new Date("2026-06-03T18:57:00Z"), resolutionStatus: "resolved_direct" },
    },
  ];
}

const existingMap = (wallet: string, reason: string | null, kol = "empire_sol1") =>
  new Map<string, ExistingExclusion>([
    [`${kol} ${wallet} solana`, { excludedReason: reason, walletTxCount30d: 900, walletTokenAccounts: 12, walletVettedAt: new Date("2026-08-01T00:00:00Z"), id: "row-legacy", rowNature: null }],
  ]);

beforeEach(() => vi.clearAllMocks());

describe("Persistance des exclusions", () => {
  it("un high_frequency qui tombe en watch CONSERVE son exclusion", async () => {
    // Le cas reel : empire_sol1 AUQAzeNnW4p2, candidate -> watch apres le
    // correctif #1. Sans ce comportement, son exclusion passait a NULL.
    obsFindMany.mockResolvedValue(observationsFor("AUQAzeNnW4p2"));
    const r = await aggregateCandidates({
      dryRun: true,
      loadExistingExclusions: async () => existingMap("AUQAzeNnW4p2", "high_frequency"),
    });
    const c = r.candidates.find((x) => x.wallet === "AUQAzeNnW4p2")!;
    expect(c.scores.classification).toBe("watch"); // ne surface plus
    expect(c.excludedReason).toBe("high_frequency"); // ... et reste exclu
    expect(r.exclusions.preserved).toBe(1);
    expect(r.exclusions.applied).toBe(0);
    expect(r.surviving.find((x) => x.wallet === "AUQAzeNnW4p2")).toBeUndefined();
  });

  it("la metadonnee de vetting survit aussi - pas seulement le motif", async () => {
    obsFindMany.mockResolvedValue(observationsFor("W1"));
    const r = await aggregateCandidates({
      dryRun: true,
      loadExistingExclusions: async () => existingMap("W1", "high_frequency"),
    });
    const c = r.candidates.find((x) => x.wallet === "W1")!;
    expect(c.walletTxCount30d).toBe(900);
    expect(c.walletTokenAccounts).toBe(12);
    expect(c.walletVettedAt).toEqual(new Date("2026-08-01T00:00:00Z"));
  });

  it("la doctrine vaut AU-DELA de high_frequency", async () => {
    for (const reason of ["too_many_tokens", "bot_infra"]) {
      obsFindMany.mockResolvedValue(observationsFor("W2"));
      const r = await aggregateCandidates({
        dryRun: true,
        loadExistingExclusions: async () => existingMap("W2", reason),
      });
      expect(r.candidates.find((x) => x.wallet === "W2")!.excludedReason).toBe(reason);
    }
  });

  it("sans vetter du tout, toutes les exclusions connues sont conservees", async () => {
    obsFindMany.mockResolvedValue(observationsFor("W3"));
    const r = await aggregateCandidates({
      dryRun: true,
      // pas de vetWallet : aucun run de requalification
      loadExistingExclusions: async () => existingMap("W3", "high_frequency"),
    });
    expect(r.candidates.find((x) => x.wallet === "W3")!.excludedReason).toBe("high_frequency");
  });

  it("une LEVEE EXPLICITE par le vetting retire bien l'exclusion", async () => {
    // Un wallet qui surface ET que la regle requalifie comme propre : c'est la
    // seule voie de sortie. La doctrine interdit la disparition par omission,
    // pas la levee par decision.
    obsFindMany.mockResolvedValue([
      ...observationsFor("W4"),
      { shillEventId: "e2", wallet: "W4", chain: "solana", behaviorType: "pre_tweet",
        exitDeltaSeconds: null, firstSeenAt: new Date("2026-06-04T10:00:00Z"), firstBuyTxSignature: "sig2",
        shillEvent: { id: "e2", kolHandle: "empire_sol1", tokenMint: "MINT_B", tweetTimestamp: new Date("2026-06-04T10:02:00Z") } },
      { shillEventId: "e3", wallet: "W4", chain: "solana", behaviorType: "pre_tweet",
        exitDeltaSeconds: null, firstSeenAt: new Date("2026-06-05T10:00:00Z"), firstBuyTxSignature: "sig3",
        shillEvent: { id: "e3", kolHandle: "empire_sol1", tokenMint: "MINT_C", tweetTimestamp: new Date("2026-06-05T10:02:00Z") } },
    ]);
    const clean: VetVerdict = { excludedReason: null, flags: [], txCount30d: 10, distinctTokenAccounts: 2, infraHits: [] };
    const r = await aggregateCandidates({
      dryRun: true,
      loadExistingExclusions: async () => existingMap("W4", "high_frequency"),
      vetWallet: async () => clean,
    });
    const c = r.candidates.find((x) => x.wallet === "W4")!;
    expect(c.scores.classification).not.toBe("watch"); // il surface
    expect(c.excludedReason).toBeNull(); // ... et la regle l'a leve
  });

  it("known_router reste applique a chaque run, inchange", async () => {
    // ARu4n5mFdZog est dans la liste statique.
    obsFindMany.mockResolvedValue(observationsFor("ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn"));
    const r = await aggregateCandidates({
      dryRun: true,
      loadExistingExclusions: async () => new Map(),
    });
    const c = r.candidates[0];
    expect(c.excludedReason).toBe("known_router");
    expect(r.exclusions.applied).toBe(1);
    expect(r.exclusions.preserved).toBe(0);
  });

  it("un candidat sans exclusion connue reste non exclu", async () => {
    obsFindMany.mockResolvedValue(observationsFor("W5"));
    const r = await aggregateCandidates({ dryRun: true, loadExistingExclusions: async () => new Map() });
    expect(r.candidates.find((x) => x.wallet === "W5")!.excludedReason).toBeNull();
    expect(r.exclusions.total).toBe(0);
  });

  it("le rapport distingue occasions et evenements collectes", async () => {
    obsFindMany.mockResolvedValue(observationsFor("W6"));
    const r = await aggregateCandidates({ dryRun: true, loadExistingExclusions: async () => new Map() });
    expect(r.analyzableEvents).toBe(1);
    expect(r.analyzableOccasions).toBe(1);
  });
});
