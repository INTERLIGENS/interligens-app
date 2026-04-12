export type SignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PublicSignal = {
  id: string;
  label: string;
  severity: SignalSeverity;
  value?: string | number;
};

export type PublicVerdict = "GREEN" | "ORANGE" | "RED";

export type PublicScoreResponse = {
  mint: string;
  symbol?: string;
  name?: string;
  score: number;
  verdict: PublicVerdict;
  signals: PublicSignal[];
  sources: string[];
  cached: boolean;
  timestamp: string;
  api_version: "v1";
};

export type PublicErrorResponse = {
  error: "invalid_mint" | "token_not_found" | "rate_limit_exceeded" | "internal_error";
  message?: string;
  retry_after?: number;
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidMint(mint: string): boolean {
  return BASE58_RE.test(mint);
}

/** Map TigerDriver severity (lowercase) to public API severity (uppercase) */
export function mapSeverity(s: string): SignalSeverity {
  switch (s) {
    case "critical": return "CRITICAL";
    case "high":     return "HIGH";
    case "med":      return "MEDIUM";
    case "low":      return "LOW";
    default:         return "LOW";
  }
}
