import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { count: vi.fn() },
    kolTokenInvolvement: { findMany: vi.fn() },
    watcherCampaign: { create: vi.fn() },
    socialPostCandidate: { updateMany: vi.fn() },
    watcherCampaignKOL: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    watcherDigest: { create: vi.fn() },
  },
}));

import { clusterSignals, type SignalInput } from "../campaignClusterer";
import { sendWatcherDigest, buildWatcherDigestHtml } from "@/lib/alerts/watcherDigest";
import { prisma } from "@/lib/prisma";

// ── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;
function makeSignal(overrides: Partial<SignalInput> & { kolHandle: string }): SignalInput {
  return {
    id:                `sig-${++idCounter}`,
    kolHandle:         overrides.kolHandle,
    kolProfileId:      overrides.kolProfileId ?? null,
    detectedTokens:    overrides.detectedTokens    ?? "[]",
    detectedAddresses: overrides.detectedAddresses ?? "[]",
    rawText:           overrides.rawText           ?? null,
    discoveredAtUtc:   overrides.discoveredAtUtc   ?? new Date("2026-04-25T08:00:00Z"),
    signalScore:       overrides.signalScore        ?? 40,
  };
}

function setupDefaultMocks() {
  vi.mocked(prisma.kolProfile.count).mockResolvedValue(0);
  vi.mocked(prisma.kolTokenInvolvement.findMany).mockResolvedValue([]);
  (prisma.watcherCampaign.create as any).mockImplementation(
    async ({ data }: any) => ({ id: `campaign-${Math.random().toString(36).slice(2)}`, ...data })
  );
  vi.mocked(prisma.socialPostCandidate.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.watcherCampaignKOL.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.watcherCampaignKOL.create).mockResolvedValue({} as any);
  vi.mocked(prisma.watcherCampaignKOL.update).mockResolvedValue({} as any);
  vi.mocked(prisma.watcherDigest.create).mockResolvedValue({} as any);
}

// ── Campaign Clusterer ────────────────────────────────────────────────────────

describe("clusterSignals — grouping", () => {
  beforeEach(() => {
    idCounter = 0;
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // Test 1
  it("groups signals by same contract address into one campaign", async () => {
    const addr = "So11111111111111111111111111111111111111112";
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedAddresses: JSON.stringify([addr]) }),
      makeSignal({ kolHandle: "kol2", detectedAddresses: JSON.stringify([addr]) }),
    ];

    const result = await clusterSignals(signals);

    expect(result.campaignsCreated).toBe(1);
    expect(result.signalsLinked).toBe(2);
  });

  // Test 2
  it("groups signals by same token symbol within 72h into one campaign", async () => {
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$BONK"]', discoveredAtUtc: new Date("2026-04-25T08:00:00Z") }),
      makeSignal({ kolHandle: "kol2", detectedTokens: '["$BONK"]', discoveredAtUtc: new Date("2026-04-25T16:00:00Z") }),
    ];

    const result = await clusterSignals(signals);

    expect(result.campaignsCreated).toBe(1);
    expect(result.signalsLinked).toBe(2);
  });

  // Test 3
  it("creates separate campaigns for different tokens", async () => {
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$BONK"]' }),
      makeSignal({ kolHandle: "kol2", detectedTokens: '["$WIF"]' }),
    ];

    const result = await clusterSignals(signals);

    expect(result.campaignsCreated).toBe(2);
  });

  it("returns zero for empty signals array", async () => {
    const result = await clusterSignals([]);
    expect(result.campaignsCreated).toBe(0);
    expect(result.signalsLinked).toBe(0);
  });
});

