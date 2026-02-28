"use client";
import React from "react";

interface VerdictProps {
  score: number;
  tier: string;
  proofs: string[];
  isDeep: boolean;
  lang?: "en" | "fr";
}

const COPY = {
  en: {
    GREEN:  { badge: "LOW RISK",    actions: ["Safe to interact.", "Double-check the dApp URL.", "Stay alert to future changes."] },
    ORANGE: { badge: "MEDIUM RISK", actions: ["Use a burner wallet.", "Test with a small amount first.", "Revoke approvals after use."] },
    RED:    { badge: "HIGH RISK",   actions: ["Do NOT interact.", "Do NOT sign anything.", "Revoke all approvals now."] },
    confidence: "Confidence", high: "High", medium: "Medium",
    proofs: "Top Signals", todo: "What to do now", noProof: "Awaiting evidence",
  },
  fr: {
    GREEN:  { badge: "RISQUE FAIBLE",  actions: ["Sûr à utiliser.", "Vérifie l'URL du dApp.", "Surveille les changements futurs."] },
    ORANGE: { badge: "RISQUE MOYEN",   actions: ["Utilise un wallet jetable.", "Teste avec un petit montant.", "Révoque les approvals après."] },
    RED:    { badge: "RISQUE ÉLEVÉ",   actions: ["N'interagis PAS.", "Ne signe RIEN.", "Révoque tout immédiatement."] },
    confidence: "Confiance", high: "Élevée", medium: "Moyenne",
    proofs: "Signaux principaux", todo: "À faire maintenant", noProof: "En attente de preuves",
  },
};

export default function VerdictCard({ score, tier, proofs, isDeep, lang = "en" }: VerdictProps) {
  const t = COPY[lang] ?? COPY.en;
  const tierKey = (["GREEN","ORANGE","RED"].includes(tier) ? tier : "GREEN") as "GREEN"|"ORANGE"|"RED";
  const { badge, actions } = t[tierKey];
  const confidence = isDeep ? t.high : t.medium;

  const colors = {
    GREEN:  "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    ORANGE: "text-[#F85B05] bg-[#F85B05]/10 border-[#F85B05]/30",
    RED:    "text-red-500 bg-red-500/10 border-red-500/30",
  }[tierKey];

  const strokeColor = { GREEN: "#34d399", ORANGE: "#F85B05", RED: "#ef4444" }[tierKey];
  const displayProofs = proofs?.length ? proofs.slice(0, 3) : [t.noProof];

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-full border border-slate-800 bg-slate-950 w-44 h-44 relative">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle cx="50" cy="50" r="48" fill="none" stroke={strokeColor} strokeWidth="4"
              strokeDasharray={`${Math.max(0, Math.min(100, score)) * 3.01} 301`}
              className="transition-all duration-700 ease-out" />
          </svg>
          <span className="text-sm text-slate-400 font-medium tracking-widest uppercase mb-1 z-10">Score</span>
          <span className="text-5xl font-black text-white z-10">{Math.max(0, Math.min(100, score))}</span>
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Verdict</h2>
              <div className="flex gap-3 items-center">
                <span className={`px-4 py-1 rounded-full text-sm font-bold tracking-wide border ${colors}`}>{badge}</span>
                <span className="text-slate-500 text-sm">{t.confidence}: <span className="text-slate-300 font-medium">{confidence}</span></span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">{t.proofs}</h3>
              <ul className="space-y-2">
                {displayProofs.map((proof, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-[#F85B05] mt-0.5">●</span>{proof}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t.todo}</h3>
              <ul className="space-y-1">
                {actions.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <span className={tierKey === "RED" ? "text-red-500" : tierKey === "ORANGE" ? "text-[#F85B05]" : "text-emerald-400"}>→</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
