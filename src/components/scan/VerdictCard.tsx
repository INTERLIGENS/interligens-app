"use client";

import React from "react";

interface VerdictProps {
  score: number;
  tier: string;
  proofs: string[];
  isDeep: boolean;
  lang?: "en" | "fr";
}

export default function VerdictCard({ score, tier, proofs, isDeep, lang = "en" }: VerdictProps) {
  const isFR = lang === "fr";
  const confidence = isDeep ? (isFR ? "Élevée" : "High") : (isFR ? "Moyenne" : "Medium");

  const colors =
    {
      GREEN: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      ORANGE: "text-[#F85B05] bg-[#F85B05]/10 border-[#F85B05]/30",
      RED: "text-red-500 bg-red-500/10 border-red-500/30",
    }[tier] || "text-slate-400 bg-slate-800 border-slate-700";

  let actionText = isFR ? "Vérifie les URLs / contrats avant toute action." : "Proceed, but verify dApp URLs.";
  if (tier === "ORANGE") actionText = isFR ? "Wallet jetable obligatoire. Évite les approvals illimités. Petits montants." : "Use burner wallet, avoid unlimited approvals, test with small amounts.";
  if (tier === "RED") actionText = isFR ? "N'interagis pas. Ne signe rien. Révoque tout immédiatement." : "Do not interact. Do not approve. Revoke existing approvals immediately.";

  const displayProofs = proofs?.length ? proofs.slice(0, 3) : [isFR ? "En attente de preuves détaillées" : "Awaiting detailed evidence"];

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 rounded-full border border-slate-800 bg-slate-950 w-44 h-44 relative">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke={tier === "GREEN" ? "#34d399" : tier === "ORANGE" ? "#F85B05" : "#ef4444"}
              strokeWidth="4"
              strokeDasharray={`${Math.max(0, Math.min(100, score)) * 3.01} 301`}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <span className="text-sm text-slate-400 font-medium tracking-widest uppercase mb-1 z-10">Score</span>
          <span className="text-5xl font-black text-white z-10">{Math.max(0, Math.min(100, score))}</span>
        </div>

        <div className="flex-1 w-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Verdict</h2>
              <div className="flex gap-3 items-center">
                <span className={`px-4 py-1 rounded-full text-sm font-bold tracking-wide border ${colors}`}>
                  {tier} RISK
                </span>
                <span className="text-slate-500 text-sm">
                  {isFR ? "Confiance" : "Confidence"}: <span className="text-slate-300 font-medium">{confidence}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">{isFR ? "Preuves principales" : "Top Proofs"}</h3>
              <ul className="space-y-2">
                {displayProofs.map((proof, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-[#F85B05] mt-0.5">●</span>
                    {proof}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{isFR ? "À faire maintenant" : "What to do now"}</h3>
              <p className="text-sm font-medium text-slate-200">{actionText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
