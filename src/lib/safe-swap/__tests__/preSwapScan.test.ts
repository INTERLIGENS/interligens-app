import { describe, it, expect, vi, beforeEach } from "vitest";
import { preSwapScan } from "../preSwapScan";
import type { SwapVerdict } from "../types";

vi.mock("@/lib/publicScore/computeVerdict", () => ({
  computeVerdict: vi.fn(),
}));

import { computeVerdict } from "@/lib/publicScore/computeVerdict";
const mockComputeVerdict = vi.mocked(computeVerdict);

const FROM = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const TO = "So11111111111111111111111111111111111111112";

function setVerdicts(fromV: SwapVerdict, toV: SwapVerdict) {
  mockComputeVerdict
    .mockResolvedValueOnce(fromV)
    .mockResolvedValueOnce(toV);
}

describe("preSwapScan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("allows swap when both tokens are GREEN", async () => {
    setVerdicts("GREEN", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.fromVerdict).toBe("GREEN");
    expect(result.toVerdict).toBe("GREEN");
    expect(result.warning).toBeUndefined();
  });

  it("blocks swap when source token is RED", async () => {
    setVerdicts("RED", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("RED");
  });

  it("blocks swap when destination token is RED", async () => {
    setVerdicts("GREEN", "RED");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(true);
    expect(result.toVerdict).toBe("RED");
  });

  it("warns but allows swap when source token is ORANGE", async () => {
    setVerdicts("ORANGE", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain("ORANGE");
    expect(result.fromVerdict).toBe("ORANGE");
  });

  it("warns but allows swap when destination token is ORANGE", async () => {
    setVerdicts("GREEN", "ORANGE");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain("ORANGE");
  });

  it("fail-open (GREEN) when computeVerdict throws", async () => {
    mockComputeVerdict.mockRejectedValueOnce(new Error("Network error"));
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.fromVerdict).toBe("GREEN");
    expect(result.toVerdict).toBe("GREEN");
  });
});
