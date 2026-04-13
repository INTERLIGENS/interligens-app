"use client";

import { useEffect } from "react";

export type NextBestStep = {
  id: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
};

type Props = {
  step: NextBestStep | null;
  onDismiss: () => void;
};

export function buildNextBestStep(
  type: string,
  value: string
): NextBestStep | null {
  const id = `${Date.now()}`;
  const encoded = encodeURIComponent(value);
  switch (type) {
    case "WALLET":
      return {
        id,
        message: "Wallet added. Consider checking for linked transaction hashes.",
        actionLabel: "Open Etherscan →",
        actionUrl: `https://etherscan.io/address/${value}`,
      };
    case "HANDLE": {
      const h = value.replace(/^@+/, "");
      return {
        id,
        message: "Handle added. Consider searching for linked wallets or emails.",
        actionLabel: "Search in IntelX →",
        actionUrl: `https://intelx.io/?s=${encodeURIComponent(h)}`,
      };
    }
    case "TX_HASH":
      return {
        id,
        message: "Transaction added. Check if this crossed a bridge.",
        actionLabel: "Check on Socketscan →",
        actionUrl: `https://socketscan.io/tx/${value}`,
      };
    case "URL":
    case "DOMAIN":
      return {
        id,
        message: "Domain added. Check when this was first registered.",
        actionLabel: "Check on Wayback →",
        actionUrl: `https://web.archive.org/web/*/${value}`,
      };
    case "EMAIL":
      return {
        id,
        message: "Email added. Check for breach data.",
        actionLabel: "Search IntelX →",
        actionUrl: `https://intelx.io/?s=${encoded}`,
      };
    default:
      return null;
  }
}

export default function NextBestStepToast({ step, onDismiss }: Props) {
  useEffect(() => {
    if (!step) return;
    const t = setTimeout(() => onDismiss(), 5000);
    return () => clearTimeout(t);
  }, [step, onDismiss]);

  if (!step) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 100,
        maxWidth: 320,
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(255,107,0,0.3)",
        borderRadius: 8,
        padding: 16,
        color: "#FFFFFF",
        fontSize: 13,
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
      }}
    >
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 6,
          right: 10,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      <div style={{ paddingRight: 16 }}>{step.message}</div>
      <a
        href={step.actionUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          marginTop: 10,
          color: "#FF6B00",
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        {step.actionLabel}
      </a>
    </div>
  );
}
