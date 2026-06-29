import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => null }));

// prisma mock — capture upsert args, control raw results
const kolProfileUpsert = vi.fn().mockResolvedValue({ handle: "captain_meme1" });
const kolTokenLinkUpsert = vi.fn().mockResolvedValue({});
const queryRawUnsafe = vi.fn(); // preflight
const executeRawUnsafe = vi.fn(); // evidence insert

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { upsert: (a: unknown) => kolProfileUpsert(a) },
    kolTokenLink: { upsert: (a: unknown) => kolTokenLinkUpsert(a) },
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a),
    $executeRawUnsafe: (...a: unknown[]) => executeRawUnsafe(...a),
  },
}));

const PLAN = {
  kolProfileToCreate: {
    handle: "captain_meme1", platform: "x", displayName: "captain_meme1",
    evidenceStatus: "partial", internalNote: "x", publishable: false, publishStatus: "draft",
  },
  kolTokenLinksToCreate: [
    { kolHandle: "captain_meme1", contractAddress: "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump", chain: "solana", tokenSymbol: "TOES", role: "promoter" },
    { kolHandle: "captain_meme1", contractAddress: "PENDING:TROLL", chain: "solana", tokenSymbol: "TROLL", role: "promoter" },
  ],
  evidences: [
    { kolHandle: "captain_meme1", tokenSymbol: "TOES", sessionId: "s1", localFilePath: "shot.png",
      sha256: "a".repeat(64), relationType: "kol_token", relationKey: "captain_meme1:TOES",
      snapshotType: "osint_x_search", title: "t", caption: "c", notes: "n" },
  ],
  confidence: { kolHandle: "high", perTokenSummary: [] },
};

async function post(body: unknown) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/admin/osint/commit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "t" },
    body: JSON.stringify(body),
  });
  const res = await POST(req as never);
  return { status: res.status, json: await res.json() };
}

describe("POST /api/admin/osint/commit — shadow mode", () => {
  beforeEach(() => {
    vi.resetModules();
    kolProfileUpsert.mockClear(); kolTokenLinkUpsert.mockClear();
    queryRawUnsafe.mockReset(); executeRawUnsafe.mockReset();
    queryRawUnsafe.mockResolvedValue([{ column_name: "extractionMethod" }, { column_name: "extractionConfidence" }]);
    executeRawUnsafe.mockResolvedValue(1);
  });

  it("412 when the migration is not applied", async () => {
    queryRawUnsafe.mockResolvedValue([{ column_name: "extractionMethod" }]); // only 1/2
    const { status, json } = await post({ plan: PLAN });
    expect(status).toBe(412);
    expect(json.error).toBe("migration_required");
  });

  it("422 refuses an unresolved 'unknown_handle'", async () => {
    const { status, json } = await post({ plan: { ...PLAN, kolProfileToCreate: { ...PLAN.kolProfileToCreate, handle: "unknown_handle" } } });
    expect(status).toBe(422);
    expect(json.error).toBe("unresolved_handle");
  });

  it("(f) NEVER publishes: profile forced publishable=false/draft", async () => {
    // even if the plan tries to sneak publishable=true
    await post({ plan: { ...PLAN, kolProfileToCreate: { ...PLAN.kolProfileToCreate, publishable: true, publishStatus: "published" } } });
    const arg = kolProfileUpsert.mock.calls[0][0] as { create: { publishable: boolean; publishStatus: string } };
    expect(arg.create.publishable).toBe(false);
    expect(arg.create.publishStatus).toBe("draft");
  });

  it("links written as shadow drafts; PENDING stays PENDING (never resolved)", async () => {
    const { status, json } = await post({ plan: PLAN });
    expect(status).toBe(200);
    expect(json.links.ok).toBe(2);
    expect(json.links.pending).toBe(1);
    const calls = kolTokenLinkUpsert.mock.calls.map((c) => c[0] as { where: { kolHandle_contractAddress_chain: { contractAddress: string } }; create: { visibility: string; contractAddress: string } });
    for (const c of calls) {
      expect(c.create.visibility).toBe("draft"); // never 'public'
    }
    const pendingCall = calls.find((c) => c.create.contractAddress.startsWith("PENDING:"));
    expect(pendingCall).toBeTruthy();
    expect(pendingCall!.where.kolHandle_contractAddress_chain.contractAddress).toBe("PENDING:TROLL");
  });

  it("idempotent: 2nd run inserts 0 evidence (ON CONFLICT skip)", async () => {
    const first = await post({ plan: PLAN });
    expect(first.json.evidences.inserted).toBe(1);

    executeRawUnsafe.mockResolvedValue(0); // conflict on sha256
    const second = await post({ plan: PLAN });
    expect(second.json.evidences.inserted).toBe(0);
    expect(second.json.evidences.skipped_existing).toBe(1);
  });

  it("evidence insert forces isPublic=false and extractionMethod=vision_auto", async () => {
    await post({ plan: PLAN });
    const args = executeRawUnsafe.mock.calls[0];
    // positional params: ...,$10 isPublic=false, ...,$18 extractionMethod
    expect(args).toContain("vision_auto");
    expect(args).toContain(false);
  });
});
