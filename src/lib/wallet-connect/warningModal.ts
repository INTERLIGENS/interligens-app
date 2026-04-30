// src/lib/wallet-connect/warningModal.ts
// Types for the scan-before-connect warning modal (no React component here).

export type { WarningModalProps } from "./types";

import type { ScanBeforeConnectResult } from "./types";

export function getWarningCopy(result: ScanBeforeConnectResult): {
  title: string;
  body: string;
  proceedLabel: string;
  cancelLabel: string;
} {
  if (result.tier === "RED") {
    return {
      title: "HIGH RISK WALLET",
      body: `This wallet scored ${result.score}/100 — high-risk patterns detected. Connecting could expose you to a scam or drainer.`,
      proceedLabel: "Connect Anyway (Risky)",
      cancelLabel: "Cancel",
    };
  }
  if (result.tier === "ORANGE") {
    return {
      title: "CAUTION",
      body: `This wallet scored ${result.score}/100 — suspicious activity detected. Proceed carefully.`,
      proceedLabel: "Connect",
      cancelLabel: "Cancel",
    };
  }
  return {
    title: "WALLET VERIFIED",
    body: `Score: ${result.score}/100. No significant risk detected.`,
    proceedLabel: "Connect",
    cancelLabel: "Cancel",
  };
}
