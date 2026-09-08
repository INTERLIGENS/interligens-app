import type { MeasurementState } from "@/lib/publication/absenceVocabulary";

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

/** L'état d'UN côté du swap. */
export interface PreSwapSideCoverage {
  side: "from" | "to";
  /** Axe MESURE uniquement. Jamais un état de publication. */
  state: MeasurementState;
  /** La cause, quand il y en a une. Jamais fabriquée. */
  detail?: string;
}

export interface PreSwapScanResult {
  /**
   * `null` quand ce côté n'a PAS été mesuré.
   *
   * Avant, les deux champs étaient INITIALISÉS à "GREEN" — la valeur par
   * défaut du chemin était l'autorisation, pas l'abstention — et le `catch`
   * rendait { GREEN, GREEN, blocked: false }. Une panne de provider et un
   * jeton propre produisaient exactement la même sortie.
   *
   * `null` n'est pas un verdict : c'est l'absence de verdict, et elle se lit.
   */
  fromVerdict: SwapVerdict | null;
  toVerdict: SwapVerdict | null;
  blocked: boolean;
  blockReason?: string;
  warning?: string;
  /**
   * Ce qui a été mesuré, et ce qui ne l'a pas été. Voyage À CÔTÉ des verdicts.
   */
  coverage: {
    /** Les deux côtés sont toujours attendus. */
    expected: number;
    expectedMeasured: number;
    sides: PreSwapSideCoverage[];
  };
  /** `true` dès qu'un côté attendu n'a pas pu être mesuré, ou l'a été partiellement. */
  degraded: boolean;
}
