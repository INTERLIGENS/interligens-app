"use client";
import React from "react";

export interface MMScanResult {
  ok: boolean;
  address: string;
  chain: "sol" | "eth";
  mmScore: number;
  verdict: "CLEAN" | "SUSPICIOUS" | "MANIPULATED";
  signals: string[];
  signalsFr: string[];
  drivers: Array<{ id: string; label: string; severity: string; delta: number; why: string }>;
  sampleSize: number;
  fallback: boolean;
  fallbackReason?: string;
}

interface Props {
  result: MMScanResult | null;
  locale: "en" | "fr";
}

const COLORS = {
  MANIPULATED: "#FF3B5C",
  SUSPICIOUS: "#FFB800",
  CLEAN: "#6B7280",
} as const;

const CARD = "#111111";

const WaveIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M1 8 Q3 4 5 8 T9 8 T13 8 T16 8"
      stroke={color}
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export default function MMScoreBadge({ result, locale }: Props) {
  if (!result) return null;

  const isFr = locale === "fr";
  const verdict = result.verdict;
  const color = COLORS[verdict];
  const signalList = isFr ? result.signalsFr : result.signals;
  const firstSignal = signalList[0] ?? (isFr ? "Aucun signal" : "No signal");

  // CLEAN → silent. Only surface if fallback (data unavailable).
  if (verdict === "CLEAN") {
    if (!result.fallback) return null;
    const muted = "#6B7280";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <WaveIcon color={muted} />
        <span style={{ fontSize: 11, color: muted, fontFamily: "monospace" }}>
          {isFr ? "Signal MM indisponible" : "No MM signal (limited on-chain data)"}
        </span>
      </div>
    );
  }

  // SUSPICIOUS (amber) / MANIPULATED (red) → card with colored border.
  const eyebrow =
    verdict === "MANIPULATED"
      ? isFr
        ? "MARCHE MANIPULE"
        : "MARKET MANIPULATION"
      : isFr
        ? "ACTIVITE SUSPECTE"
        : "SUSPICIOUS MM ACTIVITY";

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <WaveIcon color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.15em",
            color,
            fontFamily: "monospace",
            marginBottom: 4,
          }}
        >
          {eyebrow} · MM {result.mmScore}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.5 }}>
          {firstSignal}
        </div>
        {signalList.length > 1 && (
          <ul
            style={{
              margin: "6px 0 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {signalList.slice(1, 4).map((s, i) => (
              <li
                key={i}
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  fontFamily: "monospace",
                }}
              >
                · {s}
              </li>
            ))}
          </ul>
        )}
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: "#6B7280",
            fontFamily: "monospace",
          }}
        >
          {isFr
            ? `Basé sur ${result.sampleSize} transferts analysés`
            : `Based on ${result.sampleSize} transfers analyzed`}
        </div>
      </div>
    </div>
  );
}
