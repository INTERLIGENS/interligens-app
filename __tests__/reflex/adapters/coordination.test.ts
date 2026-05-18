import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/coordination/coordinationSignals", () => ({
  getCoordinationSignalsForProfile: vi.fn(),
}));

import {
  getCoordinationSignalsForProfile,
  type CoordinationContext,
} from "@/lib/coordination/coordinationSignals";
import { runCoordination } from "@/lib/reflex/adapters/coordination";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockEngine = vi.mocked(getCoordinationSignalsForProfile);

const HANDLE_INPUT: ReflexResolvedInput = {
  type: "X_HANDLE",
  handle: "interligens",
  raw: "@interligens",
};

const EMPTY_CTX: CoordinationContext = {
  signals: [],
  strongestSignal: null,
  overallStrength: null,
  relatedActorsCount: 0,
  relatedLaunchesCount: 0,
  relatedCasesCount: 0,
  summaryEn: "",
  summaryFr: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("coordination adapter", () => {
  it("does not run when input is not X_HANDLE", async () => {
    const r = await runCoordination({
      type: "EVM_TOKEN", chain: "evm", address: "0x1", raw: "0x1",
    });
    expect(r.ran).toBe(false);
    expect(mockEngine).not.toHaveBeenCalled();
  });

  it("emits no signal when context is empty", async () => {
    mockEngine.mockResolvedValue(EMPTY_CTX);
    const r = await runCoordination(HANDLE_INPUT);
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(0);
  });

  it("maps each coordination signal to a ReflexSignal with strength→severity", async () => {
    mockEngine.mockResolvedValue({
      ...EMPTY_CTX,
      signals: [
        { type: "coordinated_promotion", strength: "strong", labelEn: "x", labelFr: "x", reasonSummary: "x", supportingCount: 5, supportingFlags: [] },
        { type: "repeated_cashout", strength: "moderate", labelEn: "y", labelFr: "y", reasonSummary: "y", supportingCount: 3, supportingFlags: [] },
      ],
      overallStrength: "strong",
    });
    const r = await runCoordination(HANDLE_INPUT);
    expect(r.signals).toHaveLength(2);
    expect(r.signals[0].severity).toBe("STRONG");
    expect(r.signals[0].code).toBe("coordination.coordinated_promotion");
    expect(r.signals[1].severity).toBe("MODERATE");
  });

  it("confidence reflects overallStrength: strong=0.85", async () => {
    mockEngine.mockResolvedValue({
      ...EMPTY_CTX,
      overallStrength: "strong",
      signals: [{ type: "shared_actor_group", strength: "strong", labelEn: "x", labelFr: "x", reasonSummary: "x", supportingCount: 1, supportingFlags: [] }],
    });
    const r = await runCoordination(HANDLE_INPUT);
    expect(r.signals[0].confidence).toBe(0.85);
  });

  it("returns ran:false + error on engine failure", async () => {
    mockEngine.mockRejectedValue(new Error("db down"));
    const r = await runCoordination(HANDLE_INPUT);
    expect(r.ran).toBe(false);
    expect(r.error).toBe("db down");
  });
});
