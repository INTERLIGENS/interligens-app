"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";

import BetaNav from "@/components/beta/BetaNav";

declare global {
  interface Window {
    Jupiter: {
      init: (config: Record<string, unknown>) => void;
      resume: () => void;
    };
  }
}

type ScoreResponse = {
  score?: number;
  verdict?: "RED" | "ORANGE" | "GREEN";
  signals?: Array<{ id: string; label: string; severity: string }>;
  symbol?: string;
  name?: string;
};

type BadgeConfig = {
  label: string;
  color: string;
  bg: string;
  border: string;
};

const RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC ??
  "https://api.mainnet-beta.solana.com";

function scoreToBadge(score: number | undefined, verdict: string | undefined): BadgeConfig | null {
  if (score === undefined || verdict === undefined) return null;
  if (score > 70) {
    return { label: "HIGH RISK", color: "#FF3B5C", bg: "rgba(255,59,92,0.08)", border: "rgba(255,59,92,0.4)" };
  }
  if (score > 30) {
    return { label: "CAUTION", color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.35)" };
  }
  return { label: "VERIFIED SAFE", color: "#00FF94", bg: "rgba(0,255,148,0.07)", border: "rgba(0,255,148,0.3)" };
}

export default function JupiterPage() {
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const lastMint = useRef<string | null>(null);

  const scanToken = useCallback(async (mint: string) => {
    if (!mint || mint === lastMint.current) return;
    lastMint.current = mint;
    setScanning(true);
    setScore(null);
    try {
      const res = await fetch(
        `/api/v1/score?mint=${encodeURIComponent(mint)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as ScoreResponse;
      setScore(data);
    } catch {
      // silent — never block the swap flow
    } finally {
      setScanning(false);
    }
  }, []);

  const initJupiter = useCallback(() => {
    if (typeof window === "undefined" || !window.Jupiter) return;
    window.Jupiter.init({
      endpoint: RPC,
      displayMode: "integrated",
      integratedTargetId: "jupiter-terminal",
      containerStyles: { minHeight: "500px", borderRadius: "0px" },
      formProps: {
        swapMode: "ExactIn",
        initialInputMint: "So11111111111111111111111111111111111111112",
      },
      onFormUpdate: (form: { inputMint?: string; outputMint?: string }) => {
        const mint = form.outputMint ?? form.inputMint;
        if (mint) void scanToken(mint);
      },
      onSuccess: ({
        quoteResponseMeta,
      }: {
        quoteResponseMeta?: { outputMint?: string };
      }) => {
        const mint = quoteResponseMeta?.outputMint;
        if (mint) void scanToken(mint);
      },
    });
  }, [scanToken]);

  const badge = scoreToBadge(score?.score, score?.verdict);
  const isHighRisk = badge?.label === "HIGH RISK";

  return (
    <>
      <Script
        src="https://terminal.jup.ag/main-v3.js"
        strategy="afterInteractive"
        onLoad={initJupiter}
      />

      <BetaNav />

      <main style={{ minHeight: "100vh", background: "#000000", color: "#FFFFFF" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "52px 24px 80px" }}>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#FF6B00",
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              Safe Swap · Powered by INTERLIGENS
            </div>
            <h1
              style={{
                fontSize: 44,
                fontWeight: 900,
                margin: "0 0 10px",
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
              }}
            >
              SWAP SAFELY.
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 460,
              }}
            >
              INTERLIGENS scans every token before you swap.
            </p>
          </div>

          {/* ── Score badge ──────────────────────────────────────────── */}
          <div style={{ minHeight: 44, marginBottom: 16 }}>
            {scanning && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "rgba(255,107,0,0.06)",
                  border: "1px solid rgba(255,107,0,0.2)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#FF6B00",
                    display: "inline-block",
                    animation: "pulse 1.2s infinite",
                  }}
                />
                Scanning token…
              </div>
            )}

            {!scanning && badge && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 18px",
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
                <span
                  style={{
                    width: 1,
                    height: 14,
                    background: "rgba(255,255,255,0.1)",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                  TigerScore{" "}
                  <span style={{ color: "#FFFFFF", fontWeight: 700 }}>
                    {score?.score ?? "—"}
                  </span>
                  /100
                </span>
                {score?.symbol && (
                  <>
                    <span
                      style={{
                        width: 1,
                        height: 14,
                        background: "rgba(255,255,255,0.1)",
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {score.symbol}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Jupiter Terminal ─────────────────────────────────────── */}
          <div
            style={{
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div id="jupiter-terminal" style={{ minHeight: 500 }} />

            {/* High-risk overlay */}
            {isHighRisk && (
              <div
                role="alert"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.82)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: 400,
                    padding: "28px 24px",
                    background: "#0a0a0a",
                    border: "1px solid rgba(255,59,92,0.45)",
                    borderRadius: 10,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#FF3B5C",
                      fontWeight: 800,
                      marginBottom: 10,
                    }}
                  >
                    High-risk token detected
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#FFFFFF",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    TigerScore {score?.score}/100
                  </div>
                  {score?.signals && score.signals.length > 0 && (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: "14px 0 0",
                        textAlign: "left",
                      }}
                    >
                      {score.signals.slice(0, 4).map((s) => (
                        <li
                          key={s.id}
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.7)",
                            padding: "5px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{s.label}</span>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#FF3B5C",
                              textTransform: "uppercase",
                              fontWeight: 700,
                            }}
                          >
                            {s.severity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setScore(null);
                      lastMint.current = null;
                    }}
                    style={{
                      marginTop: 18,
                      background: "rgba(255,59,92,0.15)",
                      color: "#FF3B5C",
                      border: "1px solid rgba(255,59,92,0.4)",
                      padding: "9px 20px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Dismiss — proceed at own risk
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Caution signals (non-blocking) ───────────────────────── */}
          {badge?.label === "CAUTION" && score?.signals && score.signals.length > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "rgba(255,184,0,0.06)",
                border: "1px solid rgba(255,184,0,0.25)",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "#FFB800",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Suspicious signals — review before signing
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {score.signals.slice(0, 3).map((s) => (
                  <li
                    key={s.id}
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.65)",
                      padding: "4px 0",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{s.label}</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#FFB800",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {s.severity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Disclaimer ───────────────────────────────────────────── */}
          <p
            style={{
              marginTop: 28,
              fontSize: 11,
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            Signal-based analysis. Not financial advice.
          </p>
        </div>
      </main>
    </>
  );
}
