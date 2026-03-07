"use client";
import React, { useEffect, useState, useCallback } from "react";

interface ClusterProof { type: string; tx_signature: string; timestamp: number; detail: string; }
interface Cluster { strength: string; heuristic: string; proofs: ClusterProof[]; status: string; }
interface RelatedProject { mint: string; symbol?: string; name?: string; status: string; link_score: number; shared_wallets: number; signals: string[]; }
interface GraphReport { clusters: Cluster[]; related_projects: RelatedProject[]; overall_status: string; }

// Tokens utilitaires/stablecoins — exclus du banner (noise)
const UTILITY_SYMBOLS = new Set([
  "USDC","USDT","SOL","WSOL","MSOL","JITOSOL","STSOL","BSOL","HSOL",
  "JPSOL","BNSOL","JSOL","LSOL","WBTC","ETH","WETH","DAI","BUSD",
  "TUSD","USDD","FRAX","USDH","USDR","UXD","CASH",
]);

function isUtility(p: RelatedProject): boolean {
  if (!p.symbol) return false;
  return UTILITY_SYMBOLS.has(p.symbol.toUpperCase());
}

// Confidence basé sur preuves corroborées
function computeConfidence(clusters: Cluster[]): "HIGH" | "MED" | "LOW" {
  const corrobClusters = clusters.filter(c => c.status === "CORROBORATED" && c.proofs.length > 0);
  const totalProofs = corrobClusters.reduce((n, c) => n + c.proofs.length, 0);
  const heuristicTypes = new Set(corrobClusters.map(c => c.heuristic));
  if (totalProofs >= 4 && heuristicTypes.size >= 2) return "HIGH";
  if (totalProofs >= 2 || heuristicTypes.size >= 1) return "MED";
  return "LOW";
}

export function detectRecidivism(g: GraphReport): {
  detected: boolean; corroboratedRelated: number; totalRelated: number;
  totalProofs: number; topRelated: RelatedProject[]; topProofs: ClusterProof[];
  confidence: "HIGH" | "MED" | "LOW";
} {
  const filtered = g.related_projects.filter(p => !isUtility(p));
  const corroboratedRelated = filtered.filter(p => p.status === "CORROBORATED" && p.link_score >= 80).length;
  const strongCluster = g.clusters.some(c =>
    c.status === "CORROBORATED" && c.proofs.length > 0 &&
    (c.heuristic === "shared_funder" || c.heuristic === "lp_overlap")
  );
  const totalProofs = g.clusters.reduce((n, c) => n + c.proofs.length, 0);
  const allProofs = g.clusters.flatMap(c => c.proofs).slice(0, 3);
  const topRelated = [...filtered].sort((a, b) => b.link_score - a.link_score).slice(0, 3);
  const hasGraphData = g.clusters.length > 0 || (g.related_projects ?? []).length > 0;
  const detected = corroboratedRelated > 0 || strongCluster
    || g.overall_status === "CONFIRMED"
    || (!hasGraphData && g.overall_status === "REFERENCED");
  const confidence = computeConfidence(g.clusters);
  return { detected, corroboratedRelated, totalRelated: filtered.length, totalProofs, topRelated, topProofs: allProofs, confidence };
}

const HEURISTIC_LABELS: Record<string, { en: string; fr: string }> = {
  shared_funder: { en: "Same Funder",          fr: "Même financeur" },
  co_trading:    { en: "Coordinated Trading",   fr: "Trading coordonné" },
  lp_overlap:    { en: "Same Liquidity (LP)",   fr: "Même liquidité (LP)" },
};

const CONFIDENCE_STYLE: Record<string, string> = {
  HIGH: "bg-red-500/20 border-red-500/30 text-red-400",
  MED:  "bg-orange-500/20 border-orange-500/30 text-orange-400",
  LOW:  "bg-zinc-700/40 border-zinc-600/30 text-zinc-400",
};

const T = {
  en: {
    title: "ALERT — Scam lineage detected",
    text: "On-chain links to wallets tied to prior pump & dump operations.",
    stats: (r: number, c: number, p: number) =>
      `At-risk related projects: ${r} (${c} corroborated) · Proofs: ${p} tx`,
    cta: "View evidence",
    ctaClose: "Close",
    openFull: "Open full graph →",
    topRelated: "Related projects (at risk)",
    sampleProofs: "Sample proofs (transactions)",
    confidence: "Confidence",
    confidenceLabels: { HIGH: "High", MED: "Med", LOW: "Low" } as Record<string,string>,
    heuristic: (h: string) => HEURISTIC_LABELS[h]?.en ?? h,
  },
  fr: {
    title: "ALERTE — Récidive détectée",
    text: "Liens on-chain vers des wallets impliqués dans des pump & dump précédents.",
    stats: (r: number, c: number, p: number) =>
      `Projets liés (à risque) : ${r} (${c} corroborés) · Preuves : ${p} tx`,
    cta: "Voir les preuves",
    ctaClose: "Fermer",
    openFull: "Ouvrir le graphe complet →",
    topRelated: "Projets liés (à risque)",
    sampleProofs: "Preuves (transactions)",
    confidence: "Confiance",
    confidenceLabels: { HIGH: "Haute", MED: "Moyenne", LOW: "Faible" } as Record<string,string>,
    heuristic: (h: string) => HEURISTIC_LABELS[h]?.fr ?? h,
  },
};

