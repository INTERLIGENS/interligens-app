import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmEntity: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: () => "1.2.3.4",
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
  detectLocale: () => "en",
  RATE_LIMIT_PRESETS: { scan: { windowMs: 60_000, max: 30 } },
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { method: "GET", headers });
}

describe("GET /api/mobile/v1/mm/entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOBILE_API_TOKEN = "mob_secret_xyz";
  });

  it("rejects missing auth with 401", async () => {
    const res = await GET(req("/api/mobile/v1/mm/entities"));
    expect(res.status).toBe(401);
  });

  it("only queries PUBLISHED + CHALLENGED workflows", async () => {
    vi.mocked(prisma.mmEntity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmEntity.count).mockResolvedValue(0);

    await GET(
      req("/api/mobile/v1/mm/entities", {
        "X-Mobile-Api-Token": "mob_secret_xyz",
      }),
    );

    const arg = vi.mocked(prisma.mmEntity.findMany).mock.calls[0][0];
    expect(arg?.where?.workflow).toEqual({ in: ["PUBLISHED", "CHALLENGED"] });
  });

  it("passes the status filter through when valid", async () => {
    vi.mocked(prisma.mmEntity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmEntity.count).mockResolvedValue(0);

    await GET(
      req("/api/mobile/v1/mm/entities?status=CONVICTED", {
        "X-Mobile-Api-Token": "mob_secret_xyz",
      }),
    );

    const arg = vi.mocked(prisma.mmEntity.findMany).mock.calls[0][0];
    expect(arg?.where?.status).toBe("CONVICTED");
  });

  it("ignores an unknown status value (falls back to workflow-only filter)", async () => {
    vi.mocked(prisma.mmEntity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmEntity.count).mockResolvedValue(0);

    await GET(
      req("/api/mobile/v1/mm/entities?status=BOGUS", {
        "X-Mobile-Api-Token": "mob_secret_xyz",
      }),
    );

    const arg = vi.mocked(prisma.mmEntity.findMany).mock.calls[0][0];
    expect(arg?.where?.status).toBeUndefined();
  });

  it("returns an entity list with shape { total, limit, offset, entities[] }", async () => {
    vi.mocked(prisma.mmEntity.findMany).mockResolvedValue([
      {
        slug: "dione-protocol",
        name: "Dione Protocol",
        legalName: null,
        status: "CONVICTED",
        riskBand: "RED",
        defaultScore: 95,
        publicSummary: "en summary",
        publicSummaryFr: "résumé fr",
        updatedAt: new Date("2026-04-01T12:00:00Z"),
        workflow: "PUBLISHED",
      },
    ] as never);
    vi.mocked(prisma.mmEntity.count).mockResolvedValue(1);

    const res = await GET(
      req("/api/mobile/v1/mm/entities?limit=5", {
        "X-Mobile-Api-Token": "mob_secret_xyz",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.limit).toBe(5);
    expect(body.entities).toHaveLength(1);
    expect(body.entities[0]).toMatchObject({
      slug: "dione-protocol",
      summary: "résumé fr",
      workflow: "PUBLISHED",
    });
  });

  it("clamps limit above 100 to 100", async () => {
    vi.mocked(prisma.mmEntity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.mmEntity.count).mockResolvedValue(0);

    const res = await GET(
      req("/api/mobile/v1/mm/entities?limit=999", {
        "X-Mobile-Api-Token": "mob_secret_xyz",
      }),
    );
    const body = await res.json();
    expect(body.limit).toBe(100);
  });
});
