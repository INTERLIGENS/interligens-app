import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmScore: { findMany: vi.fn() },
    mmScanRun: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/mm/registry/entities", () => ({
  getEntityFull: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: { args: [], executablePath: vi.fn() },
}));

vi.mock("puppeteer-core", () => ({
  default: { launch: vi.fn() },
}));

import {
  buildReportInput,
  generateMmReport,
  readReportCache,
  MmReportError,
} from "@/lib/mm/reporting/pdfReport";
import { getEntityFull } from "@/lib/mm/registry/entities";
import { prisma } from "@/lib/prisma";

const now = new Date("2026-04-01T12:00:00Z");

function entityFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e1",
    slug: "dione-protocol",
    name: "Dione Protocol",
    legalName: null,
    jurisdiction: null,
    foundedYear: null,
    founders: [],
    status: "CONVICTED",
    riskBand: "RED",
    defaultScore: 95,
    publicSummary: "summary",
    publicSummaryFr: null,
    workflow: "PUBLISHED",
    publishedAt: now,
    updatedAt: now,
    claims: [],
    attributions: [],
    ...overrides,
  };
}

describe("buildReportInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.mmScore.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmScanRun.findMany).mockResolvedValue([]);
  });

  it("returns null when the entity does not exist", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(null as never);
    const out = await buildReportInput("missing");
    expect(out).toBeNull();
  });

  it("maps claims/attributions from the registry into the snapshot", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(
      entityFixture({
        claims: [
          {
            id: "c1",
            claimType: "FACT",
            text: "t",
            textFr: null,
            jurisdiction: null,
            orderIndex: 0,
            source: {
              id: "s1",
              publisher: "SEC",
              title: "doc",
              url: "https://sec.gov/x",
              sourceType: "COURT_FILING",
              credibilityTier: "TIER_A",
              publishedAt: now,
            },
          },
        ],
        attributions: [
          {
            id: "a1",
            walletAddress: "WALLET1111111111111111111111111111",
            chain: "SOLANA",
            attributionMethod: "COURT_FILING",
            confidence: 0.95,
            reviewedAt: now,
            createdAt: now,
            revokedAt: null,
          },
        ],
      }) as never,
    );
    const snap = await buildReportInput("dione-protocol");
    expect(snap).not.toBeNull();
    expect(snap!.claims).toHaveLength(1);
    expect(snap!.claims[0].claimType).toBe("FACT");
    expect(snap!.attributions).toHaveLength(1);
    expect(snap!.attributions[0].walletAddress).toContain("WALLET1");
  });
});

describe("generateMmReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.mmScore.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmScanRun.findMany).mockResolvedValue([]);
  });

  it("throws 404 MmReportError when entity is missing", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(null as never);
    await expect(generateMmReport("nope")).rejects.toMatchObject({
      status: 404,
      message: "entity_not_found",
    });
  });

  it("throws 403 MmReportError for non-published entity without allowDraft", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(
      entityFixture({ workflow: "DRAFT" }) as never,
    );
    await expect(generateMmReport("draft-entity")).rejects.toBeInstanceOf(MmReportError);
    await expect(generateMmReport("draft-entity")).rejects.toMatchObject({ status: 403 });
  });

  it("renders a DRAFT entity when allowDraft=true", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(
      entityFixture({ workflow: "DRAFT" }) as never,
    );
    const render = vi.fn().mockResolvedValue(Buffer.from("%PDF-FAKE"));
    const result = await generateMmReport("draft-entity", {
      allowDraft: true,
      bypassCache: true,
      skipCacheWrite: true,
      hooks: { render },
    });
    expect(render).toHaveBeenCalledOnce();
    expect(result.source).toBe("render");
    expect(result.pdf.toString("utf8").startsWith("%PDF")).toBe(true);
  });

  it("passes the rendered HTML to the injected render hook", async () => {
    vi.mocked(getEntityFull).mockResolvedValue(entityFixture() as never);
    const render = vi.fn().mockResolvedValue(Buffer.from("pdf"));
    await generateMmReport("dione-protocol", {
      bypassCache: true,
      skipCacheWrite: true,
      hooks: { render },
    });
    const html = render.mock.calls[0][0];
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Dione Protocol");
  });
});

describe("readReportCache", () => {
  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
  });

  it("returns null when R2 is not configured (no creds in env)", async () => {
    const cached = await readReportCache("dione-protocol", { now });
    expect(cached).toBeNull();
  });
});