describe("clusterSignals — priority scoring", () => {
  beforeEach(() => {
    idCounter = 0;
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // Test 4
  it("sets HIGH priority when same token is pushed by ≥2 KOLs", async () => {
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$PEPE"]' }),
      makeSignal({ kolHandle: "kol2", detectedTokens: '["$PEPE"]' }),
    ];

    await clusterSignals(signals);

    const createCalls = vi.mocked(prisma.watcherCampaign.create).mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);
    const priorities = createCalls.map((c) => (c[0] as any).data.priority);
    expect(priorities).toContain("HIGH");
  });

  // Test 5
  it("sets HIGH priority when rawText contains extreme claim (100x)", async () => {
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$MOON"]', rawText: "This will easily do 100x, NFA" }),
    ];

    await clusterSignals(signals);

    const createCalls = vi.mocked(prisma.watcherCampaign.create).mock.calls;
    const priorities = createCalls.map((c) => (c[0] as any).data.priority);
    expect(priorities).toContain("HIGH");
  });

  // Test 6
  it("sets HIGH priority when KOL is flagged RED in KolProfile", async () => {
    vi.mocked(prisma.kolProfile.count).mockResolvedValue(1); // 1 RED KOL

    const signals = [
      makeSignal({ kolHandle: "redKol", detectedTokens: '["$SCAM"]' }),
    ];

    await clusterSignals(signals);

    expect(prisma.kolProfile.count).toHaveBeenCalled();
    const createCalls = vi.mocked(prisma.watcherCampaign.create).mock.calls;
    const priorities = createCalls.map((c) => (c[0] as any).data.priority);
    expect(priorities).toContain("HIGH");
  });

  it("sets CRITICAL priority when token matches KolTokenInvolvement", async () => {
    vi.mocked(prisma.kolTokenInvolvement.findMany).mockResolvedValue([
      { tokenMint: "BONK" } as any,
    ]);

    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$BONK"]' }),
    ];

    await clusterSignals(signals);

    const createCalls = vi.mocked(prisma.watcherCampaign.create).mock.calls;
    const priorities = createCalls.map((c) => (c[0] as any).data.priority);
    expect(priorities).toContain("CRITICAL");
  });

  it("sets HIGH priority when contract address is present", async () => {
    const signals = [
      makeSignal({
        kolHandle: "kol1",
        detectedAddresses: JSON.stringify(["So11111111111111111111111111111111111111112"]),
      }),
    ];

    await clusterSignals(signals);

    const createCalls = vi.mocked(prisma.watcherCampaign.create).mock.calls;
    const priorities = createCalls.map((c) => (c[0] as any).data.priority);
    expect(priorities).toContain("HIGH");
  });
});

// ── Test 9: Deduplication ─────────────────────────────────────────────────────

