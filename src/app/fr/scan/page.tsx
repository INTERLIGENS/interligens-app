"use client";

import React, { useState, useCallback } from "react";
import ScoreCard from "@/components/scan/ScoreCard";
import type { PublicScoreResponse } from "@/lib/publicScore/schema";

export default function ScanPageFR() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(data.message ?? data.error ?? "Erreur inconnue");
        return;
      }

      setResult(data as PublicScoreResponse);
    } catch {
      setError("Erreur reseau. Veuillez reessayer.");
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
          Scannez avant de swapper
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
          placeholder="Collez une adresse de token Solana"
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
          {loading ? "ANALYSE..." : "SCANNER"}
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
          <ScoreCard data={result} locale="fr" />

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
            Vous continuez a vos risques ?{" "}
            <a
              href="https://jup.ag"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#666", textDecoration: "underline" }}
            >
              Swapper sur Jupiter
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
        Propulse par INTERLIGENS | app.interligens.com
      </footer>
    </div>
  );
}
