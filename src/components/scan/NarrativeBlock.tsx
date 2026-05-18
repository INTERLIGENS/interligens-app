"use client";
// src/components/scan/NarrativeBlock.tsx

import React from "react";
import type { NarrativeResult } from "@/lib/narrative/generator";

interface Props {
  result: NarrativeResult;
  lang: "en" | "fr";
}

const COPY = {
  en: { header: "HOW THE MONEY MOVED" },
  fr: { header: "COMMENT L'ARGENT EST PARTI" },
};

function confidenceColor(c: string): string {
  if (c === "HIGH")   return "#34d399";
  if (c === "MEDIUM") return "#FFB800";
  return "#FF3B5C";
}

export default function NarrativeBlock({ result, lang }: Props) {
  const text = lang === "fr" ? result.narrative_fr : result.narrative_en;
  if (!text) return null;

  const t = COPY[lang];

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-black/40 px-4 py-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
          {t.header}
        </span>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
          style={{
            color: confidenceColor(result.confidence),
            borderColor: confidenceColor(result.confidence) + "55",
            background: confidenceColor(result.confidence) + "11",
          }}
        >
          {result.confidence}
        </span>
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed max-w-prose">
        {text}
      </p>
    </div>
  );
}
