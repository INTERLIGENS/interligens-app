import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmEntity: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: () => "1.2.3.4",
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
  RATE_LIMIT_PRESETS: { pdf: { windowMs: 60_000, max: 10 } },
}));

vi.mock("@/lib/mm/reporting/pdfReport", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mm/reporting/pdfReport")>(
    "@/lib/mm/reporting/pdfReport",
  );
  return {
    ...actual,
    generateMmReport: vi.fn(),
  };
});

import { GET } from "../[slug]/report/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateMmReport,
  MmReportError,
} from "@/lib/mm/reporting/pdfReport";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: "GET", headers });
}

describe("GET /api/v1/mm/entity/[slug]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = "adm_secret_123";
    process.env.MM_API_TOKEN = "mm_api_secret_456";
  });

  it("returns 401 for an unauth caller when entity is DRAFT", async () => {
    vi.mocked(prisma.mmEntity.findUnique).mockResolvedValue({
      workflow: "DRAFT",
    } as never);
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/draft-ent/report"),
      { params: Promise.resolve({ slug: "draft-ent" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unauth caller when entity does not exist", async () => {
    vi.mocked(prisma.mmEntity.findUnique).mockResolvedValue(null);
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/nope/report"),
      { params: Promise.resolve({ slug: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("allows an unauth caller to fetch a PUBLISHED entity (rate-limited)", async () => {
    vi.mocked(prisma.mmEntity.findUnique).mockResolvedValue({
      workflow: "PUBLISHED",
    } as never);
    vi.mocked(generateMmReport).mockResolvedValue({
      pdf: Buffer.from("%PDF-FAKE"),
      source: "render",
      cacheKey: null,
      slug: "pub",
      generatedAt: new Date(),
    });
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/pub/report"),
      { params: Promise.resolve({ slug: "pub" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-mm-report-source")).toBe("render");
  });

  it("refuses allowDraft=1 query param for non-admin (MM_API_TOKEN) caller", async () => {
    vi.mocked(generateMmReport).mockImplementation(async (_slug, opts) => {
      // Should be called with allowDraft=false even though query string said 1.
      expect(opts?.allowDraft).toBe(false);
      return {
        pdf: Buffer.from("%PDF-FAKE"),
        source: "render",
        cacheKey: null,
        slug: "pub",
        generatedAt: new Date(),
      };
    });
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/pub/report?allowDraft=1", {
        "x-api-token": "mm_api_secret_456",
      }),
      { params: Promise.resolve({ slug: "pub" }) },
    );
    expect(res.status).toBe(200);
  });

  it("honors allowDraft=1 for an admin token caller", async () => {
    vi.mocked(generateMmReport).mockImplementation(async (_slug, opts) => {
      expect(opts?.allowDraft).toBe(true);
      expect(opts?.bypassCache).toBe(true);
      return {
        pdf: Buffer.from("%PDF-FAKE"),
        source: "render",
        cacheKey: null,
        slug: "draft-ent",
        generatedAt: new Date(),
      };
    });
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/draft-ent/report?allowDraft=1&bypassCache=1", {
        "x-api-token": "adm_secret_123",
      }),
      { params: Promise.resolve({ slug: "draft-ent" }) },
    );
    expect(res.status).toBe(200);
  });

  it("maps MmReportError.status through to the HTTP response", async () => {
    vi.mocked(prisma.mmEntity.findUnique).mockResolvedValue({
      workflow: "PUBLISHED",
    } as never);
    vi.mocked(generateMmReport).mockRejectedValue(
      new MmReportError("forced_failure", 500),
    );
    const res = await GET(
      req("http://localhost/api/v1/mm/entity/pub/report"),
      { params: Promise.resolve({ slug: "pub" }) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("forced_failure");
  });
});
