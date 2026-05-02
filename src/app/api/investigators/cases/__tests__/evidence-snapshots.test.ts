/**
 * Evidence Snapshots route tests.
 *
 * Verifies auth enforcement, input validation, hash generation, and audit log
 * write for POST /api/investigators/cases/[caseId]/evidence-snapshots.
 * GET is also smoke-tested for auth.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/vault/auth.server", () => ({
  getVaultWorkspace: vi.fn(),
  assertCaseOwnership: vi.fn(),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vaultEvidenceSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    vaultCaseEntity: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  GET,
  POST,
} from "../[caseId]/evidence-snapshots/route";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { prisma } from "@/lib/prisma";

const mockedGetWorkspace = vi.mocked(getVaultWorkspace);
const mockedOwnership = vi.mocked(assertCaseOwnership);
const mockedLogAudit = vi.mocked(logAudit);
const mockedCreate = vi.mocked(prisma.vaultEvidenceSnapshot.create);
const mockedEntityFind = vi.mocked(prisma.vaultCaseEntity.findFirst);

const VALID_CTX = {
  access: { id: "acc_1", label: "BA-01" },
  profile: { id: "prof_1" },
  workspace: { id: "ws_1" },
};
const CASE_ID = "case_abc";
const ROUTE_CTX = { params: Promise.resolve({ caseId: CASE_ID }) };

function makeReq(
  method: "GET" | "POST",
  body?: unknown
): NextRequest {
  return new NextRequest(
    `https://example.test/api/investigators/cases/${CASE_ID}/evidence-snapshots`,
    {
      method,
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetWorkspace.mockResolvedValue(VALID_CTX as never);
  mockedOwnership.mockResolvedValue({ caseId: CASE_ID });
  mockedEntityFind.mockResolvedValue(null);
  mockedCreate.mockResolvedValue({
    id: "snap_001",
    caseId: CASE_ID,
    workspaceId: "ws_1",
    investigatorAccessId: "acc_1",
    url: "https://example.com",
    title: "Test snapshot",
    sourceType: "WEBSITE",
    note: null,
    tags: [],
    relatedEntityId: null,
    publishability: "PRIVATE",
    contentHashSha256: "abc123",
    capturedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
});

// ── GET ───────────────────────────────────────────────────────────────

describe("GET /evidence-snapshots", () => {
  it("401 when no session", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(401);
  });

  it("returns snapshots array when authorized", async () => {
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.snapshots)).toBe(true);
  });
});

// ── POST ─────────────────────────────────────────────────────────────

describe("POST /evidence-snapshots", () => {
  it("401 when no session", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", { title: "test" }), ROUTE_CTX);
    expect(res.status).toBe(401);
  });

  it("400 when title missing and no URL", async () => {
    const res = await POST(makeReq("POST", {}), ROUTE_CTX);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("title_required");
  });

  it("400 when URL is invalid", async () => {
    const res = await POST(
      makeReq("POST", { title: "test", url: "not-a-url" }),
      ROUTE_CTX
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_url");
  });

  it("400 when relatedEntityId not in case", async () => {
    mockedEntityFind.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq("POST", {
        title: "test",
        relatedEntityId: "entity_other_case",
      }),
      ROUTE_CTX
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("related_entity_not_in_case");
  });

  it("creates snapshot with PRIVATE default when publishability omitted", async () => {
    const res = await POST(
      makeReq("POST", { title: "Snapshot test" }),
      ROUTE_CTX
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.snapshot).toBeDefined();
    const call = mockedCreate.mock.calls[0][0];
    expect(call.data.publishability).toBe("PRIVATE");
  });

  it("generates contentHashSha256 (non-empty string)", async () => {
    await POST(makeReq("POST", { title: "Hash test" }), ROUTE_CTX);
    const call = mockedCreate.mock.calls[0][0];
    expect(typeof call.data.contentHashSha256).toBe("string");
    expect(call.data.contentHashSha256.length).toBe(64);
  });

  it("writes audit log on success", async () => {
    await POST(makeReq("POST", { title: "Audit test" }), ROUTE_CTX);
    expect(mockedLogAudit).toHaveBeenCalledOnce();
    const auditCall = mockedLogAudit.mock.calls[0][0];
    expect(auditCall.action).toBe("EVIDENCE_SNAPSHOT_CREATED");
    expect(auditCall.caseId).toBe(CASE_ID);
  });

  it("uses entity from case when relatedEntityId is valid", async () => {
    mockedEntityFind.mockResolvedValueOnce({ id: "entity_valid" } as never);
    const res = await POST(
      makeReq("POST", { title: "Linked snapshot", relatedEntityId: "entity_valid" }),
      ROUTE_CTX
    );
    expect(res.status).toBe(200);
    const call = mockedCreate.mock.calls[0][0];
    expect(call.data.relatedEntityId).toBe("entity_valid");
  });

  it("falls back title to URL hostname when title omitted", async () => {
    await POST(
      makeReq("POST", { url: "https://etherscan.io/tx/0xabc" }),
      ROUTE_CTX
    );
    const call = mockedCreate.mock.calls[0][0];
    expect(call.data.title).toBe("etherscan.io");
  });

  it("normalizes sourceType to OTHER for unknown values", async () => {
    await POST(
      makeReq("POST", { title: "test", sourceType: "UNKNOWN_PLATFORM" }),
      ROUTE_CTX
    );
    const call = mockedCreate.mock.calls[0][0];
    expect(call.data.sourceType).toBe("OTHER");
  });

  it("sets capturedAt server-side (not from client)", async () => {
    const before = Date.now();
    await POST(makeReq("POST", { title: "timing test" }), ROUTE_CTX);
    const after = Date.now();
    const call = mockedCreate.mock.calls[0][0];
    const captured = new Date(call.data.capturedAt).getTime();
    expect(captured).toBeGreaterThanOrEqual(before);
    expect(captured).toBeLessThanOrEqual(after);
  });
});
