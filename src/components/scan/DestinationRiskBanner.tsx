"use client";
// src/components/scan/DestinationRiskBanner.tsx

import React from "react";
import type { DestinationRiskResult } from "@/lib/destination-risk/checker";

interface Props {
  result: DestinationRiskResult;
  lang: "en" | "fr";
}

export default function DestinationRiskBanner({ result, lang }: Props) {
  if (result.risk_level === "SAFE" || result.risk_level === "LOW") return null;

  const isCritical = result.risk_level === "CRITICAL";
  const isHigh     = result.risk_level === "HIGH";

  const borderColor = isCritical ? "#FF3B5C" : isHigh ? "#FFB800" : "#94a3b8";
  const bgColor     = isCritical ? "rgba(255,59,92,0.08)" : isHigh ? "rgba(255,184,0,0.08)" : "rgba(148,163,184,0.06)";
  const textColor   = isCritical ? "#FF3B5C" : isHigh ? "#FFB800" : "#94a3b8";

  const headline =
    isCritical
      ? lang === "fr"
        ? "STOP — DESTINATION DANGEREUSE"
        : "STOP — DANGEROUS DESTINATION"
      : isHigh
        ? lang === "fr"
          ? "ATTENTION — SIGNAUX DE RISQUE DÉTECTÉS"
          : "CAUTION — RISK SIGNALS DETECTED"
        : lang === "fr"
          ? "VÉRIFICATION RECOMMANDÉE"
          : "REVIEW RECOMMENDED";

  const eyebrow =
    lang === "fr"
      ? "VÉRIFICATION DESTINATION"
      : "DESTINATION RISK CHECK";

  const explanation = lang === "fr" ? result.explanation_fr : result.explanation_en;

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}44`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Module eyebrow */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#4b5563",
          marginBottom: 4,
        }}
      >
        {eyebrow}
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: textColor,
          marginBottom: 8,
        }}
      >
        {headline}
      </div>

      {/* Explanation */}
      <p
        style={{
          fontSize: 13,
          color: "#d1d5db",
          margin: "0 0 12px 0",
          lineHeight: 1.6,
        }}
      >
        {explanation}
      </p>

      {/* Flags */}
      {result.flags.length > 0 && (
        <ul
          style={{
            margin: "0 0 12px 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {result.flags.map((flag, i) => (
            <li
              key={i}
              style={{
                fontSize: 11,
                color: "#94a3b8",
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: textColor }}>▸</span>
              <span style={{ color: "#6b7280", marginRight: 4 }}>[{flag.type}]</span>
              {flag.label}
              <span style={{ color: "#374151", marginLeft: 4 }}>· {flag.source}</span>
            </li>
          ))}
        </ul>
      )}

      {/* TigerScore if available */}
      {result.tiger_score !== undefined && (
        <div
          style={{
            fontSize: 10,
            color: "#6b7280",
            marginBottom: isCritical ? 12 : 0,
            fontFamily: "monospace",
          }}
        >
          TigerScore {result.tiger_score}/100
        </div>
      )}

      {/* Block button for CRITICAL */}
      {isCritical && (
        <div
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "6px 18px",
            background: "#FF3B5C",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#fff",
            cursor: "default",
          }}
        >
          {lang === "fr" ? "BLOQUER" : "BLOCK"}
        </div>
      )}
    </div>
  );
}
