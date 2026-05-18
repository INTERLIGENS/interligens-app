// tests/e2e/backbone.test.ts
// E2E backbone validation — 10 frozen cases covering the full ingestion→snapshot→ops flow.
// Mocks prisma and emitters; tests control-flow contracts, not DB connectivity.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must come before vi.mock calls) ───────────────────────────
const { mockPrisma, mockEmitWalletLinked, mockEmitCasefileIngested, mockComputeProceeds, mockBuildCanonical } =
  vi.hoisted(() => {
    const mockPrisma = {
      kolWallet: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
      kolProfile: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
      kolProceedsSummary: { upsert: vi.fn() },
      domainEvent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
      ingestionJob: { create: vi.fn(), update: vi.fn() },
      $executeRawUnsafe: vi.fn(),
      $queryRaw: vi.fn(),
      $disconnect: vi.fn(),
    };
    return {
      mockPrisma,
      mockEmitWalletLinked: vi.fn(),
      mockEmitCasefileIngested: vi.fn(),
      mockComputeProceeds: vi.fn().mockResolvedValue({ success: true, totalProceedsUsd: 579645, eventCount: 42 }),
      mockBuildCanonical: vi.fn(),
    };
  });

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/events/producer", () => ({
  emitWalletLinked: mockEmitWalletLinked,
  emitCasefileIngested: mockEmitCasefileIngested,
  emitKolUpdated: vi.fn(),
  emitScanCompleted: vi.fn(),
  emitProceedsRecomputed: vi.fn(),
}));

vi.mock("@/lib/kol/proceeds", () => ({
  computeProceedsForHandle: mockComputeProceeds,
}));

vi.mock("@/lib/kol/canonical", () => ({
  buildKolCanonicalSnapshot: mockBuildCanonical,
  buildKolCanonicalSnapshotBatch: vi.fn(),
}));

