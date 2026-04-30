export type SwapVerdict = "GREEN" | "ORANGE" | "RED";

export interface ScoreLiteResponse {
  verdict: SwapVerdict;
  score: number;
  label?: string;
}

export interface TransactionInsight {
  severity: "critical" | "warning" | "info";
  content: unknown;
}
