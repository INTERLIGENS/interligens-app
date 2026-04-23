"use client";
import BetaNav from "@/components/beta/BetaNav";
import SignatureIntentBanner from "@/components/scan/SignatureIntentBanner";
import React, { useState } from "react";
import type { SignatureIntentResult, IntentChain } from "@/lib/signature-intent/analyzer";

const O = "#FF6B00";

// Pre-built examples (real-looking calldata patterns)
const EXAMPLES = [
  {
    label: "Example: Unlimited Approval",
    chain: "ethereum" as IntentChain,
    raw_tx:
      // approve(0xDeadBeef...DeadBeef, MAX_UINT256)
      "0x095ea7b3" +
      "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    decoded_data: undefined as undefined,
  },
  {
    label: "Example: Permit Signature",
    chain: "ethereum" as IntentChain,
    raw_tx:
      // permit(owner, spender, value, deadline, v, r, s) — EIP-2612
      "0xd505accf" +
      "0000000000000000000000001234567890abcdef1234567890abcdef12345678" +
      "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
      "00000000000000000000000000000000000000000000003635c9adc5dea00000" +
      "0000000000000000000000000000000000000000000000000000000067ab1234" +
      "000000000000000000000000000000000000000000000000000000000000001b" +
      "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" +
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    decoded_data: undefined as undefined,
  },
  {
    label: "Example: Safe Transfer",
    chain: "ethereum" as IntentChain,
    raw_tx:
      // transferFrom(from, to, amount)
      "0x23b872dd" +
      "0000000000000000000000001234567890abcdef1234567890abcdef12345678" +
      "000000000000000000000000abcdef1234567890abcdef1234567890abcdef12" +
      "0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    decoded_data: undefined as undefined,
  },
] as const;

const CHAINS = [
  { id: "ethereum" as IntentChain,  label: "Ethereum" },
  { id: "base"     as IntentChain,  label: "Base" },
  { id: "arbitrum" as IntentChain,  label: "Arbitrum" },
  { id: "solana"   as IntentChain,  label: "Solana" },
];

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#FF3B5C",
  HIGH: "#FFB800",
  MEDIUM: "#94a3b8",
  LOW: "#34d399",
  SAFE: "#34d399",
};

export default function SignatureCheckPage() {
  const [rawTx, setRawTx]     = useState("");
  const [chain, setChain]     = useState<IntentChain>("ethereum");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<SignatureIntentResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function analyze(overrideRaw?: string, overrideChain?: IntentChain) {
    const tx = (overrideRaw ?? rawTx).trim();
    const ch = overrideChain ?? chain;
    if (!tx) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/signature-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_tx: tx, chain: ch }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      setResult(data as SignatureIntentResult);
    } catch {
      setError("Request timed out or network error.");
    } finally {
      setLoading(false);
    }
  }

  function loadExample(ex: (typeof EXAMPLES)[number]) {
    setRawTx(ex.raw_tx);
    setChain(ex.chain);
    setResult(null);
    setError(null);
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
            INTERLIGENS · SIGNATURE CHECK
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
            Signature Intent Scanner
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
            Paste raw transaction calldata to understand what it does before you sign.
          </p>
        </div>

        {/* Quick examples */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => loadExample(ex)}
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
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
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

          {/* Textarea */}
          <textarea
            value={rawTx}
            onChange={(e) => setRawTx(e.target.value)}
            placeholder={"0x095ea7b3000000000000000000000000…\n\nPaste raw transaction calldata (0x hex) or base64 (Solana)"}
            rows={5}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8,
              color: "#d1d5db",
              fontSize: 12,
              fontFamily: "monospace",
              padding: "10px 14px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              marginBottom: 12,
            }}
          />

          {/* Analyze button */}
          <button
            onClick={() => analyze()}
            disabled={loading || !rawTx.trim()}
            style={{
              background:
                loading || !rawTx.trim() ? "rgba(255,107,0,0.3)" : O,
              border: "none",
              borderRadius: 8,
              color: "#000",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 24px",
              cursor:
                loading || !rawTx.trim() ? "not-allowed" : "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
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
            <SignatureIntentBanner result={result} lang="en" />

            {/* Decoded summary */}
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
                  marginBottom: 10,
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
                  Decoded summary
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
                  <span style={{ color: "#6b7280" }}>method </span>
                  <span style={{ color: "#d1d5db" }}>
                    {result.decoded_summary.method_name ?? "unknown"}
                  </span>
                </div>
                {result.intent_type && (
                  <div>
                    <span style={{ color: "#6b7280" }}>type&nbsp;&nbsp; </span>
                    <span style={{ color: "#d1d5db" }}>{result.intent_type}</span>
                  </div>
                )}
                {result.decoded_summary.spender && (
                  <div>
                    <span style={{ color: "#6b7280" }}>spender </span>
                    <span style={{ color: "#d1d5db", wordBreak: "break-all" }}>
                      {result.decoded_summary.spender}
                    </span>
                  </div>
                )}
                {result.decoded_summary.amount && (
                  <div>
                    <span style={{ color: "#6b7280" }}>amount </span>
                    <span
                      style={{
                        color: result.decoded_summary.is_unlimited ? "#FF3B5C" : "#d1d5db",
                        fontWeight: result.decoded_summary.is_unlimited ? 700 : 400,
                      }}
                    >
                      {result.decoded_summary.amount}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: "#6b7280" }}>action </span>
                  <span
                    style={{
                      color:
                        result.recommended_action === "REJECT"
                          ? "#FF3B5C"
                          : result.recommended_action === "CAUTION"
                            ? "#FFB800"
                            : "#34d399",
                    }}
                  >
                    {result.recommended_action}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