interface Props { mint: string; locale?: "en" | "fr"; graphData?: any; onDetected?: (confidence: "HIGH"|"MED"|"LOW") => void; }

export default function RecidivismAlertBanner({ mint, locale = "en", graphData, onDetected }: Props) {
  const t = T[locale];
  const [verdict, setVerdict] = useState<ReturnType<typeof detectRecidivism> | null>(null);
  const [open, setOpen] = useState(false);

  // Si graphData passé en prop → utiliser directement, sinon fetch
  const load = useCallback(async () => {
    if (!mint) return;
    try {
      let g: GraphReport;
      if (graphData?.clusters) {
        g = graphData;
      } else {
        const res = await fetch(`/api/scan/solana/graph?mint=${encodeURIComponent(mint)}&hops=1&days=30`);
        if (!res.ok) return;
        g = await res.json();
      }
      if (!g?.clusters) return;
      const v = detectRecidivism(g);
      setVerdict(v);
    } catch { /* silent */ }
  }, [mint, graphData]);

  useEffect(() => { void load(); }, [load]);

  if (!verdict?.detected) return null;

  const handleOpenFull = () => {
    const el = document.getElementById("scam-family-block");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const btn = el.querySelector<HTMLButtonElement>("[data-tab='related']");
      btn?.click();
    }, 400);
  };

  return (
    <div role="alert" className="relative overflow-hidden rounded-xl border border-red-500/40 bg-red-950/25"
      style={{ boxShadow: "0 0 32px rgba(239,68,68,0.10), inset 0 0 0 1px rgba(239,68,68,0.12)" }}>
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70" />

      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/25">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-red-400 font-black text-xs uppercase tracking-[0.16em]">{t.title}</p>
            {/* Confidence badge */}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${CONFIDENCE_STYLE[verdict.confidence]}`}>
              {t.confidence}: {t.confidenceLabels[verdict.confidence]}
            </span>
          </div>
          <p className="text-zinc-200 text-sm font-medium leading-snug mb-2">{t.text}</p>
          <p className="text-zinc-500 text-[11px] font-mono mb-2">
            {t.stats(verdict.totalRelated, verdict.corroboratedRelated, verdict.totalProofs)}
          </p>

          {/* Top 3 chips — filtered */}
          {verdict.topRelated.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {verdict.topRelated.map((p, i) => (
                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${p.status === "CORROBORATED" ? "bg-red-500/10 border-red-500/25 text-red-400" : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400"}`}>
                  {p.symbol ?? p.mint.slice(0, 8) + "…"}
                  <span className="font-mono text-[9px] opacity-70">{p.link_score}</span>
                </span>
              ))}
            </div>
          )}

          <button onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-red-400 hover:text-red-300 transition-colors">
            {open ? t.ctaClose : t.cta}
            <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        <span className="shrink-0 self-start inline-flex items-center px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-black uppercase tracking-widest">
          LINEAGE
        </span>
      </div>

      {/* Collapsible panel */}
      {open && (
        <div className="border-t border-red-500/15 px-5 py-4 space-y-4 bg-black/20">

          {/* Top 3 related projects (filtered, no stablecoins) */}
          {verdict.topRelated.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-2">{t.topRelated}</p>
              <div className="space-y-1.5">
                {verdict.topRelated.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-zinc-200 text-xs font-semibold truncate block">
                        {p.symbol ?? p.mint.slice(0, 12) + "…"}
                        {p.name && <span className="ml-1.5 text-zinc-600 text-[10px] font-normal">{p.name}</span>}
                      </span>
                      <span className="text-zinc-600 text-[10px] font-mono">{p.shared_wallets} wallets communs</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                      <span className={`text-sm font-black ${p.link_score >= 70 ? "text-red-400" : p.link_score >= 40 ? "text-orange-400" : "text-zinc-500"}`}>
                        {p.link_score}
                      </span>
                      {p.status === "CORROBORATED" && (
                        <span className="text-[8px] font-bold text-red-400/70 uppercase">✓ on-chain</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 proof txs */}
          {verdict.topProofs.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-2">{t.sampleProofs}</p>
              <div className="space-y-1.5">
                {verdict.topProofs.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-900/40 rounded-lg px-3 py-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase shrink-0 w-28">
                      {t.heuristic(p.type)}
                    </span>
                    <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[11px] text-orange-400/80 hover:text-orange-400 underline underline-offset-2 truncate">
                      {p.tx_signature.slice(0, 20)}…
                    </a>
                    <span className="shrink-0 text-[10px] text-zinc-600 ml-auto whitespace-nowrap">
                      {new Date(p.timestamp * 1000).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleOpenFull}
            className="w-full py-2.5 rounded-lg border border-red-500/25 bg-red-500/8 text-red-400 hover:bg-red-500/15 transition-colors text-[11px] font-black uppercase tracking-[0.14em]">
            {t.openFull}
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
    </div>
  );
}
