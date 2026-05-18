import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolCase: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { runRecidivism } from "@/lib/reflex/recidivism";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockFindMany = vi.mocked(prisma.kolCase.findMany as unknown as (...a: unknown[]) => unknown);

const HANDLE_INPUT: ReflexResolvedInput = {
  type: "X_HANDLE",
  handle: "donwedge",
  raw: "@donwedge",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recidivism adapter", () => {
  it("does not run when input is not X_HANDLE", async () => {
    const r = await runRecidivism({ type: "EVM_TOKEN", address: "0x1", raw: "0x1" });
    expect(r.ran).toBe(false);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("emits no signal when KOL has 0 cases", async () => {
    mockFindMany.mockResolvedValue([]);
    const r = await runRecidivism(HANDLE_INPUT);
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(0);
    expect(r.raw?.priorCaseCount).toBe(0);
    expect(r.raw?.recidivist).toBe(false);
  });

  it("emits MODERATE signal for 1 prior case (not yet recidivist)", async () => {
    mockFindMany.mockResolvedValue([{ caseId: "BOTIFY" }]);
    const r = await runRecidivism(HANDLE_INPUT);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("MODERATE");
    expect(r.signals[0].code).toBe("recidivism.prior_case");
    expect(r.raw?.recidivist).toBe(false);
  });

  it("emits STRONG signal for >=2 distinct cases (recidivist)", async () => {
    mockFindMany.mockResolvedValue([
      { caseId: "BOTIFY" },
      { caseId: "RAVE" },
      { caseId: "GHOST" },
    ]);
    const r = await runRecidivism(HANDLE_INPUT);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("STRONG");
    expect(r.signals[0].code).toBe("recidivism.recidivist");
    expect(r.raw?.recidivist).toBe(true);
    expect(r.raw?.priorCaseCount).toBe(3);
  });

  it("deduplicates caseIds (recidivism counts distinct cases)", async () => {
    mockFindMany.mockResolvedValue([
      { caseId: "BOTIFY" },
      { caseId: "BOTIFY" },
      { caseId: "RAVE" },
    ]);
    const r = await runRecidivism(HANDLE_INPUT);
    expect(r.raw?.priorCaseCount).toBe(2);
    expect(r.raw?.caseIds.sort()).toEqual(["BOTIFY", "RAVE"]);
  });
});
