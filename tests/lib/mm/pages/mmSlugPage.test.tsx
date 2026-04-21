// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock surfaces used by the server component ───────────────────────────
const getEntityFull = vi.fn();
vi.mock("@/lib/mm/registry/entities", () => ({
  getEntityFull: (...args: unknown[]) => getEntityFull(...args),
}));

const headersMap = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => headersMap.get(k.toLowerCase()) ?? null,
  }),
}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

import MmEntityPage from "@/app/mm/[slug]/page";

function baseEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: "ent-1",
    slug: "gotbit",
    name: "Gotbit",
    legalName: "Gotbit Consulting",
    jurisdiction: "US",
    foundedYear: 2017,
    founders: ["Aleksei Andriunin"],
    status: "CONVICTED",
    riskBand: "RED",
    defaultScore: 95,
    publicSummary: "Market maker condamné en 2025.",
    publicSummaryFr: "Market maker condamné en 2025.",
    knownAliases: [],
    officialDomains: ["gotbit.io"],
    workflow: "DRAFT",
    publishedAt: null,
    updatedAt: new Date("2026-04-15"),
    createdAt: new Date("2026-04-15"),
    claims: [],
    attributions: [],
    ...overrides,
  };
}

describe("/mm/[slug] page", () => {
  beforeEach(() => {
    getEntityFull.mockReset();
    notFound.mockClear();
    headersMap.clear();
    delete process.env.ADMIN_TOKEN;
  });

  it("calls notFound() when the entity does not exist", async () => {
    getEntityFull.mockResolvedValue(null);
    await expect(
      MmEntityPage({ params: Promise.resolve({ slug: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound() when the entity is DRAFT and no admin token", async () => {
    getEntityFull.mockResolvedValue(baseEntity({ workflow: "DRAFT" }));
    await expect(
      MmEntityPage({ params: Promise.resolve({ slug: "gotbit" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the entity when workflow=PUBLISHED", async () => {
    getEntityFull.mockResolvedValue(
      baseEntity({ workflow: "PUBLISHED", publishedAt: new Date() }),
    );
    const result = await MmEntityPage({
      params: Promise.resolve({ slug: "gotbit" }),
    });
    expect(notFound).not.toHaveBeenCalled();
    expect(result).toBeTruthy(); // a React element
  });

  it("renders the entity when workflow=CHALLENGED", async () => {
    getEntityFull.mockResolvedValue(
      baseEntity({ workflow: "CHALLENGED", publishedAt: new Date() }),
    );
    const result = await MmEntityPage({
      params: Promise.resolve({ slug: "gotbit" }),
    });
    expect(result).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("admin token unlocks DRAFT workflows", async () => {
    process.env.ADMIN_TOKEN = "super-secret";
    headersMap.set("x-admin-token", "super-secret");
    getEntityFull.mockResolvedValue(baseEntity({ workflow: "DRAFT" }));
    const result = await MmEntityPage({
      params: Promise.resolve({ slug: "gotbit" }),
    });
    expect(result).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("sets robots=noindex metadata for non-published workflows", async () => {
    const { generateMetadata } = await import("@/app/mm/[slug]/page");
    getEntityFull.mockResolvedValue(baseEntity({ workflow: "DRAFT" }));
    const m = await generateMetadata({
      params: Promise.resolve({ slug: "gotbit" }),
    });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("sets robots=index metadata for PUBLISHED workflows", async () => {
    const { generateMetadata } = await import("@/app/mm/[slug]/page");
    getEntityFull.mockResolvedValue(baseEntity({ workflow: "PUBLISHED" }));
    const m = await generateMetadata({
      params: Promise.resolve({ slug: "gotbit" }),
    });
    expect(m.robots).toEqual({ index: true, follow: true });
  });
});
