import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScore: vi.fn(),
  computeTigerScoreWithIntel: vi.fn(),
}));

import {
  computeTigerScore,
  computeTigerScoreWithIntel,
  type TigerInput,
  type TigerResult,
} from "@/lib/tigerscore/engine";
import { runTigerScore } from "@/lib/reflex/adapters/tigerscore";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockSync = vi.mocked(computeTigerScore);
const mockAsync = vi.mocked(computeTigerScoreWithIntel);

const SAMPLE_INPUT: ReflexResolvedInput = {
  type: "EVM_TOKEN",
  chain: "evm",
  address: "0xabc",
  raw: "0xabc",
};

const SAMPLE_TIGER_INPUT: TigerInput = { chain: "ETH" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tigerscore adapter", () => {
  it("maps each driver to one ReflexSignal with correct severity", async () => {
    const fakeResult: TigerResult = {
      score: 70,
      tier: "RED",
      confidence: "High",
      drivers: [
        { id: "unlimited_approvals", label: "Unlimited approvals detected", severity: "critical", delta: 70, why: "x" },
        { id: "high_approvals", label: "High approval count", severity: "high", delta: 35, why: "y" },
        { id: "med_signal", label: "Medium signal", severity: "med", delta: 15, why: "z" },
      ],
    };
    mockSync.mockReturnValue(fakeResult);
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(3);
    expect(r.signals[0].code).toBe("tigerscore.unlimited_approvals");
    expect(r.signals[0].severity).toBe("CRITICAL");
    expect(r.signals[1].severity).toBe("STRONG"); // high → STRONG
    expect(r.signals[2].severity).toBe("MODERATE"); // med → MODERATE
  });

  it("confidence: High=0.9, Medium=0.6, Low=0.3", async () => {
    mockSync.mockReturnValue({
      score: 50,
      tier: "ORANGE",
      confidence: "Medium",
      drivers: [{ id: "x", label: "x", severity: "med", delta: 10, why: "x" }],
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.signals[0].confidence).toBe(0.6);
  });

  it("stopTrigger is false on every TigerScore signal (V1 convergence rule)", async () => {
    mockSync.mockReturnValue({
      score: 100,
      tier: "RED",
      confidence: "High",
      drivers: [{ id: "x", label: "x", severity: "critical", delta: 70, why: "x" }],
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.signals[0].stopTrigger).toBe(false);
  });

  it("calls computeTigerScoreWithIntel when withIntel=true and address present", async () => {
    mockAsync.mockResolvedValue({
      score: 80, tier: "RED", confidence: "High", drivers: [],
      intelligence: null, finalScore: 80, finalTier: "RED",
    });
    await runTigerScore({
      resolvedInput: SAMPLE_INPUT,
      tigerInput: SAMPLE_TIGER_INPUT,
      withIntel: true,
    });
    expect(mockAsync).toHaveBeenCalledWith(SAMPLE_TIGER_INPUT, "0xabc");
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("falls back to sync engine when withIntel=true but no address (e.g. TICKER input)", async () => {
    mockSync.mockReturnValue({ score: 0, tier: "GREEN", confidence: "Low", drivers: [] });
    const tickerInput: ReflexResolvedInput = { type: "TICKER", ticker: "BTC", raw: "BTC" };
    await runTigerScore({
      resolvedInput: tickerInput,
      tigerInput: SAMPLE_TIGER_INPUT,
      withIntel: true,
    });
    expect(mockSync).toHaveBeenCalled();
    expect(mockAsync).not.toHaveBeenCalled();
  });

  it("returns ran:false + error message when engine throws", async () => {
    mockSync.mockImplementation(() => {
      throw new Error("boom");
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.ran).toBe(false);
    expect(r.error).toBe("boom");
    expect(r.signals).toHaveLength(0);
  });

  // ── Filter NON_RISK_TIGERSCORE_DRIVER_IDS (Day-1 shadow hot-fix) ──────
  it("skips informational drivers (NON_RISK_TIGERSCORE_DRIVER_IDS)", async () => {
    mockSync.mockReturnValue({
      score: 0, tier: "GREEN", confidence: "Medium",
      drivers: [
        // These 4 ids are in NON_RISK_TIGERSCORE_DRIVER_IDS and must be skipped.
        { id: "evm_contract_interaction", label: "x", severity: "low", delta: 0, why: "x" },
        { id: "evm_dormant_wallet", label: "x", severity: "med", delta: 0, why: "x" },
        { id: "evm_multi_chain_active", label: "x", severity: "low", delta: 0, why: "x" },
        { id: "low_tx_count", label: "x", severity: "med", delta: 10, why: "x" },
        // This one is a real risk driver and MUST pass through.
        { id: "unlimited_approvals", label: "y", severity: "critical", delta: 70, why: "y" },
      ],
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].code).toBe("tigerscore.unlimited_approvals");
  });

  it("emits ALL signals when none are informational (clean risk-only scenario)", async () => {
    mockSync.mockReturnValue({
      score: 105, tier: "RED", confidence: "High",
      drivers: [
        { id: "unlimited_approvals", label: "x", severity: "critical", delta: 70, why: "x" },
        { id: "freeze_authority", label: "x", severity: "critical", delta: 70, why: "x" },
      ],
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.signals).toHaveLength(2);
  });

  it("emits zero signals when ALL drivers are informational (USDC ETH scenario)", async () => {
    mockSync.mockReturnValue({
      score: 0, tier: "GREEN", confidence: "Medium",
      drivers: [
        { id: "evm_contract_interaction", label: "x", severity: "low", delta: 0, why: "x" },
        { id: "evm_dormant_wallet", label: "x", severity: "med", delta: 0, why: "x" },
        { id: "evm_multi_chain_active", label: "x", severity: "low", delta: 0, why: "x" },
        { id: "low_tx_count", label: "x", severity: "med", delta: 10, why: "x" },
      ],
    });
    const r = await runTigerScore({ resolvedInput: SAMPLE_INPUT, tigerInput: SAMPLE_TIGER_INPUT });
    expect(r.signals).toHaveLength(0);
  });
});
