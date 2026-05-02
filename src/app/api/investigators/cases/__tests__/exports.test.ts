/**
 * IOC Export route tests.
 *
 * Verifies auth, case ownership, format validation, publishability filtering,
 * audit log, and export record creation for POST /api/investigators/cases/[caseId]/exports.
 * GET is smoke-tested for auth and ownership.
 */

import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/vault/auth.server", () => ({
  getVaultWorkspace: vi.fn(),
  assertCaseOwnership: vi.fn(),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vaultCase: {
      findUniqueOrThrow: vi.fn(),
    },
    vaultCaseEntity: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    vaultEvidenceSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    caseExport: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/vault/iocExportPdf", () => ({
  buildPoliceAnnexHtml: vi.fn().mockReturnValue("<html>annex</html>"),
  renderPoliceAnnexPdf: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
}));

import { GET, POST } from "../[caseId]/exports/route";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { prisma } from "@/lib/prisma";

const mockedGetWorkspace = vi.mocked(getVaultWorkspace);
const mockedOwnership = vi.mocked(assertCaseOwnership);
const mockedLogAudit = vi.mocked(logAudit);
const mockedCaseFind = vi.mocked(prisma.vaultCase.findUniqueOrThrow);
const mockedEntityFind = vi.mocked(prisma.vaultCaseEntity.findMany);
const mockedSnapshotFind = vi.mocked(prisma.vaultEvidenceSnapshot.findMany);
const mockedExportCreate = vi.mocked(prisma.caseExport.create);
const mockedExportList = vi.mocked(prisma.caseExport.findMany);

const VALID_CTX = {
  access: { id: "acc_1", label: "BA-01" },
  profile: { id: "prof_1" },
  workspace: { id: "ws_1" },
};

const CASE_ID = "case_abc";
const ROUTE_CTX = { params: Promise.resolve({ caseId: CASE_ID }) };

const BASE_CASE = {
  id: CASE_ID,
  workspaceId: "ws_1",
  status: "PRIVATE",
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
};

function makeReq(method: "GET" | "POST", body?: unknown): NextRequest {
  return new NextRequest(
    `https://example.test/api/investigators/cases/${CASE_ID}/exports`,
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
  mockedCaseFind.mockResolvedValue(BASE_CASE as never);
  mockedEntityFind.mockResolvedValue([]);
  mockedSnapshotFind.mockResolvedValue([]);
  mockedExportCreate.mockResolvedValue({ id: "exp_001" } as never);
  mockedExportList.mockResolvedValue([]);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /exports", () => {
  it("returns 401 when not authenticated", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(401);
  });

  it("returns 403 when case not owned", async () => {
    mockedOwnership.mockResolvedValueOnce(
      NextResponse.json({ error: "forbidden" }, { status: 403 }) as never
    );
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(403);
  });

  it("returns empty list when no exports exist", async () => {
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exports).toEqual([]);
  });
});

// ── Format validation ─────────────────────────────────────────────────────────

describe("POST /exports — format validation", () => {
  it("returns 401 when not authenticated", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(res.status).toBe(401);
  });

  it("returns 403 when case not owned", async () => {
    mockedOwnership.mockResolvedValueOnce(
      NextResponse.json({ error: "forbidden" }, { status: 403 }) as never
    );
    const res = await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(res.status).toBe(403);
  });

  it("rejects invalid format", async () => {
    const res = await POST(makeReq("POST", { format: "INVALID" }), ROUTE_CTX);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_format");
  });

  it("rejects missing format", async () => {
    const res = await POST(makeReq("POST", {}), ROUTE_CTX);
    expect(res.status).toBe(400);
  });
});

// ── CSV_FULL ──────────────────────────────────────────────────────────────────

describe("POST /exports — CSV_FULL", () => {
  it("returns CSV content and metadata", async () => {
    const res = await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.format).toBe("CSV_FULL");
    expect(data.mimeType).toBe("text/csv");
    expect(typeof data.contentText).toBe("string");
    expect(data.exportHashSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("writes audit log", async () => {
    await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CASE_EXPORT_CREATED",
        caseId: CASE_ID,
        workspaceId: "ws_1",
      })
    );
  });

  it("creates CaseExport record", async () => {
    await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(mockedExportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exportFormat: "CSV_FULL",
          caseId: CASE_ID,
        }),
      })
    );
  });
});

// ── JSON_STRUCTURED ───────────────────────────────────────────────────────────