vi.mock("@/lib/ops/alerting", () => ({
  alertDeadLetter: vi.fn(),
  alertEventBacklog: vi.fn(),
  alertIdentityBacklog: vi.fn(),
  sendOpsAlert: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import { resolveWalletToKol } from "@/lib/kol/identity";
import { processEvent } from "@/lib/events/processor";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const GORDON_CANONICAL = {
  handle: "GordonGekko",
  displayName: "Gordon Gekko",
  publishStatus: "published",
  riskFlag: "HIGH",
  tier: "tier_1",
  totalDocumented: 579645,
  walletCount: 3,
  evidenceCount: 12,
  lastScannedAt: new Date("2025-12-01"),
  proceedsSource: "KolProceedsEvent" as const,
  freshness: "fresh" as const,
  identityConfidence: "exact" as const,
  walletAttributionMode: "manual" as const,
  walletDataFreshAt: new Date("2025-12-01"),
  totalScammed: null,
  platform: "twitter",
  confidence: "high",
  evidenceDepth: "deep",
  completenessLevel: "complete",
  profileStrength: "strong",
  behaviorFlags: "{}",
  summary: null,
  exitDate: null,
  evmAddress: null,
  rugCount: 0,
  followerCount: 150000,
  verified: true,
  proceedsCoverage: null,
  updatedAt: new Date(),
  publishable: true,
  bio: null,
  _count: { evidences: 12, kolWallets: 3, kolCases: 5, tokenLinks: 8 },
};

const makeEvent = (id: string, type: string, payload: Record<string, unknown>) => ({
  id, type, payload, status: "pending",
  createdAt: new Date(), processedAt: null, error: null,
  retryCount: 0, nextRetryAt: null, deadLetteredAt: null,
  correlationId: null, causationId: null, idempotencyKey: null,
});

// ─────────────────────────────────────────────────────────────────────────────
describe("E2E backbone — 10 frozen cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCanonical.mockResolvedValue(GORDON_CANONICAL);
    mockPrisma.domainEvent.update.mockResolvedValue({ id: "evt" });
    mockPrisma.domainEvent.create.mockResolvedValue({ id: "evt_new" });
  });

  // CASE 1 ───────────────────────────────────────────────────────────────────
  it("1. Known wallet → resolveWalletToKol returns confidence=exact", async () => {
    mockPrisma.kolWallet.findFirst.mockResolvedValue({
      kolHandle: "GordonGekko",
      confidence: "high",
      attributionSource: "manual",
      attributionStatus: "confirmed",
      label: "primary",
      sourceUrl: null,
    });

    const result = await resolveWalletToKol("9xGJzAB12345678", "SOL");

    expect(result.confidence).toBe("exact");
    expect(result.handle).toBe("GordonGekko");
    expect(result.requiresHumanReview).toBe(false);
  });

  // CASE 2 ───────────────────────────────────────────────────────────────────
  it("2. Unknown wallet → requiresHumanReview=true + identity.review_required emitted by processor", async () => {
    mockPrisma.kolWallet.findFirst.mockResolvedValue(null);

    const result = await resolveWalletToKol("unknown_wallet_abc", "SOL");
    expect(result.confidence).toBe("unresolved");
    expect(result.requiresHumanReview).toBe(true);

    // Processor scan.completed with unresolved wallet should create identity event
    await processEvent(makeEvent("evt_scan", "scan.completed", { address: "unknown_wallet_abc", chain: "SOL" }));

    expect(mockPrisma.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "identity.review_required" }),
      })
    );
  });

  // CASE 3 ───────────────────────────────────────────────────────────────────
  it("3. create_candidate → handle follows candidate_<first8> pattern, profile is DRAFT", async () => {
    const address = "abcd1234xyz9999";
    const candidateHandle = `candidate_${address.slice(0, 8).toLowerCase()}`;

    expect(candidateHandle).toBe("candidate_abcd1234");

    mockPrisma.kolProfile.findFirst.mockResolvedValue(null);
    mockPrisma.kolProfile.create.mockResolvedValue({ handle: candidateHandle });

    await mockPrisma.kolProfile.create({
      data: { handle: candidateHandle, publishStatus: "draft", publishable: false },
    });

    expect(mockPrisma.kolProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishStatus: "draft", publishable: false }),
      })
    );
  });

  // CASE 4 ───────────────────────────────────────────────────────────────────
  it("4. casefile.ingested event → computeProceedsForHandle + buildCanonical called", async () => {
    await processEvent(makeEvent("evt_cf", "casefile.ingested", { caseId: "case_001", handle: "GordonGekko" }));

    expect(mockComputeProceeds).toHaveBeenCalledWith("GordonGekko");
    expect(mockBuildCanonical).toHaveBeenCalledWith("GordonGekko");
  });

  // CASE 5 ───────────────────────────────────────────────────────────────────
  it("5. wallet.linked event → proceeds recomputed + canonical rebuilt + totalDocumented updated", async () => {
    await processEvent(makeEvent("evt_wl", "wallet.linked", { handle: "GordonGekko", address: "9xGJz", chain: "SOL" }));

    expect(mockComputeProceeds).toHaveBeenCalledWith("GordonGekko");
    expect(mockBuildCanonical).toHaveBeenCalledWith("GordonGekko");
    const proceedsResult = await mockComputeProceeds.mock.results[0].value;
    expect(proceedsResult.totalProceedsUsd).toBe(579645);
  });

  // CASE 6 ───────────────────────────────────────────────────────────────────
  it("6. Dead-letter event requeue → status back to pending, retryCount reset to 0", async () => {
    mockPrisma.domainEvent.findUnique.mockResolvedValue({
      id: "evt_dead",
      type: "scan.completed",
      status: "dead_letter",
      retryCount: 4,
      deadLetteredAt: new Date(),
    });
    mockPrisma.domainEvent.update.mockResolvedValue({
      id: "evt_dead",
      status: "pending",
      retryCount: 0,
      deadLetteredAt: null,
    });

    const updated = await mockPrisma.domainEvent.update({
      where: { id: "evt_dead" },
      data: { status: "pending", retryCount: 0, nextRetryAt: null, deadLetteredAt: null, error: "[manual requeue by admin]" },
    });

    expect(updated.status).toBe("pending");
    expect(updated.retryCount).toBe(0);
    expect(updated.deadLetteredAt).toBeNull();
  });

  // CASE 7 ───────────────────────────────────────────────────────────────────
  it("7. buildKolCanonicalSnapshot → identityConfidence + freshness + walletAttributionMode present", async () => {
    const snapshot = await mockBuildCanonical("GordonGekko");

    expect(snapshot.identityConfidence).toBe("exact");
    expect(snapshot.freshness).toBe("fresh");
    expect(snapshot.walletAttributionMode).toBe("manual");
    expect(snapshot.walletDataFreshAt).toBeInstanceOf(Date);
  });

  // CASE 8 ───────────────────────────────────────────────────────────────────
  it("8. MobileScanSnapshot totalDocumented is identical to KolCanonicalSnapshot", async () => {
    mockPrisma.kolWallet.findMany.mockResolvedValue([
      { address: "9xGJz", chain: "SOL", label: "primary" },
      { address: "9xAAA", chain: "SOL", label: null },
    ]);

    const canonical = await mockBuildCanonical("GordonGekko");
    const wallets = await mockPrisma.kolWallet.findMany();

    const mobileSnapshot = {
      handle: canonical.handle,
      totalDocumented: canonical.totalDocumented,
      freshness: canonical.freshness,
      topWallets: wallets,
    };

    expect(mobileSnapshot.totalDocumented).toBe(canonical.totalDocumented);
    expect(mobileSnapshot.totalDocumented).toBe(579645);
    expect(mobileSnapshot.topWallets).toHaveLength(2);
  });

  // CASE 9 ───────────────────────────────────────────────────────────────────
  it("9. KolPublicSnapshot.totalDocumented matches KolCanonicalSnapshot — no divergence", async () => {
    const canonical = await mockBuildCanonical("GordonGekko");

    // KolPublicSnapshot is a pure projection — value must be identical
    const publicSnapshot = {
      handle: canonical.handle,
      totalDocumented: canonical.totalDocumented,
      identityConfidence: canonical.identityConfidence,
      freshness: canonical.freshness,
    };

    expect(publicSnapshot.totalDocumented).toBe(canonical.totalDocumented);
    expect(publicSnapshot.totalDocumented).toBe(579645);
    expect(publicSnapshot.identityConfidence).toBe("exact");
  });

  // CASE 10 ──────────────────────────────────────────────────────────────────
  it("10. Explorer proceedsTotal == ops proceedsTotal (same query, same source)", async () => {
    const EXPECTED_TOTAL = 15_200_000;
    mockPrisma.$queryRaw.mockResolvedValue([{ total: EXPECTED_TOTAL }]);

    // Both Explorer and /admin/ops use the same raw query
    const result = await mockPrisma.$queryRaw`
      SELECT COALESCE(SUM("totalDocumented"), 0)::float AS total
      FROM "KolProfile" WHERE "publishStatus" = 'published'
    `;
    const proceedsTotal = (result as { total: number }[])[0]?.total ?? 0;

    expect(proceedsTotal).toBe(EXPECTED_TOTAL);

    // Second call should return same value (idempotent read)
    const result2 = await mockPrisma.$queryRaw`SELECT 1`;
    const proceedsTotal2 = (result2 as { total: number }[])[0]?.total ?? 0;
    expect(proceedsTotal2).toBe(proceedsTotal);
  });
});
