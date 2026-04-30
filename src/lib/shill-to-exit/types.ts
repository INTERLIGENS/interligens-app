// src/lib/shill-to-exit/types.ts
// Canonical types for the shill-to-exit standalone analysis pipeline.

export interface ShillEvent {
  handle: string;
  tweetId: string;
  tweetDate: Date;
  tokenMentioned: string;
  sentiment: "bullish" | "neutral" | "mixed";
}

export interface ExitEvent {
  wallet: string;
  txHash: string;
  date: Date;
  tokenSold: string;
  amountUsd: number;
}

export type ShillToExitConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ShillToExitTimelineEntry {
  type: "SHILL" | "EXIT";
  date: Date;
  label: string;
  amountUsd?: number;
}

export interface ShillToExitResult {
  handle: string;
  token: string;
  shillDate: Date;
  exitDate: Date;
  deltaDays: number;
  estimatedProfit: number;
  confidence: ShillToExitConfidence;
  timeline: ShillToExitTimelineEntry[];
}
