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

async function getEntries() {
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.entries as any[];
}

describe("GET /api/watchlist — non-published redaction", () => {
  it("keeps EVERY tracked handle (published + non-published) — no row dropped", async () => {
    const entries = await getEntries();
    const handles = entries.map(e => e.handle).sort();
    expect(handles).toEqual(["draftguy", "pubguy"]);
  });

  it("nulls sensitive analytics on the NON-published entry but keeps the row + tickers", async () => {
    const entries = await getEntries();
    const draft = entries.find(e => e.handle === "draftguy")!;
    expect(draft.isPublished).toBe(false);
    // masked
    expect(draft.totalProceeds).toBeNull();
    expect(draft.totalScammed).toBeNull();
    expect(draft.behaviorFlags).toEqual([]);
    expect(draft.behaviorFlagsCount).toBe(0);
    expect(draft.riskFlag).toBeNull();
    expect(draft.rugCount).toBeNull();
    // cashout ("Money taken") zeroed — shape kept valid so the UI can't crash
    expect(draft.cashout).toEqual({ d1: 0, d7: 0, d30: 0, ytd: 0, total: 0 });
    // kept
    expect(draft.handle).toBe("draftguy");
    expect(draft.priority).toBe("medium");
    expect(draft.followerCount).toBe(500);
    expect(draft.tickers).toContain("SCAM");
  });

  it("leaves the PUBLISHED entry fully intact", async () => {
    const entries = await getEntries();
    const pub = entries.find(e => e.handle === "pubguy")!;
    expect(pub.isPublished).toBe(true);
    expect(pub.totalProceeds).toBe(12345);
    expect(pub.totalScammed).toBe(67890);
    expect(pub.behaviorFlags).toEqual(["REPEATED_CASHOUT"]);
    expect(pub.behaviorFlagsCount).toBe(1);
    expect(pub.riskFlag).toBe("high");
    expect(pub.rugCount).toBe(4);
    expect(pub.tickers).toContain("REAL");
    // cashout untouched for published — real proceeds still surface
    expect(pub.cashout.total).toBe(50000);
  });
});
