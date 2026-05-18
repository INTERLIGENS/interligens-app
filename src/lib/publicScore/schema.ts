export type SignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PublicSignal = {
  id: string;
  label: string;
  severity: SignalSeverity;
  value?: string | number;
};

export type PublicVerdict = "GREEN" | "ORANGE" | "RED";

export type PhantomWarningLevel = "BLOCK" | "WARN" | "ALLOW";

export type PublicScoreResponse = {
  mint: string;
  symbol?: string;
  name?: string;
  score: number;
  verdict: PublicVerdict;
  phantom_warning_level: PhantomWarningLevel;
  phantom_disclaimer: string;
  signals: PublicSignal[];
  sources: string[];
  cached: boolean;
  timestamp: string;
  api_version: "v1";
  website?: string | null;
  pairAgeDays?: number | null;
  liquidityUsd?: number | null;
  topHolderPct?: number | null;
  mintAuthority?: boolean | null;
  freezeAuthority?: boolean | null;
  communityScans?: number | null;
};

export function derivePhantomWarning(verdict: PublicVerdict): {
  level: PhantomWarningLevel;
  disclaimer: string;
} {
  switch (verdict) {
    case "RED":
      return {
        level: "BLOCK",
        disclaimer: "This token has critical risk signals. Swapping is strongly discouraged.",
      };
    case "ORANGE":
      return {
        level: "WARN",
        disclaimer: "This token shows elevated risk. Proceed with caution.",
      };
    case "GREEN":
      return {
        level: "ALLOW",
        disclaimer: "No major risk signals detected.",
      };
  }
}

export type PublicErrorResponse = {
  error: "invalid_mint" | "token_not_found" | "rate_limit_exceeded" | "internal_error";
  message?: string;
  retry_after?: number;
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidMint(mint: string): boolean {
  return BASE58_RE.test(mint);
}

export function isValidEvmAddress(addr: string): boolean {
  return EVM_RE.test(addr);
}

/** Accept either a SOL base58 mint or an EVM 0x address. */
export function isValidScoreTarget(s: string): boolean {
  return isValidMint(s) || isValidEvmAddress(s);
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
