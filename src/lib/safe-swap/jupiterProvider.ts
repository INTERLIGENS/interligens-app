import type { SwapProvider, SwapChain, SwapToken, SwapQuote } from "./types";

export class JupiterProvider implements SwapProvider {
  async getQuote(
    _chain: SwapChain,
    fromToken: SwapToken,
    toToken: SwapToken,
    amountIn: string,
  ): Promise<SwapQuote> {
    const url = new URL("https://quote-api.jup.ag/v6/quote");
    url.searchParams.set("inputMint", fromToken.address);
    url.searchParams.set("outputMint", toToken.address);
    url.searchParams.set("amount", amountIn);
    url.searchParams.set("slippageBps", "50");

    const res = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Jupiter quote failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    return {
      fromToken,
      toToken,
      fromAmount: amountIn,
      toAmount: String(data.outAmount ?? "0"),
      provider: "jupiter",
    };
  }
}
