export type SwapChain = "SOL" | "ETH" | "BASE" | "ARB";

export type SwapVerdict = "GREEN" | "ORANGE" | "RED";

export interface SwapToken {
  address: string;
  symbol?: string;
  decimals?: number;
}

export interface SwapQuote {
  fromToken: SwapToken;
  toToken: SwapToken;
  fromAmount: string;
  toAmount: string;
  estimatedGas?: string;
  provider: "1inch" | "jupiter";
  chainId?: number;
}

export interface SwapRoute {
  chain: SwapChain;
  quote: SwapQuote;
  blocked: boolean;
  blockReason?: string;
}

export interface SwapProvider {
  getQuote(
    chain: SwapChain,
    fromToken: SwapToken,
    toToken: SwapToken,
    amountIn: string,
  ): Promise<SwapQuote>;
}

export interface PreSwapScanResult {
  fromVerdict: SwapVerdict;
  toVerdict: SwapVerdict;
  blocked: boolean;
  blockReason?: string;
  warning?: string;
}
