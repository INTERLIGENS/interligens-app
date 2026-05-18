"use client";
// src/components/scan/SignatureIntentBanner.tsx

import React from "react";
import type { SignatureIntentResult } from "@/lib/signature-intent/analyzer";

interface Props {
  result: SignatureIntentResult;
  lang: "en" | "fr";
}

export default function SignatureIntentBanner({ result, lang }: Props) {
  if (result.risk_level === "SAFE" || result.risk_level === "LOW") return null;

  const isCritical = result.risk_level === "CRITICAL";
  const isHigh     = result.risk_level === "HIGH";

  const borderColor = isCritical ? "#FF3B5C" : isHigh ? "#FFB800" : "#94a3b8";
  const bgColor     = isCritical ? "rgba(255,59,92,0.08)" : isHigh ? "rgba(255,184,0,0.08)" : "rgba(148,163,184,0.06)";
  const textColor   = isCritical ? "#FF3B5C" : isHigh ? "#FFB800" : "#94a3b8";

  const headline =
    isCritical
      ? lang === "fr"
        ? "STOP — TRANSACTION DANGEREUSE"
        : "STOP — DANGEROUS TRANSACTION"
      : isHigh
        ? lang === "fr"
          ? "ATTENTION — VÉRIFIEZ AVANT DE SIGNER"
          : "CAUTION — REVIEW BEFORE SIGNING"
        : lang === "fr"
          ? "TRANSACTION À VÉRIFIER"
          : "REVIEW RECOMMENDED";

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
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: textColor,
          marginBottom: 6,
          fontFamily: "Inter, system-ui, sans-serif",
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
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {explanation}
      </p>

      {/* Red flags */}
      {result.red_flags.length > 0 && (
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
          {result.red_flags.map((flag, i) => (
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
              <span style={{ color: textColor }}>▸</span> {flag}
            </li>
          ))}
        </ul>
      )}

      {/* Action button — only for CRITICAL */}
      {isCritical && (
        <div
          style={{
            display: "inline-block",
            padding: "6px 18px",
            background: "#FF3B5C",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#fff",
            cursor: "default",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {lang === "fr" ? "REJETER" : "REJECT"}
        </div>
      )}
    </div>
  );
}
