export type SignalFamily = "FRAG" | "BRIDGE" | "MIXER" | "PRIV" | "DEG" | "CASH";
export type SignalSeverity = "WEAK" | "MODERATE" | "STRONG";
export type LaundryRisk = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RecoveryDifficulty = "LOW" | "PARTIAL" | "SEVERE";

export interface WalletHop {
  address: string;
  chain: string;
  timestamp: number;
  amountUsd?: number;
  protocol?: string;
  isBridge?: boolean;
  isMixer?: boolean;
  isPrivacyService?: boolean;
  isCexDeposit?: boolean;
  hopIndex?: number;
  /** "confirmed" = direct on-chain TX; "adjacent" = inferred from wallet attribution; "inferred" = pattern-based */
  evidenceLevel?: "confirmed" | "adjacent" | "inferred";
}

export interface SignalResult {
  family: SignalFamily;
  confirmed: boolean;
  severity: SignalSeverity;
  detail: string;
  rawData?: Record<string, unknown>;
}

export interface LaundryTrailOutput {
  walletAddress: string;
  chain: string;
  signals: SignalResult[];
  trailType: string;
  laundryRisk: LaundryRisk;
  recoveryDifficulty: RecoveryDifficulty;
  trailBreakHop?: number;
  fundsUnresolved?: number;
  evidenceNote: string;
}
