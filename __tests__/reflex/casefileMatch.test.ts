import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolCase: { findMany: vi.fn() },
    kolWallet: { findMany: vi.fn() },
    kolTokenLink: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { runCasefileMatch } from "@/lib/reflex/casefileMatch";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockCaseFindMany = vi.mocked(
  prisma.kolCase.findMany as unknown as (...a: unknown[]) => unknown,
);
const mockWalletFindMany = vi.mocked(
  prisma.kolWallet.findMany as unknown as (...a: unknown[]) => unknown,
);
const mockTokenLinkFindMany = vi.mocked(
  prisma.kolTokenLink.findMany as unknown as (...a: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("casefileMatch adapter", () => {
  it("handle path: emits CRITICAL stopTrigger=true when KOL has cases", async () => {
    mockCaseFindMany.mockResolvedValue([{ caseId: "BOTIFY" }, { caseId: "RAVE" }]);
    const r = await runCasefileMatch({
      type: "X_HANDLE",
      handle: "donwedge",
      raw: "@donwedge",
    });
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("CRITICAL");
    expect(r.signals[0].stopTrigger).toBe(true);
    expect(r.raw?.matchedVia).toBe("kolCase.kolHandle");
    expect((r.raw?.caseIds ?? []).sort()).toEqual(["BOTIFY", "RAVE"]);
  });

  it("handle path: no match when KOL has 0 cases", async () => {
    mockCaseFindMany.mockResolvedValue([]);
    const r = await runCasefileMatch({
      type: "X_HANDLE",
      handle: "newkol",
      raw: "@newkol",
    });
    expect(r.signals).toHaveLength(0);
    expect(r.raw?.matched).toBe(false);
  });

  it("address path: token-link shortcut emits signal when caseId is present on link", async () => {
    mockTokenLinkFindMany.mockResolvedValue([{ kolHandle: "donwedge", caseId: "BOTIFY" }]);
    const r = await runCasefileMatch({
      type: "EVM_TOKEN", chain: "evm", address: "0xabc", raw: "0xabc",
    });
    expect(r.signals).toHaveLength(1);
    expect(r.raw?.matchedVia).toBe("kolTokenLink");
    expect(r.raw?.matchedHandle).toBe("donwedge");
  });

  it("address path: falls back to kolWallet→kolCase when no token-link match", async () => {
    mockTokenLinkFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([{ kolHandle: "donwedge" }]);
    mockCaseFindMany.mockResolvedValue([{ caseId: "BOTIFY" }]);
    const r = await runCasefileMatch({
      type: "EVM_TOKEN", chain: "evm", address: "0xabc", raw: "0xabc",
    });
    expect(r.signals).toHaveLength(1);
    expect(r.raw?.matchedVia).toBe("kolWallet→kolCase");
    expect(r.raw?.matchedHandle).toBe("donwedge");
  });

  it("address path: no match when neither token-link nor wallet-attribution hits", async () => {
    mockTokenLinkFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([]);
    const r = await runCasefileMatch({
      type: "EVM_TOKEN", chain: "evm", address: "0xabc", raw: "0xabc",
    });
    expect(r.signals).toHaveLength(0);
    expect(r.raw?.matched).toBe(false);
  });

  it("UNKNOWN input: no DB call, no match", async () => {
    const r = await runCasefileMatch({ type: "UNKNOWN", raw: "" });
    expect(r.signals).toHaveLength(0);
    expect(mockCaseFindMany).not.toHaveBeenCalled();
    expect(mockWalletFindMany).not.toHaveBeenCalled();
    expect(mockTokenLinkFindMany).not.toHaveBeenCalled();
  });
});
