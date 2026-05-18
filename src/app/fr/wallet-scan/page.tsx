"use client";
import BetaNav from "@/components/beta/BetaNav";
import React, { useState } from "react";
import type { WalletScanResult, RiskLevel } from "@/lib/wallet-scan/engine";

const O = "#FF6B00";
const RISK_COLOR: Record<RiskLevel | "NONE", string> = {
  CRITICAL: "#FF3B5C",
  HIGH: "#FFB800",
  MEDIUM: "#94a3b8",
  LOW: "#34d399",
  UNKNOWN: "#6b7280",
  NONE: "#6b7280",
};

type WalletChain = "solana" | "ethereum" | "base" | "arbitrum";

const CHAINS: Array<{ id: WalletChain; label: string }> = [
  { id: "solana",   label: "Solana" },
  { id: "ethereum", label: "Ethereum" },
  { id: "base",     label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
];

function RiskChip({ level }: { level: RiskLevel }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: RISK_COLOR[level],
        border: `1px solid ${RISK_COLOR[level]}44`,
        background: `${RISK_COLOR[level]}12`,
      }}
    >
      {level}
    </span>
  );
}

export default function WalletScanPageFR() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<WalletChain>("solana");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/wallet-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, chain }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan échoué");
        return;
      }
      setResult(data as WalletScanResult);
    } catch {
      setError("Délai dépassé ou erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BetaNav />
      <main
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "48px 24px 80px",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: O,
              marginBottom: 8,
            }}
          >
            INTERLIGENS · SCAN WALLET
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              fontStyle: "italic",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Scan de Wallet
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
            Inspectez les tokens détenus et identifiez les actifs risqués dans n'importe quel wallet.
          </p>
        </div>

        {/* Input */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChain(c.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  border: `1px solid ${chain === c.id ? O : "rgba(255,255,255,0.12)"}`,
                  background: chain === c.id ? `${O}18` : "transparent",
                  color: chain === c.id ? O : "#6b7280",
                  transition: "all 150ms ease",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder={
                chain === "solana"
                  ? "Adresse Solana (base58)…"
                  : "0x… adresse EVM"
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontFamily: "monospace",
                padding: "10px 14px",
                outline: "none",
              }}
            />
            <button
              onClick={handleScan}
              disabled={loading || !address.trim()}
              style={{
                background: loading || !address.trim() ? "rgba(255,107,0,0.3)" : O,
                border: "none",
                borderRadius: 8,
                color: "#000",
                fontSize: 13,
                fontWeight: 700,
                padding: "10px 20px",
                cursor: loading || !address.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {loading ? "Scan…" : "Scanner"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#FF3B5C18",
              border: "1px solid #FF3B5C44",
              borderRadius: 8,
              padding: "12px 16px",
              color: "#FF3B5C",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Revoke banner */}
            {result.revokeRecommended && (
              <div
                style={{
                  background: "#FF3B5C12",
                  border: "1px solid #FF3B5C44",
                  borderLeft: "3px solid #FF3B5C",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <div style={{ color: "#FF3B5C", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Révocation recommandée
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                    Tokens risqués détectés. Vérifiez vos approbations sur{" "}
                    <a
                      href="https://revoke.cash"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: O }}
                    >
                      revoke.cash
                    </a>
                    .
                  </div>
                </div>
              </div>
            )}

            {/* Summary row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                {result.tokenCount} token{result.tokenCount > 1 ? "s" : ""} trouvé{result.tokenCount > 1 ? "s" : ""}
              </span>
              {result.topRiskLevel !== "NONE" && (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Risque max
                  </span>
                  <RiskChip level={result.topRiskLevel as RiskLevel} />
                </span>
              )}
            </div>

            {/* Token list */}
            {result.tokens.length === 0 ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "24px",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                Aucun token trouvé.
              </div>
            ) : (
              (() => {
                const verified = result.tokens.filter((t) => t.isNative || t.priceKnown !== false);
                const unverified = result.tokens.filter((t) => !t.isNative && t.priceKnown === false);
                const Row = ({ token, muted }: { token: typeof result.tokens[number]; muted: boolean }) => (
                  <div
                    style={{
                      background: muted ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      opacity: muted ? 0.65 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: muted ? 600 : 700, fontSize: muted ? 12 : 14, color: muted ? "#94a3b8" : "#fff" }}>
                          {token.symbol || "—"}
                        </span>
                        {token.isNative && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: O, border: `1px solid ${O}44`, background: `${O}12`, borderRadius: 999, padding: "2px 6px", textTransform: "uppercase" }}>
                            Natif
                          </span>
                        )}
                        {token.riskLevel !== "UNKNOWN" && <RiskChip level={token.riskLevel} />}
                      </div>
                      <div style={{ color: muted ? "#475569" : "#6b7280", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {token.name || token.mint.slice(0, 20) + "…"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: muted ? 12 : 13, fontWeight: 600, color: muted ? "#94a3b8" : "#d1d5db" }}>
                        {token.balanceFormatted}
                      </div>
                      {token.balanceUsd !== null && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          {token.balanceUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $
                        </div>
                      )}
                    </div>
                    <a
                      href={token.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: O,
                        textDecoration: "none",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      ↗
                    </a>
                  </div>
                );
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {verified.map((token, i) => <Row key={token.mint + i} token={token} muted={false} />)}
                    {unverified.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer", color: "#6b7280", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 4px" }}>
                          {unverified.length} token{unverified.length > 1 ? "s" : ""} non vérifié{unverified.length > 1 ? "s" : ""} (sans prix)
                        </summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          {unverified.map((token, i) => <Row key={token.mint + i} token={token} muted={true} />)}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()
            )}

            <div
              style={{
                marginTop: 20,
                fontSize: 10,
                color: "#4b5563",
                textAlign: "right",
                letterSpacing: "0.06em",
              }}
            >
              Scanné à {new Date(result.computed_at).toLocaleTimeString("fr-FR")} · Scan rapide — sans TigerScore
            </div>
          </>
        )}
      </main>
    </>
  );
}
