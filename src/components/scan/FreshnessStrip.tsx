"use client";
// src/components/scan/FreshnessStrip.tsx

import React from "react";
import type { FreshnessResult, FreshnessSignal } from "@/lib/freshness/engine";

interface Props {
  result: FreshnessResult;
  lang: "en" | "fr";
}

function chipCls(severity: string): string {
  if (severity === "CRITICAL") return "border-[#FF3B5C]/60 bg-[#FF3B5C]/10 text-[#FF3B5C]";
  if (severity === "HIGH")     return "border-[#FFB800]/60 bg-[#FFB800]/10 text-[#FFB800]";
  return "border-zinc-500/60 bg-zinc-500/10 text-zinc-300";
}

function Chip({ signal, lang }: { signal: FreshnessSignal; lang: "en" | "fr" }) {
  const label = lang === "fr" ? signal.label_fr : signal.label_en;
  const detail = lang === "fr" ? signal.detail_fr : signal.detail_en;
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap",
        chipCls(signal.severity),
      ].join(" ")}
      title={detail}
    >
      ⚡ {label}
    </span>
  );
}

export default function FreshnessStrip({ result, lang }: Props) {
  if (!result || result.severity === "NONE" || !result.signals.length) return null;

  const isCriticalOrHigh = result.severity === "CRITICAL" || result.severity === "HIGH";
  const top4 = result.signals.slice(0, 4);

  return (
    <div
      className={[
        "flex items-center gap-2 overflow-x-auto py-2",
        isCriticalOrHigh ? "border-l-2 border-[#FF6B00] pl-3" : "",
      ].join(" ")}
    >
      {top4.map((sig) => (
        <Chip key={sig.id} signal={sig} lang={lang} />
      ))}
    </div>
  );
}
