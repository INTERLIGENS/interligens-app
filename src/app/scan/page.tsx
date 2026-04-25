"use client";

import React, { useState, useCallback } from "react";
import ScoreCard from "@/components/scan/ScoreCard";
import type { PublicScoreResponse } from "@/lib/publicScore/schema";

export default function ScanPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  const handleScan = useCallback(async () => {
    const mint = input.trim();
    if (!mint) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/score?mint=${encodeURIComponent(mint)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Unknown error");
        return;
      }

      setResult(data as PublicScoreResponse);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleScan();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "monospace",
        color: "#FFFFFF",
        padding: "0 16px",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", paddingTop: 60, marginBottom: 40 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#FF6B00", letterSpacing: 2 }}>
          INTERLIGENS
        </div>
        <div style={{ fontSize: 14, color: "#888", marginTop: 8 }}>
          Scan before you swap
        </div>
      </header>

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
          maxWidth: 520,
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a Solana token address or name"
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            background: "#111118",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "12px 16px",
            color: "#fff",
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={handleScan}
          disabled={loading || !input.trim()}
          style={{
            background: loading ? "#994000" : "#FF6B00",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "12px 24px",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "SCANNING..." : "SCAN"}
        </button>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #222",
              borderTop: "3px solid #FF6B00",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            color: "#FF3B5C",
            fontSize: 13,
            marginBottom: 24,
            textAlign: "center",
            maxWidth: 480,
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ width: "100%", maxWidth: 520, marginBottom: 32 }}>
          <ScoreCard data={result} locale="en" />

          {/* PROJECT INFO DROPDOWN */}
          {(() => {
            const r = result as Record<string, unknown> & {
              ext?: Record<string, unknown>;
              meta?: Record<string, unknown>;
              info?: Record<string, unknown>;
              extensions?: Record<string, unknown>;
            };
            const pick = (k: string): string | null => {
              const v =
                (r?.[k] as string | undefined) ??
                (r?.ext?.[k] as string | undefined) ??
                (r?.meta?.[k] as string | undefined) ??
                (r?.info?.[k] as string | undefined) ??
                (r?.extensions?.[k] as string | undefined);
              return typeof v === "string" && v.trim() ? v : null;
            };
            const site = pick("website");
            const wp = pick("whitepaper");
            const tw = pick("twitter") ?? pick("twitter_username");
            const tg = pick("telegram");
            const hasAny = !!(site || wp || tw || tg);

            const linkRow = (label: string, href: string, display: string) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>{label}</span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    textDecoration: "none",
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {display}
                </a>
              </div>
            );

            return (
              <div
                style={{
                  marginTop: 16,
                  background: "#111118",
                  border: "1px solid #2a2a34",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setShowProjectInfo((v) => !v)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#666",
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  <span>PROJECT INFO</span>
                  <span
                    style={{
                      display: "inline-block",
                      transform: showProjectInfo ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms ease",
                      fontSize: 10,
                    }}
                  >
                    ▾
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: showProjectInfo ? 240 : 0,
                    overflow: "hidden",
                    transition: "max-height 220ms ease",
                  }}
                >
                  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {!hasAny && (
                      <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
                        No project info available
                      </div>
                    )}
                    {site && linkRow("Website", site.startsWith("http") ? site : `https://${site}`, site.replace(/^https?:\/\//, ""))}
                    {wp && linkRow("Whitepaper", wp.startsWith("http") ? wp : `https://${wp}`, "View →")}
                    {tw && linkRow("X / Twitter", tw.startsWith("http") ? tw : `https://x.com/${tw.replace("@", "")}`, tw.replace(/^https?:\/\/(x\.com|twitter\.com)\//, "@"))}
                    {tg && linkRow("Telegram", tg.startsWith("http") ? tg : `https://t.me/${tg.replace("@", "")}`, tg)}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* B3 — Swap anyway CTA */}
          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 12,
              color: "#555",
            }}
          >
            <span style={{ color: "#FF6B00" }}>!</span>{" "}
            Proceeding at your own risk?{" "}
            <a
              href="https://jup.ag"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#666", textDecoration: "underline" }}
            >
              Swap on Jupiter
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          paddingBottom: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#333",
        }}
      >
        Powered by INTERLIGENS | app.interligens.com
      </footer>
    </div>
  );
}