describe("clusterSignals — deduplication", () => {
  beforeEach(() => {
    idCounter = 0;
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("each signal gets linked to exactly one campaign (no double-link)", async () => {
    const signals = [
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$DEDUP"]' }),
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$DEDUP"]' }),
      makeSignal({ kolHandle: "kol1", detectedTokens: '["$DEDUP"]' }),
    ];

    const result = await clusterSignals(signals);

    // All 3 signals linked, but only 1 campaign created
    expect(result.campaignsCreated).toBe(1);
    expect(result.signalsLinked).toBe(3);

    // updateMany should have been called once with all 3 IDs
    const updateCalls = vi.mocked(prisma.socialPostCandidate.updateMany).mock.calls;
    const totalLinked = updateCalls.reduce((s, c) => s + ((c[0] as any).where.id.in as string[]).length, 0);
    expect(totalLinked).toBe(3);
  });
});

// ── Email mode tests ──────────────────────────────────────────────────────────

describe("sendWatcherDigest — email modes", () => {
  const origApiKey  = process.env.RESEND_API_KEY;
  const origAlertEmail = process.env.ALERT_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ALERT_EMAIL    = "test@example.com";
    vi.mocked(prisma.watcherDigest.create).mockResolvedValue({} as any);
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = origApiKey;
    process.env.ALERT_EMAIL    = origAlertEmail;
    vi.restoreAllMocks();
  });

  // Test 7: digest mode → 1 email
  it("sends exactly one email for multiple KOL batch signals", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 })
    );

    const batchSignals = [
      { handle: "kol1", signalCount: 3, tokens: ["$BONK"], snippet: "test1" },
      { handle: "kol2", signalCount: 2, tokens: ["$WIF"],  snippet: "test2" },
    ];

    await sendWatcherDigest(batchSignals, [], new Date(), new Date());

    // One fetch call to Resend (not two, not zero)
    const resendCalls = fetchSpy.mock.calls.filter(([url]) =>
      typeof url === "string" && url.includes("resend.com")
    );
    expect(resendCalls.length).toBe(1);
  });

  // Test 8: off mode → no email (simulate by missing key)
  it("sends no email when RESEND_API_KEY is absent", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.spyOn(global, "fetch");

    await sendWatcherDigest(
      [{ handle: "kol1", signalCount: 5, tokens: ["$TEST"], snippet: "x" }],
      [],
      new Date(),
      new Date(),
    );

    const resendCalls = fetchSpy.mock.calls.filter(([url]) =>
      typeof url === "string" && url.includes("resend.com")
    );
    expect(resendCalls.length).toBe(0);
  });

  // Test 10: WatcherDigest created in DB after send
  it("creates a WatcherDigest record in DB after email send", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    await sendWatcherDigest(
      [{ handle: "kol1", signalCount: 4, tokens: ["$ABC"], snippet: "abc" }],
      [{ id: "c1", primaryTokenSymbol: "ABC", primaryContractAddress: null, priority: "HIGH", kolHandles: ["kol1"], signalCount: 4, claimPatterns: [] }],
      new Date("2026-04-25T06:00:00Z"),
      new Date("2026-04-25T09:00:00Z"),
    );

    expect(prisma.watcherDigest.create).toHaveBeenCalledOnce();
    const createArg = vi.mocked(prisma.watcherDigest.create).mock.calls[0][0] as any;
    expect(createArg.data.emailStatus).toBe("sent");
    expect(createArg.data.signalCount).toBe(4);
    expect(createArg.data.campaignCount).toBe(1);
    expect(createArg.data.highPriorityCount).toBe(1);
  });

  it("still creates WatcherDigest record even when email send fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));

    await sendWatcherDigest(
      [{ handle: "kol1", signalCount: 1, tokens: [], snippet: "fail" }],
    );

    expect(prisma.watcherDigest.create).toHaveBeenCalledOnce();
    const createArg = vi.mocked(prisma.watcherDigest.create).mock.calls[0][0] as any;
    expect(createArg.data.emailStatus).toMatch(/^error_/);
  });
});

// ── HTML digest smoke test ────────────────────────────────────────────────────

describe("buildWatcherDigestHtml", () => {
  it("renders all key sections", () => {
    const html = buildWatcherDigestHtml({
      windowStart: new Date("2026-04-25T06:00:00Z"),
      windowEnd:   new Date("2026-04-25T09:00:00Z"),
      batchSignals: [
        { handle: "kol1", signalCount: 3, tokens: ["$BONK"], snippet: "x" },
        { handle: "kol2", signalCount: 2, tokens: ["$WIF"],  snippet: "y" },
      ],
      campaigns: [
        { id: "c1", primaryTokenSymbol: "BONK", primaryContractAddress: null, priority: "HIGH", kolHandles: ["kol1", "kol2"], signalCount: 5, claimPatterns: [] },
      ],
    });

    expect(html).toContain("INTERLIGENS");
    expect(html).toContain("Campaign Intelligence Report");
    expect(html).toContain("@kol1");
    expect(html).toContain("@kol2");
    expect(html).toContain("$BONK");
    expect(html).toContain("HIGH");
    expect(html).toContain("High Priority Campaigns");
    expect(html).not.toContain("#00E5FF"); // design system rule: no cyan
  });
});
