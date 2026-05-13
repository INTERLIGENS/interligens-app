import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { findFirst: vi.fn() },
    kolTokenLink: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { lookupCrossReferences } from "@/lib/reflex/cross-references";

const mockKolFind = vi.mocked(
  prisma.kolProfile.findFirst as unknown as (...a: unknown[]) => unknown,
);
const mockTokenLinkFind = vi.mocked(
  prisma.kolTokenLink.findMany as unknown as (...a: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
  mockKolFind.mockResolvedValue(null);
  mockTokenLinkFind.mockResolvedValue([]);
});

describe("lookupCrossReferences — kolProfile", () => {
  it("returns null kolProfile when no handle on input", async () => {
    const r = await lookupCrossReferences({ handle: null, address: null }, "en");
    expect(r.kolProfile).toBeNull();
    expect(mockKolFind).not.toHaveBeenCalled();
  });

  it("returns kolProfile when handle matches", async () => {
    mockKolFind.mockResolvedValue({ handle: "donwedge", displayName: "Don Wedge" });
    const r = await lookupCrossReferences({ handle: "donwedge", address: null }, "en");
    expect(r.kolProfile).toEqual({
      handle: "donwedge",
      displayName: "Don Wedge",
      url: "/en/kol/donwedge",
    });
  });

  it("returns null when handle does not match any KolProfile", async () => {
    mockKolFind.mockResolvedValue(null);
    const r = await lookupCrossReferences({ handle: "unknownkol", address: null }, "en");
    expect(r.kolProfile).toBeNull();
  });

  it("URL respects locale (fr)", async () => {
    mockKolFind.mockResolvedValue({ handle: "donwedge", displayName: null });
    const r = await lookupCrossReferences({ handle: "donwedge", address: null }, "fr");
    expect(r.kolProfile?.url).toBe("/fr/kol/donwedge");
  });

  it("queries Prisma case-insensitive on handle", async () => {
    await lookupCrossReferences({ handle: "DonWedge", address: null }, "en");
    expect(mockKolFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { handle: { equals: "DonWedge", mode: "insensitive" } },
      }),
    );
  });
});

describe("lookupCrossReferences — casefiles", () => {
  it("returns [] when no address on input", async () => {
    const r = await lookupCrossReferences({ handle: null, address: null }, "en");
    expect(r.casefiles).toEqual([]);
    expect(mockTokenLinkFind).not.toHaveBeenCalled();
  });

  it("returns linked casefiles when address matches", async () => {
    mockTokenLinkFind.mockResolvedValue([
      { caseId: "BOTIFY" },
      { caseId: "BOTIFY" }, // dedup
      { caseId: "RAVE" },
    ]);
    const r = await lookupCrossReferences({ handle: null, address: "0xabc" }, "en");
    expect(r.casefiles).toHaveLength(2);
    expect(r.casefiles.map((c) => c.caseId).sort()).toEqual(["BOTIFY", "RAVE"]);
    expect(r.casefiles[0].url).toMatch(/^\/investigators\/box\/cases\//);
  });

  it("filters out links with null caseId", async () => {
    mockTokenLinkFind.mockResolvedValue([
      { caseId: null },
      { caseId: "BOTIFY" },
    ]);
    const r = await lookupCrossReferences({ handle: null, address: "0xabc" }, "en");
    expect(r.casefiles).toEqual([
      { caseId: "BOTIFY", url: "/investigators/box/cases/BOTIFY" },
    ]);
  });

  it("casefile URL does NOT carry a locale prefix (route is locale-agnostic)", async () => {
    mockTokenLinkFind.mockResolvedValue([{ caseId: "BOTIFY" }]);
    const r = await lookupCrossReferences({ handle: null, address: "0xabc" }, "fr");
    expect(r.casefiles[0].url).toBe("/investigators/box/cases/BOTIFY");
  });
});

describe("lookupCrossReferences — combined", () => {
  it("returns both kolProfile and casefiles when both match", async () => {
    mockKolFind.mockResolvedValue({ handle: "donwedge", displayName: null });
    mockTokenLinkFind.mockResolvedValue([{ caseId: "BOTIFY" }]);
    const r = await lookupCrossReferences(
      { handle: "donwedge", address: "0xabc" },
      "en",
    );
    expect(r.kolProfile?.handle).toBe("donwedge");
    expect(r.casefiles).toHaveLength(1);
  });
});
