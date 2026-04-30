import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SwapToken } from "../types";

vi.mock("../preSwapScan", () => ({
  preSwapScan: vi.fn(async () => ({ fromVerdict: "GREEN", toVerdict: "GREEN", blocked: false })),
}));
vi.mock("../oneInchProvider", () => {
  function OneInchProvider(this: { getQuote: ReturnType<typeof vi.fn> }) {
    this.getQuote = vi.fn(async (_chain: string, from: SwapToken, to: SwapToken, amount: string) => ({
      fromToken: from,
      toToken: to,
      fromAmount: amount,
      toAmount: "1000000",
      estimatedGas: "150000",
      provider: "1inch",
      chainId: 1,
    }));
  }
  return { OneInchProvider };
});
vi.mock("../jupiterProvider", () => {
  function JupiterProvider(this: { getQuote: ReturnType<typeof vi.fn> }) {
    this.getQuote = vi.fn(async (_chain: string, from: SwapToken, to: SwapToken, amount: string) => ({
      fromToken: from,
      toToken: to,
      fromAmount: amount,
      toAmount: "2000000",
      provider: "jupiter",
    }));
  }
  return { JupiterProvider };
});

const USDC_SOL: SwapToken = { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" };
const SOL_TOKEN: SwapToken = { address: "So11111111111111111111111111111111111111112", symbol: "SOL" };
const USDC_ETH: SwapToken = { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC" };
const WETH: SwapToken = { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", symbol: "WETH" };

describe("routeSwap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses Jupiter for SOL chain", async () => {
    const { routeSwap } = await import("../router");
    const route = await routeSwap("SOL", USDC_SOL, SOL_TOKEN, "1000000");
    expect(route.chain).toBe("SOL");
    expect(route.quote.provider).toBe("jupiter");
    expect(route.blocked).toBe(false);
  });

  it("uses 1inch for ETH chain", async () => {
    const { routeSwap } = await import("../router");
    const route = await routeSwap("ETH", USDC_ETH, WETH, "1000000");
    expect(route.chain).toBe("ETH");
    expect(route.quote.provider).toBe("1inch");
    expect(route.blocked).toBe(false);
  });

  it("uses 1inch for BASE chain", async () => {
    const { routeSwap } = await import("../router");
    const route = await routeSwap("BASE", USDC_ETH, WETH, "1000000");
    expect(route.quote.provider).toBe("1inch");
  });

  it("uses 1inch for ARB chain", async () => {
    const { routeSwap } = await import("../router");
    const route = await routeSwap("ARB", USDC_ETH, WETH, "1000000");
    expect(route.quote.provider).toBe("1inch");
  });

  it("blocks swap when pre-scan returns blocked=true", async () => {
    const { preSwapScan } = await import("../preSwapScan");
    vi.mocked(preSwapScan).mockResolvedValueOnce({
      fromVerdict: "RED",
      toVerdict: "GREEN",
      blocked: true,
      blockReason: "source token is flagged RED — swap blocked",
    });
    const { routeSwap } = await import("../router");
    const route = await routeSwap("ETH", USDC_ETH, WETH, "1000000");
    expect(route.blocked).toBe(true);
    expect(route.blockReason).toContain("RED");
    expect(route.quote.toAmount).toBe("0");
  });
});
