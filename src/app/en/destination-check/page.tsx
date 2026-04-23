"use client";
import BetaNav from "@/components/beta/BetaNav";
import DestinationRiskBanner from "@/components/scan/DestinationRiskBanner";
import React, { useState } from "react";
import type { DestinationRiskResult, DestinationChain } from "@/lib/destination-risk/checker";

const O = "#FF6B00";

const CHAINS: Array<{ id: DestinationChain; label: string }> = [
  { id: "ethereum", label: "Ethereum" },
  { id: "solana",   label: "Solana" },
  { id: "base",     label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
];

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#FF3B5C",
  HIGH:     "#FFB800",
  MEDIUM:   "#94a3b8",
  LOW:      "#34d399",
  SAFE:     "#34d399",
};

// Pre-filled examples: Lazarus Group address, fresh wallet, clean known
const EXAMPLES: Array<{ label: string; address: string; chain: DestinationChain }> = [
  {
    label: "Lazarus Group (CRITICAL)",
    chain: "ethereum",
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96", // Ronin bridge exploit
  },
  {
    label: "Fresh wallet (MEDIUM)",
    chain: "solana",
    address: "NewWa11etAddress111111111111111111111111111",
  },
  {
    label: "Clean address (SAFE)",
    chain: "ethereum",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  },
];

export default function DestinationCheckPage() {
  const [address, setAddress] = useState("");
  const [chain, setChain]     = useState<DestinationChain>("ethereum");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<DestinationRiskResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function check(overrideAddr?: string, overrideChain?: DestinationChain) {
    const addr = (overrideAddr ?? address).trim();
    const ch   = overrideChain ?? chain;
    if (!addr) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/destination-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: addr, chain: ch }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Check failed");
        return;
      }
      setResult(data as DestinationRiskResult);
    } catch {
      setError("Request timed out or network error.");
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
            INTERLIGENS · DESTINATION CHECK
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
            Destination Risk Scanner
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
            Check a wallet address before sending funds. Detects scammers, mixers, OFAC-listed wallets, and fresh addresses.
          </p>
        </div>

        {/* Quick examples */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => {
                setAddress(ex.address);
                setChain(ex.chain);
                setResult(null);
                setError(null);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = O + "80";
                e.currentTarget.style.color = O;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "#94a3b8";
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Input panel */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          {/* Chain selector */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChain(c.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  border: `1px solid ${chain === c.id ? O : "rgba(255,255,255,0.10)"}`,
                  background: chain === c.id ? `${O}18` : "transparent",
                  color: chain === c.id ? O : "#6b7280",
                  transition: "all 150ms ease",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Address input + button */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()}
              placeholder={
                chain === "solana"
                  ? "Solana wallet address (base58)…"
                  : "0x… EVM destination address"
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontFamily: "monospace",
                padding: "10px 14px",
                outline: "none",
              }}
            />
            <button
              onClick={() => check()}
              disabled={loading || !address.trim()}
              style={{
                background:
                  loading || !address.trim() ? "rgba(255,107,0,0.3)" : O,
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
              {loading ? "Checking…" : "Check"}
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

        {/* Result */}
        {result && (
          <>
            <DestinationRiskBanner result={result} lang="en" />

            {/* Summary card */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#6b7280",
                  }}
                >
                  Destination summary
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: RISK_COLOR[result.risk_level] ?? "#94a3b8",
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid ${RISK_COLOR[result.risk_level] ?? "#94a3b8"}44`,
                    background: `${RISK_COLOR[result.risk_level] ?? "#94a3b8"}12`,
                  }}
                >
                  {result.risk_level}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "#94a3b8",
                }}
              >
                <div>
                  <span style={{ color: "#6b7280" }}>address </span>
                  <span style={{ color: "#d1d5db", wordBreak: "break-all" }}>
                    {result.destination}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#6b7280" }}>action&nbsp; </span>
                  <span
                    style={{
                      color:
                        result.recommended_action === "BLOCK"
                          ? "#FF3B5C"
                          : result.recommended_action === "WARN"
                            ? "#FFB800"
                            : "#34d399",
                      fontWeight: 700,
                    }}
                  >
                    {result.recommended_action}
                  </span>
                </div>
                {result.tiger_score !== undefined && (
                  <div>
                    <span style={{ color: "#6b7280" }}>tiger&nbsp;&nbsp; </span>
                    <span style={{ color: "#d1d5db" }}>{result.tiger_score}/100</span>
                  </div>
                )}
                <div>
                  <span style={{ color: "#6b7280" }}>flags&nbsp;&nbsp; </span>
                  <span style={{ color: "#d1d5db" }}>{result.flags.length}</span>
                </div>
                <div style={{ color: "#4b5563", fontSize: 10, marginTop: 4 }}>
                  Checked at {new Date(result.checked_at).toLocaleTimeString("en-US")}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
