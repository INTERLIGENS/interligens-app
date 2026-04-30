import type { SwapProvider, SwapChain, SwapToken, SwapQuote } from "./types";

const CHAIN_ID: Record<string, number> = {
  ETH: 1,
  BASE: 8453,
  ARB: 42161,
};

export class OneInchProvider implements SwapProvider {
  async getQuote(
    chain: SwapChain,
    fromToken: SwapToken,
    toToken: SwapToken,
    amountIn: string,
  ): Promise<SwapQuote> {
    const chainId = CHAIN_ID[chain];
    if (!chainId) throw new Error(`1inch: unsupported chain ${chain}`);

    const apiKey = process.env.ONE_INCH_API_KEY;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const url = new URL(`https://api.1inch.dev/swap/v6.0/${chainId}/quote`);
    url.searchParams.set("src", fromToken.address);
    url.searchParams.set("dst", toToken.address);
    url.searchParams.set("amount", amountIn);

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`1inch quote failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    return {
      fromToken,
      toToken,
      fromAmount: amountIn,
      toAmount: String(data.dstAmount ?? data.toAmount ?? "0"),
      estimatedGas: String(data.estimatedGas ?? ""),
      provider: "1inch",
      chainId,
    };
  }
}