describe("POST /exports — JSON_STRUCTURED", () => {
  it("returns JSON content with exportMeta", async () => {
    const res = await POST(
      makeReq("POST", { format: "JSON_STRUCTURED", caseTitle: "Test Case" }),
      ROUTE_CTX
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const parsed = JSON.parse(data.contentText);
    expect(parsed.exportMeta.format).toBe("JSON_STRUCTURED");
    expect(parsed.legalNote).toBeDefined();
    expect(parsed.excluded).toBeDefined();
  });

  it("includes all publishability statuses for internal export", async () => {
    const res = await POST(
      makeReq("POST", { format: "JSON_STRUCTURED", includePrivate: true }),
      ROUTE_CTX
    );
    const data = await res.json();
    expect(data.format).toBe("JSON_STRUCTURED");
  });
});

// ── STIX_LIKE_JSON ────────────────────────────────────────────────────────────

describe("POST /exports — STIX_LIKE_JSON", () => {
  it("returns bundle with spec_version", async () => {
    const res = await POST(makeReq("POST", { format: "STIX_LIKE_JSON" }), ROUTE_CTX);
    const data = await res.json();
    const parsed = JSON.parse(data.contentText);
    expect(parsed.type).toBe("bundle");
    expect(parsed.spec_version).toBe("interligens-stix-like-1.0");
    expect(Array.isArray(parsed.objects)).toBe(true);
    expect(parsed.x_interligens_export.exportHashSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── THREAT_INTEL_CSV ──────────────────────────────────────────────────────────

describe("POST /exports — THREAT_INTEL_CSV", () => {
  it("returns CSV with correct header", async () => {
    const res = await POST(makeReq("POST", { format: "THREAT_INTEL_CSV" }), ROUTE_CTX);
    const data = await res.json();
    expect(data.mimeType).toBe("text/csv");
    expect(data.contentText).toContain("indicator_type");
  });

  it("PRIVATE snapshots are excluded from Threat Intel", async () => {
    mockedSnapshotFind.mockResolvedValueOnce([
      {
        id: "snap_1",
        caseId: CASE_ID,
        workspaceId: "ws_1",
        investigatorAccessId: "acc_1",
        url: "https://example.com",
        title: "Private snapshot",
        sourceType: "WEBSITE",
        note: null,
        tags: [],
        relatedEntityId: null,
        publishability: "PRIVATE",
        contentHashSha256: "abc123",
        capturedAt: new Date("2026-05-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
      } as never,
    ]);
    const res = await POST(makeReq("POST", { format: "THREAT_INTEL_CSV" }), ROUTE_CTX);
    const data = await res.json();
    expect(data.iocCount).toBe(0);
    expect(data.privateExcluded).toBe(1);
  });
});

// ── POLICE_ANNEX_PDF ──────────────────────────────────────────────────────────

describe("POST /exports — POLICE_ANNEX_PDF", () => {
  it("returns base64 PDF content", async () => {
    const res = await POST(makeReq("POST", { format: "POLICE_ANNEX_PDF" }), ROUTE_CTX);
    const data = await res.json();
    expect(data.mimeType).toBe("application/pdf");
    expect(data.encoding).toBe("base64");
    expect(typeof data.contentBase64).toBe("string");
  });

  it("PRIVATE entities excluded from police annex", async () => {
    mockedSnapshotFind.mockResolvedValueOnce([
      {
        id: "snap_priv",
        caseId: CASE_ID,
        workspaceId: "ws_1",
        investigatorAccessId: "acc_1",
        url: null,
        title: "Secret snapshot",
        sourceType: "OTHER",
        note: null,
        tags: [],
        relatedEntityId: null,
        publishability: "PRIVATE",
        contentHashSha256: "xyz",
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
    const res = await POST(makeReq("POST", { format: "POLICE_ANNEX_PDF" }), ROUTE_CTX);
    const data = await res.json();
    expect(data.privateExcluded).toBe(1);
  });
});

// ── PUBLISHABLE snapshots ─────────────────────────────────────────────────────

describe("publishability — PUBLISHABLE snapshots in Threat Intel", () => {
  it("includes PUBLISHABLE snapshot in THREAT_INTEL_CSV", async () => {
    mockedSnapshotFind.mockResolvedValueOnce([
      {
        id: "snap_pub",
        caseId: CASE_ID,
        workspaceId: "ws_1",
        investigatorAccessId: "acc_1",
        url: "https://x.com/suspicious",
        title: "Public evidence",
        sourceType: "X_POST",
        note: null,
        tags: ["rug"],
        relatedEntityId: null,
        publishability: "PUBLISHABLE",
        contentHashSha256: "pubhash",
        capturedAt: new Date("2026-05-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
      } as never,
    ]);
    const res = await POST(makeReq("POST", { format: "THREAT_INTEL_CSV" }), ROUTE_CTX);
    const data = await res.json();
    expect(data.iocCount).toBe(1);
    expect(data.privateExcluded).toBe(0);
  });
});

// ── No public exposure ────────────────────────────────────────────────────────

describe("route is not publicly accessible", () => {
  it("GET returns 401 without session", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await GET(makeReq("GET"), ROUTE_CTX);
    expect(res.status).toBe(401);
  });

  it("POST returns 401 without session", async () => {
    mockedGetWorkspace.mockResolvedValueOnce(null);
    const res = await POST(makeReq("POST", { format: "CSV_FULL" }), ROUTE_CTX);
    expect(res.status).toBe(401);
  });
});
