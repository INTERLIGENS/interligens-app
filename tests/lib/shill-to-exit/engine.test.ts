import { describe, it, expect } from "vitest";
import { buildShillToExitResult } from "@/lib/shill-to-exit/engine";
import type { ShillToExitSignal } from "@/lib/shill-to-exit/detector";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CA = "TokenMint111111111111111111111111111111111";
const HANDLE = "GordonGekko";

function mkSignal(
  hoursToExit: number,
  amountUsd = 40_000,
  severity: ShillToExitSignal["severity"] = "CRITICAL",
): ShillToExitSignal {
  const now = Date.now();
  return {
    handle: HANDLE,
    tokenCA: CA,
    tokenSymbol: "SCAM",
    shillDate: new Date(now - (hoursToExit + 2) * 3_600_000),
    exitDate:  new Date(now - 2 * 3_600_000),
    hoursToExit,
    amountUsd,
    severity,
    confidence: "MEDIUM",
    laundryEnrichment: null,
    evidence: ["Sold $SCAM", `Delay: ${hoursToExit}h`],
    postUrl: "https://x.com/GordonGekko/status/1",
    txHash: `tx${hoursToExit}`,
    walletAddress: "wallet123",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildShillToExitResult", () => {
  it("test 1 — SHILL + CASHOUT < 24h → detected true, confidence HIGH", () => {
    const sig = mkSignal(12);
    const result = buildShillToExitResult(HANDLE, [sig]);

    expect(result.detected).toBe(true);
    expect(result.confidence).toBe("HIGH");
    expect(result.timeline.some((e) => e.type === "SHILL")).toBe(true);
    expect(result.timeline.some((e) => e.type === "SELL" || e.type === "CASHOUT")).toBe(true);
  });

  it("test 2 — SHILL + SELL > 72h → detected true, confidence LOW", () => {
    const sig = mkSignal(96, 10_000, "MEDIUM");
    const result = buildShillToExitResult(HANDLE, [sig]);

    expect(result.detected).toBe(true);
    expect(result.confidence).toBe("LOW");
  });

  it("test 3 — no signals → detected false", () => {
    const result = buildShillToExitResult(HANDLE, []);

    expect(result.detected).toBe(false);
    expect(result.confidence).toBe("NONE");
    expect(result.timeline).toHaveLength(0);
    expect(result.total_proceeds_usd).toBe(0);
  });

  it("test 4 — timeline sorted chronologically (SHILL before SELL)", () => {
    const sig = mkSignal(8);
    const result = buildShillToExitResult(HANDLE, [sig]);

    const shillIdx = result.timeline.findIndex((e) => e.type === "SHILL");
    const sellIdx  = result.timeline.findIndex((e) => e.type === "SELL" || e.type === "CASHOUT");

    expect(shillIdx).toBeLessThan(sellIdx);
    for (let i = 1; i < result.timeline.length; i++) {
      expect(
        new Date(result.timeline[i].timestamp).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(result.timeline[i - 1].timestamp).getTime(),
      );
    }
  });

  it("test 5 — total_proceeds_usd sums all signals correctly", () => {
    const signals = [
      mkSignal(10, 40_627),
      mkSignal(20, 25_000, "HIGH"),
    ];
    const result = buildShillToExitResult(HANDLE, signals);

    expect(result.total_proceeds_usd).toBeCloseTo(65_627, 0);
  });

  it("test 6 — max_delta_minutes is the tightest signal's delay in minutes", () => {
    const signals = [
      mkSignal(12, 10_000), // 12h = 720 min
      mkSignal(48, 20_000, "HIGH"), // 48h = 2880 min
    ];
    const result = buildShillToExitResult(HANDLE, signals);

    expect(result.max_delta_minutes).toBe(2880);
  });

  it("test 7 — tokenMint filter excludes non-matching signals", () => {
    const matchSig = mkSignal(5, 30_000);
    const otherSig: ShillToExitSignal = {
      ...mkSignal(10, 5_000),
      tokenCA: "OtherToken111111111111111111111111111111111",
    };
    const result = buildShillToExitResult(HANDLE, [matchSig, otherSig], CA);

    // Only the matching signal should appear
    const proceeds = result.total_proceeds_usd;
    expect(proceeds).toBeCloseTo(30_000, 0);
  });
});
