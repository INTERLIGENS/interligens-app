"use client";
// src/components/scan/OffChainCredibilityBlock.tsx

import React from "react";
import type { OffChainResult, CredBand, SignalStatus } from "@/lib/off-chain-credibility/engine";

interface Props {
  result: OffChainResult;
  lang: "en" | "fr";
}

const DOT: Record<SignalStatus, string> = {
  RED:     "#FF3B5C",
  AMBER:   "#FFB800",
  GREEN:   "#34d399",
  NEUTRAL: "#6b7280",
};

const DOT_CHAR: Record<SignalStatus, string> = {
  RED:     "🔴",
  AMBER:   "🟡",
  GREEN:   "🟢",
  NEUTRAL: "●",
};

const BAND_LABEL: Record<CredBand, { en: string; fr: string }> = {
  VERY_LOW: { en: "VERY LOW", fr: "TRÈS FAIBLE" },
  LOW:      { en: "LOW",      fr: "FAIBLE" },
  MIXED:    { en: "MIXED",    fr: "MITIGÉ" },
  GOOD:     { en: "GOOD",     fr: "BON" },
  STRONG:   { en: "STRONG",   fr: "FORT" },
};

const BAND_COLOR: Record<CredBand, string> = {
  VERY_LOW: "#FF3B5C",
  LOW:      "#FFB800",
  MIXED:    "#94a3b8",
  GOOD:     "#34d399",
  STRONG:   "#34d399",
};

export default function OffChainCredibilityBlock({ result, lang }: Props) {
  if (!result || result.signals.length === 0) return null;

  const bandLabel  = BAND_LABEL[result.band][lang];
  const bandColor  = BAND_COLOR[result.band];
  const isWeak     = result.score <= 40;
  const isFr       = lang === "fr";
  const summary    = isFr ? result.summary_fr : result.summary_en;

  return (
    <div
      className={[
        "py-3",
        isWeak ? "border-l-2 border-[#FF3B5C] pl-3" : "",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
          {isFr ? "CRÉDIBILITÉ OFF-CHAIN" : "OFF-CHAIN CREDIBILITY"}
        </span>
        <span
          style={{ color: bandColor }}
          className="text-[10px] font-extrabold uppercase tracking-widest"
        >
          {result.score}/100 · {bandLabel}
        </span>
      </div>

      {/* Signals list */}
      <div className="flex flex-col gap-1">
        {result.signals.map((sig) => {
          const label = isFr ? sig.label_fr : sig.label_en;
          const dot   = DOT_CHAR[sig.status];
          const color = DOT[sig.status];
          return (
            <div
              key={sig.id}
              className="flex items-center gap-2"
              style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}
            >
              <span style={{ fontSize: 12 }}>{dot}</span>
              <span style={{ color }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <p
        className="text-xs text-zinc-400 italic mt-2 leading-relaxed"
        style={{ maxWidth: "36rem" }}
      >
        {summary}
      </p>
    </div>
  );
}
