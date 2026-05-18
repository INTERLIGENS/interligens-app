"use client";
import BetaNav from "@/components/beta/BetaNav";
import { useState, useEffect } from "react";

const BG = "#0A0C10";
const SURFACE = "#111318";
const BORDER = "#1E2028";
const BRAND = "#F85B05";
const ACCENT = "#FF6B00";
const RED = "#FF3B5C";
const GREEN = "#22C55E";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const DIMMED = "#3B3F4A";

export interface ScanEntry {
  address: string;
  chain: string;
  score: number | null;
  tier: string | null;
  headline: string | null;
  scannedAt: string;
}

const STORAGE_KEY = "interligens_scan_history";

export function pushScanHistory(entry: ScanEntry) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const history: ScanEntry[] = raw ? JSON.parse(raw) : [];
    // Deduplicate by address+chain, keep most recent
    const filtered = history.filter(
      (h) => !(h.address === entry.address && h.chain === entry.chain),
    );
    filtered.unshift(entry);
    // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // localStorage unavailable
  }
}

function tierColor(tier: string | null) {
  if (!tier) return MUTED;
  const t = tier.toUpperCase();
  if (t === "RED" || t === "CRITICAL" || t === "HIGH") return RED;
  if (t === "ORANGE" || t === "MEDIUM") return BRAND;
  if (t === "GREEN" || t === "LOW") return GREEN;
  return MUTED;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ScanEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <BetaNav />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ color: TEXT, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
              Scan History
            </h1>
            <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
              Your recent scans stored locally in this browser.
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                background: "transparent",
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                color: DIMMED,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                fontFamily: "monospace",
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              CLEAR ALL
            </button>
          )}
        </div>

        {/* Empty state */}
        {history.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: DIMMED,
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.1em", marginBottom: 16 }}>
              NO SCANS YET
            </div>
            <a
              href="/scan"
              style={{
                color: BRAND,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "monospace",
                textDecoration: "none",
              }}
            >
              SCAN YOUR FIRST ADDRESS →
            </a>
          </div>
        )}

        {/* History list */}
        {history.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((entry, i) => (
              <a
                key={`${entry.address}-${i}`}
                href={`/en/demo?address=${encodeURIComponent(entry.address)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  padding: "14px 18px",
                  textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = BRAND + "30")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = BORDER)}
              >
                {/* Score */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `2px solid ${tierColor(entry.tier)}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: tierColor(entry.tier),
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}
                  >
                    {entry.score ?? "—"}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span
                      style={{
                        color: TEXT,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.address}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        fontFamily: "monospace",
                        color: ACCENT,
                        padding: "1px 6px",
                        borderRadius: 2,
                        border: `1px solid ${ACCENT}25`,
                        background: ACCENT + "08",
                        flexShrink: 0,
                      }}
                    >
                      {entry.chain}
                    </span>
                  </div>
                  {entry.headline && (
                    <div
                      style={{
                        color: MUTED,
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.headline}
                    </div>
                  )}
                </div>

                {/* Tier + date */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {entry.tier && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        fontFamily: "monospace",
                        color: tierColor(entry.tier),
                        padding: "2px 7px",
                        borderRadius: 3,
                        border: `1px solid ${tierColor(entry.tier)}25`,
                        background: tierColor(entry.tier) + "10",
                        marginBottom: 4,
                      }}
                    >
                      {entry.tier.toUpperCase()}
                    </span>
                  )}
                  <div style={{ color: DIMMED, fontSize: 9, fontFamily: "monospace" }}>
                    {new Date(entry.scannedAt).toLocaleDateString()}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
