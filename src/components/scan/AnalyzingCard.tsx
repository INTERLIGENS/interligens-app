"use client";
import React, { useEffect, useState } from "react";

const STEPS_EN = [
  "Fetching on-chain data…",
  "Analyzing wallet clusters…",
  "Computing risk signals…",
  "Building final verdict…",
];
const STEPS_FR = [
  "Récupération des données on-chain…",
  "Analyse des groupes de wallets…",
  "Calcul des signaux de risque…",
  "Construction du verdict final…",
];

interface Props { locale?: "en" | "fr"; step?: number; }

export default function AnalyzingCard({ locale = "en", step = 0 }: Props) {
  const steps = locale === "fr" ? STEPS_FR : STEPS_EN;
  const label = locale === "fr" ? "ANALYSE EN COURS" : "ANALYSING";
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDot(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/60 p-8 flex flex-col items-center gap-5">
      {/* Spinner ring */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-20 h-20 absolute animate-spin" style={{ animationDuration: "1.4s" }} viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke="#f97316" strokeWidth="6"
            strokeDasharray="60 154" strokeLinecap="round" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-2">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 transition-opacity duration-300 ${i <= step ? "opacity-100" : "opacity-25"}`}>
            {i < step ? (
              <span className="text-emerald-400 text-xs shrink-0">✓</span>
            ) : i === step ? (
              <span className="text-orange-400 text-xs shrink-0">{"·".repeat(dot + 1)}</span>
            ) : (
              <span className="text-zinc-700 text-xs shrink-0">○</span>
            )}
            <span className={`text-xs ${i === step ? "text-zinc-200 font-semibold" : i < step ? "text-zinc-400" : "text-zinc-600"}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
