"use client";

import { useEffect } from "react";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  sourceFileId: string | null;
};

type Props = {
  rootEntityId: string;
  entities: Entity[];
  onClose: () => void;
  onOpenGraph: () => void;
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, Math.floor(n / 2)) + "…" + s.slice(-Math.floor(n / 2)) : s;
}

export default function WalletJourney({
  rootEntityId,
  entities,
  onClose,
  onOpenGraph,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wallets = entities.filter((e) => e.type === "WALLET");
  const txs = entities.filter((e) => e.type === "TX_HASH");
  const root = entities.find((e) => e.id === rootEntityId);

  // Build a linear chain. If wallets share a sourceFileId, group them.
  // Otherwise, just chain them in order with TX between.
  const chain: { node: Entity; isTx: boolean }[] = [];
  if (wallets.length > 0 && txs.length > 0) {
    // Interleave: wallet → tx → wallet → tx → wallet ...
    const ordered = [
      root && root.type === "WALLET" ? root : wallets[0],
      ...wallets.filter((w) => !root || w.id !== root.id),
    ].filter(Boolean) as Entity[];
    for (let i = 0; i < ordered.length; i++) {
      chain.push({ node: ordered[i], isTx: false });
      if (i < ordered.length - 1 && txs[i]) {
        chain.push({ node: txs[i], isTx: true });
      }
    }
  }

  const canRender = wallets.length >= 2 && txs.length >= 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#0a0a0a",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 700,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#FFFFFF",
            }}
          >
            Wallet Journey
            {root && (
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 400,
                  marginLeft: 8,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                — {truncate(root.value, 24)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {!canRender ? (
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              padding: 40,
            }}
          >
            Add more wallets and transactions to see the journey.
          </div>
        ) : (
          <div>
            <div
              className="flex flex-col gap-2"
              style={{ marginBottom: 20 }}
            >
              {chain.map((step, i) => (
                <div key={`${step.node.id}-${i}`}>
                  <div
                    className="flex items-center gap-3"
                    style={{
                      padding: "10px 12px",
                      border: step.isTx
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(255,107,0,0.3)",
                      borderRadius: 6,
                      backgroundColor: step.isTx
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,107,0,0.05)",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 12,
                        backgroundColor: step.isTx
                          ? "rgba(255,255,255,0.4)"
                          : "#FF6B00",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        width: 60,
                        flexShrink: 0,
                      }}
                    >
                      {step.node.type}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.85)",
                        flex: 1,
                        wordBreak: "break-all",
                      }}
                    >
                      {truncate(step.node.value, 32)}
                    </span>
                    {step.node.label && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.4)",
                          flexShrink: 0,
                        }}
                      >
                        {step.node.label}
                      </span>
                    )}
                  </div>
                  {i < chain.length - 1 && (
                    <div
                      style={{
                        textAlign: "center",
                        color: "rgba(255,255,255,0.2)",
                        fontSize: 16,
                        padding: "2px 0",
                      }}
                    >
                      ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={onOpenGraph}
              style={{
                fontSize: 12,
                color: "#FF6B00",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Open full graph →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
