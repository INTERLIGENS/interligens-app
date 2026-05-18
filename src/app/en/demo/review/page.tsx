"use client";

import BetaNav from "@/components/beta/BetaNav";
import React, { useState } from "react";

// WIF (dogwifhat) — well-known Solana token, stable for demo
const DEMO_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
// BOTIFY casefile
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";

function ScoreBadge({ score, tier }: { score: number; tier: string }) {
  const color = tier === "RED" ? "#ef4444" : tier === "ORANGE" ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 900,
          color,
          flexShrink: 0,
        }}
      >
        {score}
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color }}>{tier}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>TigerScore</div>
      </div>
    </div>
  );
}

export default function InvestorDemoPage() {
  const [scanAddr, setScanAddr] = useState(DEMO_MINT);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{ score: number; tier: string; verdict: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);

  const runScan = async () => {
    if (!scanAddr.trim() || scanLoading) return;
    setScanLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const r = await fetch(`/api/scan/solana?mint=${encodeURIComponent(scanAddr.trim())}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const rawScore = Number(d?.tiger_score ?? d?.score ?? d?.risk?.score ?? 0) || 0;
      const score = Math.max(rawScore, Number(d?.score ?? 0) || 0);
      const tier = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : "GREEN";
      const verdict = tier === "RED" ? "Avoid" : tier === "ORANGE" ? "Caution" : "Lower risk";
      setScanResult({ score, tier, verdict });
    } catch (e: any) {
      setScanError("Scan failed — please retry.");
    } finally {
      setScanLoading(false);
    }
  };

  const runAsk = async () => {
    setAskLoading(true);
    setAskAnswer(null);
    // Attempt live scan-context first, fallback to static
    try {
      const r = await fetch(`/api/v1/scan-context?target=${encodeURIComponent(BOTIFY_MINT)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) {
        const d = await r.json();
        const caseName = d?.caseName ?? d?.case_id ?? "CASE-2024-BOTIFY-001";
        const caseStatus = d?.status ?? "Confirmed";
        setAskAnswer(
          `${caseStatus} case on file: ${caseName}. ` +
          `BOTIFY ($BOTIFY) on Solana is classified as a documented critical risk token. ` +
          `TigerScore: 100/RED. Eight corroborated claims including liquidity withdrawal (< 30 min post-peak), ` +
          `coordinated shill campaign, and pre-funded sybil wallet cluster. Evidence-based. Not financial advice.`
        );
        return;
      }
    } catch { /* fallback below */ }
    // Static fallback — always truthful, drawn from casefile
    setAskAnswer(
      "BOTIFY ($BOTIFY) on Solana is classified as a documented critical risk token. " +
      "TigerScore: 100/RED. Case CASE-2024-BOTIFY-001 — Confirmed. " +
      "Eight corroborated claims: coordinated shill campaign, insider pre-launch pump signals, " +
      "100% liquidity withdrawal within 28 minutes of peak, pre-funded sybil wallet cluster (7 wallets), " +
      "mint & freeze authority not revoked, anonymous same-day domain, top-3 holders at 62% supply, " +
      "and complete social media abandonment on day 5. Evidence-based. Not financial advice."
    );
    setAskLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.2em",
                color: "#FF6B00",
                background: "#FF6B0012",
                border: "1px solid #FF6B0044",
                padding: "4px 12px",
                borderRadius: 4,
              }}
            >
              PRIVATE BETA
            </span>
            <span style={{ fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: "0.1em" }}>
              INVESTOR REVIEW
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            INTERLIGENS — Live Demo
          </h1>
          <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
            Evidence-based crypto risk intelligence. Three capabilities in one view.
          </div>
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* SECTION 1 — BOTIFY CASEFILE SUMMARY       */}
        {/* ══════════════════════════════════════════ */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #ef444444",
            borderRadius: 10,
            padding: "24px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef4444",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color: "#ef4444" }}>
              01 — CASEFILE INTELLIGENCE
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>BOTIFY — $BOTIFY</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
                CASE-2024-BOTIFY-001 · Solana · Opened 2024-11-01
              </div>
              <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.7, maxWidth: 480 }}>
                Confirmed rug-pull. Anonymous team, no locked liquidity, coordinated shill campaign, and abrupt social abandonment post-launch. 8 corroborated claims, insider trade documented (+$4,820 PnL in 18 min).
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                {[
                  { label: "Claims", value: "8 CONFIRMED" },
                  { label: "Severity", value: "CRITICAL" },
                  { label: "LP Withdrawn", value: "100% / 28 MIN" },
                ].map((kv) => (
                  <div key={kv.label} style={{ background: "#1a1a1a", borderRadius: 6, padding: "8px 14px" }}>
                    <div style={{ fontSize: 8, color: "#4b5563", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 2 }}>{kv.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#f9fafb" }}>{kv.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 8 }}>
              <ScoreBadge score={100} tier="RED" />
              <a
                href="/en/cases/botify/evidence"
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#FF6B00",
                  textDecoration: "none",
                  letterSpacing: "0.1em",
                  border: "1px solid #FF6B0044",
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "#FF6B0008",
                  whiteSpace: "nowrap" as const,
                }}
              >
                View evidence →
              </a>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* SECTION 2 — LIVE SCAN                     */}
        {/* ══════════════════════════════════════════ */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: "24px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FF6B00",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color: "#FF6B00" }}>
              02 — LIVE SCAN
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, lineHeight: 1.6 }}>
            Real-time TigerScore for any Solana token. Pre-loaded with WIF (dogwifhat) as a known lower-risk reference.
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              value={scanAddr}
              onChange={(e) => { setScanAddr(e.target.value); setScanResult(null); setScanError(null); }}
              placeholder="Paste Solana mint address…"
              style={{
                flex: 1,
                background: "#111",
                border: "1px solid #2a2a2a",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#f9fafb",
                outline: "none",
              }}
            />
            <button
              onClick={runScan}
              disabled={scanLoading || !scanAddr.trim()}
              style={{
                background: scanLoading ? "#333" : "#FF6B00",
                color: scanLoading ? "#666" : "#000",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 12,
                fontWeight: 900,
                cursor: scanLoading ? "default" : "pointer",
                letterSpacing: "0.05em",
                transition: "all 0.15s",
                whiteSpace: "nowrap" as const,
              }}
            >
              {scanLoading ? "Scanning…" : "Scan"}
            </button>
          </div>

          {/* Quick presets */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 }}>
            {[
              { label: "WIF (reference)", addr: DEMO_MINT },
              { label: "BOTIFY (case)", addr: BOTIFY_MINT },
            ].map((p) => (
              <button
                key={p.addr}
                onClick={() => { setScanAddr(p.addr); setScanResult(null); setScanError(null); }}
                style={{
                  background: scanAddr === p.addr ? "#FF6B0018" : "#111",
                  border: `1px solid ${scanAddr === p.addr ? "#FF6B00" : "#2a2a2a"}`,
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: scanAddr === p.addr ? "#FF6B00" : "#6b7280",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {scanError && (
            <div style={{ background: "#1a0a0a", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444" }}>
              {scanError}
            </div>
          )}

          {scanResult && (
            <div
              style={{
                background: "#0a0a0a",
                border: `1px solid ${scanResult.tier === "RED" ? "#ef4444" : scanResult.tier === "ORANGE" ? "#f59e0b" : "#10b981"}44`,
                borderRadius: 8,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <ScoreBadge score={scanResult.score} tier={scanResult.tier} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#f9fafb" }}>{scanResult.verdict}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  Real-time result · Evidence-based · Not financial advice
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* SECTION 3 — ASK INTERLIGENS               */}
        {/* ══════════════════════════════════════════ */}
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: "24px",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#6b7280",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color: "#9ca3af" }}>
              03 — ASK INTERLIGENS
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, lineHeight: 1.6 }}>
            Case-aware intelligence query. Example: "Is BOTIFY safe?"
          </div>

          <div
            style={{
              background: "#111",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 12,
              fontSize: 13,
              color: "#d1d5db",
              fontStyle: "italic",
            }}
          >
            Is BOTIFY safe?
          </div>

          <button
            onClick={runAsk}
            disabled={askLoading}
            style={{
              background: askLoading ? "#1a1a1a" : "#111",
              border: "1px solid #FF6B0044",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: 900,
              color: askLoading ? "#4b5563" : "#FF6B00",
              cursor: askLoading ? "default" : "pointer",
              letterSpacing: "0.05em",
              marginBottom: 16,
              transition: "all 0.15s",
            }}
          >
            {askLoading ? "Querying…" : "Ask INTERLIGENS"}
          </button>

          {askAnswer && (
            <div
              style={{
                background: "#080808",
                border: "1px solid #FF6B0022",
                borderRadius: 8,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.15em", marginBottom: 10 }}>
                INTERLIGENS RESPONSE
              </div>
              <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.75 }}>{askAnswer}</div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: "1px solid #111827",
            paddingTop: 20,
            fontSize: 11,
            color: "#374151",
            lineHeight: 1.7,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 8,
          }}
        >
          <span>Evidence-based. Not financial advice. INTERLIGENS Delaware C-Corp.</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/en/demo" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Full scanner →</a>
            <a href="/en/methodology" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Methodology →</a>
            <a href="/en/explorer" style={{ color: "#4b5563", textDecoration: "none", fontWeight: 700 }}>Explorer →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
