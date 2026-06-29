/**
 * src/app/api/admin/osint/process/route.test.ts
 * SPRINT A — wiring de la route admin (auth, parse, préflight, idempotence,
 * passthrough trustTier). La logique de décision est testée dans la lib ;
 * ici on mocke processSubmission + prisma (préflight) + auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let adminDenied: unknown = null;
vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => adminDenied }));

const verifyMint = vi.fn();
vi.mock("@/lib/osint/vision/verifyMintOnChain", () => ({ verifyMintOnChain: (m: string) => verifyMint(m) }));

const processSubmission = vi.fn();
vi.mock("@/lib/osint/decision", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, processSubmission: (...a: unknown[]) => processSubmission(...a) };
});

const queryRawUnsafe = vi.fn();
const executeRawUnsafe = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a),
    $executeRawUnsafe: (...a: unknown[]) => executeRawUnsafe(...a),
    kolProfile: { upsert: vi.fn() },
    kolTokenLink: { upsert: vi.fn() },
  },
}));

const PLAN = {
  provenance: { imageSha256: "a".repeat(64), perceptualHash: null, promptVersion: "v1", modelVersion: "m1", rawVisionPass1: {}, rawVisionPass2: null, decisionReasons: [], ingestedAt: "2026-06-29T00:00:00.000Z", sourceType: "osint_screenshot", submitter: "ip" },
  claims: [],
  captureMeta: { fileName: "f.png", bytes: 1, width: null, height: null, capturedAt: null, timezoneAssumption: "tz", sessionId: null },
};

async function post(body: unknown, headers: Record<string, string> = { "x-admin-token": "t" }) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/admin/osint/process", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const res = await POST(req as never);
  return { status: res.status, json: await res.json() };
}

function migrationsApplied() {
  queryRawUnsafe.mockReset();
  queryRawUnsafe
    .mockResolvedValueOnce([{ table_name: "OsintSubmission" }])
    .mockResolvedValueOnce([{ column_name: "extractionMethod" }, { column_name: "extractionConfidence" }]);
}

describe("POST /api/admin/osint/process", () => {
  beforeEach(() => {
    vi.resetModules();
    adminDenied = null;
    processSubmission.mockReset();
    queryRawUnsafe.mockReset();
    executeRawUnsafe.mockReset();
    processSubmission.mockResolvedValue({ idempotent: false, status: "AUTO_COMMITTED_SHADOW", imageSha256: "a".repeat(64), submissionId: "sub1", evidenceWritten: true, linksWritten: 0, poisoning: null, claims: [] });
  });

  it("401/403 passthrough when admin auth denies", async () => {
    const { NextResponse } = await import("next/server");
    adminDenied = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { status } = await post({ plan: PLAN });
    expect(status).toBe(401);
    expect(processSubmission).not.toHaveBeenCalled();
  });

  it("400 on malformed body (no plan)", async () => {
    const { status } = await post({ nope: true });
    expect(status).toBe(400);
  });

  it("412 when migrations are not applied", async () => {
    queryRawUnsafe.mockReset();
    queryRawUnsafe.mockResolvedValueOnce([]); // OsintSubmission missing
    const { status, json } = await post({ plan: PLAN });
    expect(status).toBe(412);
    expect(json.error).toMatch(/Migration/);
    expect(processSubmission).not.toHaveBeenCalled();
  });

  it("happy path → 200, defaults trustTier to anonymous_retail", async () => {
    migrationsApplied();
    const { status, json } = await post({ plan: PLAN });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.trustTier).toBe("anonymous_retail");
    expect(processSubmission).toHaveBeenCalledTimes(1);
    expect(processSubmission.mock.calls[0][1]).toBe("anonymous_retail");
  });

  it("honors an explicit valid trustTier", async () => {
    migrationsApplied();
    const { json } = await post({ plan: PLAN, trustTier: "investigator" });
    expect(json.trustTier).toBe("investigator");
    expect(processSubmission.mock.calls[0][1]).toBe("investigator");
  });

  it("invalid trustTier falls back to anonymous_retail", async () => {
    migrationsApplied();
    const { json } = await post({ plan: PLAN, trustTier: "root" });
    expect(json.trustTier).toBe("anonymous_retail");
  });

  it("idempotent passthrough → DUPLICATE result surfaces", async () => {
    migrationsApplied();
    processSubmission.mockResolvedValue({ idempotent: true, status: "DUPLICATE", imageSha256: "a".repeat(64), submissionId: "old", evidenceWritten: false, linksWritten: 0, poisoning: null, claims: [] });
    const { status, json } = await post({ plan: PLAN });
    expect(status).toBe(200);
    expect(json.result.status).toBe("DUPLICATE");
    expect(json.result.idempotent).toBe(true);
  });
});
