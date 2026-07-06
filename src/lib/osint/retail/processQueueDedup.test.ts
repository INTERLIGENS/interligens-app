/**
 * TEST 3 — retail dedup: a duplicate submission triggers ZERO vision cost.
 *
 * process-queue is the ONLY place callVision runs for the retail path. The submit
 * route marks a known-hash image DUPLICATE (classifyImageOutcome — tested in
 * submitGate.test.ts) and never QUEUES it, so listQueuedRetail (QUEUED-only)
 * never returns it → callVision is never reached. This asserts that end of the
 * mechanism with a real spy on callVision: fresh QUEUED row ⇒ 1 call; a duplicate
 * (absent from the queue, or present but without a normalized image) ⇒ 0 calls.
 *
 * Zero DB, zero network, zero residue — every dependency is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// admin gate -> allow
vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => null }));
// processing kill switch -> open, generous budget
vi.mock("@/lib/osint/retail/retailConfig", () => ({
  isRetailProcessingEnabled: () => true,
  dailyVisionBudgetUsd: () => 100,
}));
// preflightEvidence() reads prisma directly -> return the 2 required columns
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRawUnsafe: async () => [{ column_name: "extractionMethod" }, { column_name: "extractionConfidence" }] },
}));

// THE SPY — the vision call whose count is the whole point of this test.
const callVisionSpy = vi.fn();
vi.mock("@/lib/osint/vision/callVision", () => ({
  callVision: (...args: unknown[]) => callVisionSpy(...args),
}));
// downstream of vision — mocked so the test isolates the vision gate.
vi.mock("@/lib/osint/vision/resolveTokens", () => ({ resolveVisionTokens: async () => [] }));
vi.mock("@/lib/osint/vision/verifyMintOnChain", () => ({ verifyMintOnChain: async () => ({ status: "unavailable", symbol: null, name: null }) }));
vi.mock("@/lib/osint/retail/buildReviewablePlan", () => ({ buildReviewablePlan: () => ({ provenance: {}, claims: [], captureMeta: {} }) }));
vi.mock("@/lib/osint/decision", () => ({ processSubmission: async () => ({ status: "auto_committed_shadow", claims: [] }) }));

// retailStore — the queue source + write helpers (all in-memory, no DB).
const listQueuedRetail = vi.fn();
const markError = vi.fn(async () => {});
const markProcessing = vi.fn(async () => true);
vi.mock("@/lib/osint/retail/retailStore", () => ({
  preflightRetail: async () => null,
  estimatedVisionSpendTodayUsd: async () => 0,
  listQueuedRetail: () => listQueuedRetail(),
  markProcessing: () => markProcessing(),
  markError: () => markError(),
  buildRetailProcessingStore: () => ({}),
  VISION_COST_PER_IMAGE_USD: 0.0058,
  RETAIL_SOURCE_TYPE: "osint_retail_screenshot",
}));

function queuedRow(over: Record<string, unknown> = {}) {
  return {
    id: "row-1", imageSha256: "a".repeat(64), perceptualHash: null,
    submitter: "iphash", ingestedAt: "2026-07-06T07:14:00.000Z",
    tweetUrl: null, contextNote: null,
    normalizedImageB64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
    normalizedMediaType: "image/png",
    ...over,
  };
}

async function runQueue() {
  const { POST } = await import("@/app/api/admin/osint/retail/process-queue/route");
  const req = new Request("http://localhost/api/admin/osint/retail/process-queue", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-token": "t" }, body: "{}",
  });
  const res = await POST(req as never);
  return { status: res.status, json: await res.json() };
}

describe("TEST 3 — retail dedup gates the vision cost (callVision spy)", () => {
  beforeEach(() => {
    vi.resetModules();
    callVisionSpy.mockReset();
    callVisionSpy.mockResolvedValue({
      kolHandle: null, kolHandleConfidence: "low", snapshotType: "osint_x_search",
      tokens: [], readWithCertainty: [], uncertain: [], notes: null,
      diagnostics: { passes: 2, secondPassError: null, handleReads: [null, null], tokenCountReads: [0, 0], tokens: [] },
    });
    listQueuedRetail.mockReset();
    markError.mockReset(); markError.mockResolvedValue(undefined);
    markProcessing.mockReset(); markProcessing.mockResolvedValue(true);
  });

  it("1. a fresh QUEUED submission → callVision runs EXACTLY once", async () => {
    listQueuedRetail.mockResolvedValue([queuedRow()]);
    const { status, json } = await runQueue();
    expect(status).toBe(200);
    expect(json.processed).toBe(1);
    expect(callVisionSpy).toHaveBeenCalledTimes(1); // the paid call, for a genuine new image
  });

  it("2+3. CRITICAL — a duplicate is never QUEUED → empty queue → callVision runs ZERO times", async () => {
    // A known-hash image is marked DUPLICATE by the submit gate and never enters
    // the QUEUED set, so the processor's queue is empty for it.
    listQueuedRetail.mockResolvedValue([]);
    const { status, json } = await runQueue();
    expect(status).toBe(200);
    expect(json.found).toBe(0);
    expect(callVisionSpy).not.toHaveBeenCalled(); // ZERO vision cost — the point of TEST 3
  });

  it("3b. belt-and-suspenders — even a duplicate-shaped row (no normalized image) never reaches callVision", async () => {
    // DUPLICATE rows carry normalizedImageB64=null (submit never normalized them).
    // Should one ever surface in the queue, the processor skips it BEFORE callVision.
    listQueuedRetail.mockResolvedValue([queuedRow({ normalizedImageB64: null })]);
    const { json } = await runQueue();
    expect(callVisionSpy).not.toHaveBeenCalled(); // still zero vision cost
    expect(markError).toHaveBeenCalled();          // routed to ERROR, not visioned
    expect(json.results[0].reason).toBe("no_normalized_image");
  });

  it("4. no false positive — two DISTINCT fresh rows both reach callVision (2 calls)", async () => {
    listQueuedRetail.mockResolvedValue([
      queuedRow({ id: "row-1", imageSha256: "a".repeat(64) }),
      queuedRow({ id: "row-2", imageSha256: "b".repeat(64) }),
    ]);
    const { json } = await runQueue();
    expect(json.processed).toBe(2);
    expect(callVisionSpy).toHaveBeenCalledTimes(2); // different hashes are NOT deduped
  });
});
