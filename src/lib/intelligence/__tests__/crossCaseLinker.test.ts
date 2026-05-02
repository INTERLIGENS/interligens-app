import { describe, it, expect, vi, beforeEach } from "vitest";
import { findCrossLinks, persistCrossLinks } from "../crossCaseLinker";

// Mock prisma to avoid DB dependency in unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

const mockQueryRaw = vi.mocked(prisma.$queryRaw as ReturnType<typeof vi.fn>);
const mockExecuteRaw = vi.mocked(prisma.$executeRaw as ReturnType<typeof vi.fn>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findCrossLinks", () => {
  it("returns [] if handle is empty", async () => {
    const result = await findCrossLinks("");
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns [] when KOL has no wallets and no tokens", async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // KolWallet empty
    mockQueryRaw.mockResolvedValueOnce([]); // KolTokenInvolvement empty
    const result = await findCrossLinks("testkol");
    expect(result).toEqual([]);
  });

  it("returns shared_wallet link when another KOL shares an address", async () => {
    const addr = "Abc123";
    mockQueryRaw
      .mockResolvedValueOnce([{ address: addr, chain: "SOL", label: "Hot wallet" }]) // source wallets
      .mockResolvedValueOnce([{ kolHandle: "otherkol", address: addr, chain: "SOL" }]) // shared wallets
      .mockResolvedValueOnce([]) // source tokens
    const links = await findCrossLinks("testkol");
    expect(links).toHaveLength(1);
    expect(links[0].linkType).toBe("shared_wallet");
    expect(links[0].sourceHandle).toBe("testkol");
    expect(links[0].targetHandle).toBe("otherkol");
    expect(links[0].confidence).toBe("exact");
  });

  it("returns shared_token link when another KOL promoted the same token", async () => {
    const mint = "TokenMint111";
    mockQueryRaw
      .mockResolvedValueOnce([]) // no wallets
      .mockResolvedValueOnce([{ tokenMint: mint, kolHandle: "testkol" }]) // source tokens
      .mockResolvedValueOnce([{ tokenMint: mint, kolHandle: "scammer2" }]); // shared token kols
    const links = await findCrossLinks("testkol");
    expect(links).toHaveLength(1);
    expect(links[0].linkType).toBe("shared_token");
    expect(links[0].confidence).toBe("probable");
  });

  it("deduplicates shared_token links for the same target", async () => {
    const mint1 = "Mint111";
    const mint2 = "Mint222";
    mockQueryRaw
      .mockResolvedValueOnce([]) // no wallets
      .mockResolvedValueOnce([
        { tokenMint: mint1, kolHandle: "testkol" },
        { tokenMint: mint2, kolHandle: "testkol" },
      ])
      .mockResolvedValueOnce([
        { tokenMint: mint1, kolHandle: "scammer3" },
        { tokenMint: mint2, kolHandle: "scammer3" },
      ]);
    const links = await findCrossLinks("testkol");
    const tokenLinks = links.filter((l) => l.linkType === "shared_token" && l.targetHandle === "scammer3");
    expect(tokenLinks).toHaveLength(1);
  });
});

describe("persistCrossLinks", () => {
  it("is a no-op when links array is empty", async () => {
    await persistCrossLinks([]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("calls $executeRaw once per link", async () => {
    mockExecuteRaw.mockResolvedValue(1);
    const links = [
      {
        sourceHandle: "kol_a",
        targetHandle: "kol_b",
        linkType: "shared_wallet" as const,
        confidence: "exact" as const,
        evidence: ["wallet X"],
        detectedAt: new Date(),
      },
      {
        sourceHandle: "kol_a",
        targetHandle: "kol_c",
        linkType: "shared_token" as const,
        confidence: "probable" as const,
        evidence: ["token Y"],
        detectedAt: new Date(),
      },
    ];
    await persistCrossLinks(links);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
  });
});
