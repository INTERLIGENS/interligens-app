import type { SwapChain, SwapToken, SwapRoute } from "./types";
import { OneInchProvider } from "./oneInchProvider";
import { JupiterProvider } from "./jupiterProvider";
import { preSwapScan } from "./preSwapScan";

const oneInch = new OneInchProvider();
const jupiter = new JupiterProvider();

const EVM_CHAINS: SwapChain[] = ["ETH", "BASE", "ARB"];

export async function routeSwap(
  chain: SwapChain,
  fromToken: SwapToken,
  toToken: SwapToken,
  amountIn: string,
): Promise<SwapRoute> {
  const scan = await preSwapScan(fromToken.address, toToken.address);

  if (scan.blocked) {
    return {
      chain,
      quote: {
        fromToken,
        toToken,
        fromAmount: amountIn,
        toAmount: "0",
        provider: chain === "SOL" ? "jupiter" : "1inch",
      },
      blocked: true,
      blockReason: scan.blockReason,
    };
  }

  const provider = chain === "SOL" ? jupiter : oneInch;
  const quote = await provider.getQuote(chain, fromToken, toToken, amountIn);

  return {
    chain,
    quote,
    blocked: false,
    ...(scan.warning ? { blockReason: scan.warning } : {}),
  };
}

export { EVM_CHAINS };
