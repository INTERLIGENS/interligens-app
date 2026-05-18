"use client";
// src/components/kol/ShillToExitTimeline.tsx
// Vertical forensic timeline — Shill → Exit proof.
// Props: { result: ShillToExitResult; lang: 'en' | 'fr' }

import React from "react";
import type { ShillToExitResult, TimelineEvent } from "@/lib/shill-to-exit/engine";

interface Props {
  result: ShillToExitResult;
  lang: "en" | "fr";
}

function eventColor(type: TimelineEvent["type"]): { fg: string; bg: string; border: string } {
  if (type === "SHILL")      return { fg: "#FFB800", bg: "rgba(255,184,0,0.08)",   border: "rgba(255,184,0,0.35)" };
  if (type === "CASHOUT")    return { fg: "#FF3B5C", bg: "rgba(255,59,92,0.08)",   border: "rgba(255,59,92,0.35)" };
  if (type === "SELL")       return { fg: "#FF3B5C", bg: "rgba(255,59,92,0.08)",   border: "rgba(255,59,92,0.35)" };
  return { fg: "#FF6B00", bg: "rgba(255,107,0,0.08)", border: "rgba(255,107,0,0.35)" };
}

function eventIcon(type: TimelineEvent["type"]): string {
  if (type === "SHILL")      return "📢";
  if (type === "CASHOUT")    return "💸";
  if (type === "SELL")       return "💸";
  return "📉";
}

function fmtTs(d: Date): string {
  try {
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "—";
  }
}

function fmtDelta(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  if (minutes === 0) return "T+0";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `T+${m}m`;
  if (m === 0) return `T+${h}h`;
  return `T+${h}h${m}m`;
}

const COPY = {
  en: {
    header: "SHILL-TO-EXIT DETECTED",
    subtitle: "This KOL promoted while selling.",
    totalProceeds: "Total proceeds",
    maxDelay: "Max delay",
    confidence: "Confidence",
    viewPost: "View post →",
    viewTx: "tx",
  },
  fr: {
    header: "SHILL-TO-EXIT DÉTECTÉ",
    subtitle: "Ce KOL a promu pendant qu'il vendait.",
    totalProceeds: "Produits totaux",
    maxDelay: "Délai max",
    confidence: "Confiance",
    viewPost: "Voir le post →",
    viewTx: "tx",
  },
};

function confidenceColor(c: string): string {
  if (c === "HIGH")   return "#FF3B5C";
  if (c === "MEDIUM") return "#FFB800";
  return "#FF6B00";
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtDelayMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ShillToExitTimeline({ result, lang }: Props) {
  if (!result.detected || result.timeline.length === 0) return null;

  const t = COPY[lang];
  const top8 = result.timeline.slice(0, 8);

  return (
    <div
      className="w-full rounded-xl border border-[#FF3B5C]/30 bg-black overflow-hidden"
      style={{ borderLeft: "3px solid #FF3B5C" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#FF3B5C]/20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3B5C]">
              {t.header}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                {t.totalProceeds}
              </span>
              <span className="text-sm font-black text-[#FFB800] font-mono">
                {fmtUsd(result.total_proceeds_usd)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                {t.confidence}
              </span>
              <span
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: confidenceColor(result.confidence) }}
              >
                {result.confidence}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 flex flex-col gap-0">
        {top8.map((ev, idx) => {
          const col = eventColor(ev.type);
          const isLast = idx === top8.length - 1;
          return (
            <div key={idx} className="flex gap-3 min-w-0">
              {/* Left column: icon + vertical line */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                <div
                  className="flex items-center justify-center rounded-full text-[12px] shrink-0"
                  style={{
                    width: 26,
                    height: 26,
                    background: col.bg,
                    border: `1px solid ${col.border}`,
                  }}
                >
                  {eventIcon(ev.type)}
                </div>
                {!isLast && (
                  <div
                    className="flex-1 w-[1px] my-1"
                    style={{ background: "rgba(255,255,255,0.06)", minHeight: 12 }}
                  />
                )}
              </div>

              {/* Right column: content */}
              <div className={`flex-1 min-w-0 pb-3 ${isLast ? "" : ""}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.12em] shrink-0"
                        style={{ color: col.fg }}
                      >
                        {ev.type}
                      </span>
                      {ev.delta_minutes !== undefined && (
                        <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                          {fmtDelta(ev.delta_minutes)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-200 leading-snug mt-0.5">
                      {lang === "fr" ? ev.label_fr : ev.label_en}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                      {fmtTs(new Date(ev.timestamp))}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 items-start mt-0.5">
                    {ev.amount_usd && ev.amount_usd > 0 && (
                      <span className="text-[11px] font-black font-mono text-[#FF3B5C]">
                        {fmtUsd(ev.amount_usd)}
                      </span>
                    )}
                    {ev.evidence_url && (
                      <a
                        href={ev.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[#FFB800]/70 hover:text-[#FFB800] transition-colors whitespace-nowrap"
                      >
                        {t.viewPost}
                      </a>
                    )}
                    {ev.tx_hash && (
                      <span className="text-[10px] font-mono text-zinc-600">
                        {t.viewTx}:{ev.tx_hash.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: max delay */}
      {result.max_delta_minutes > 0 && (
        <div className="px-4 py-2 border-t border-zinc-900 flex gap-4">
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
            {t.maxDelay}
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {fmtDelayMinutes(result.max_delta_minutes)}
          </span>
        </div>
      )}
    </div>
  );
}
