// src/lib/wallet-connect/types.ts

export type WalletVerdictTier = "GREEN" | "ORANGE" | "RED";

export interface WalletSession {
  address: string;
  chain: "ethereum" | "base" | "arbitrum" | "solana";
  connectedAt: Date;
  verdictTier?: WalletVerdictTier;
}

export interface ScanBeforeConnectResult {
  allow: boolean;
  warning: "HIGH RISK" | "CAUTION" | null;
  tier: WalletVerdictTier;
  score: number;
  address: string;
}

export interface WarningModalProps {
  verdict: ScanBeforeConnectResult;
  onProceed: () => void;
  onCancel: () => void;
}
