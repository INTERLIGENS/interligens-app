"use client";
import React, { useEffect, useState, useCallback } from "react";

interface ClusterProof { type: string; tx_signature: string; timestamp: number; detail: string; }
interface Cluster { id: string; label: string; strength: string; heuristic: string; wallets: string[]; proofs: ClusterProof[]; status: string; }
interface RelatedProject { mint: string; symbol?: string; name?: string; link_score: number; shared_wallets: number; signals: string[]; status: string; }
interface GraphReport { version: string; overall_status: string; cache_hit: boolean; clusters: Cluster[]; related_projects: RelatedProject[]; limits: { seeds_used: number; tx_fetched: number; wallets_expanded_hop1: number; wallets_expanded_hop2: number; max_seeds: number; }; query: { hops: number; days: number; }; provider: { name: string; }; }

// Stablecoins/utilitaires — exclus de "Related tokens"
const UTILITY_SYMBOLS = new Set([
  "USDC","USDT","SOL","WSOL","MSOL","JITOSOL","STSOL","BSOL","HSOL",
  "JPSOL","BNSOL","JSOL","LSOL","WBTC","ETH","WETH","DAI","BUSD",
  "TUSD","USDD","FRAX","USDH","USDR","UXD","CASH",
]);

const HEURISTIC: Record<string, { en: string; fr: string }> = {
  shared_funder: { en: "Same Funder",        fr: "Même financeur" },
  co_trading:    { en: "Coordinated Trading", fr: "Trading coordonné" },
  lp_overlap:    { en: "Same Liquidity (LP)", fr: "Même liquidité (LP)" },
};
const SIGNAL: Record<string, { en: string; fr: string }> = {
  cluster_overlap: { en: "cluster",    fr: "cluster" },
  co_trading:      { en: "coord.",     fr: "coord." },
  lp_overlap:      { en: "LP",         fr: "LP" },
  shared_wallets:  { en: "shared",     fr: "commun" },
};

interface Props { mint: string; hops?: 1|2; days?: 30|90; locale?: "en"|"fr"; showDebug?: boolean; }

const T = {
  en: {
    title: "Scam Family / Related Projects",
    subtitle: "Wallet cluster analysis · Helius on-chain heuristics",
    loading: "Analyzing wallet clusters…",
    error: "Graph analysis unavailable",
    walletGroups: "Wallet Groups",
    related: "Related tokens",
    noData: "No clusters detected in this time window",
    proofs: "Proofs",
    sharedWallets: "shared wallets",
    wallets: "wallets",
    heuristic: (h: string) => HEURISTIC[h]?.en ?? h,
    signal: (s: string) => SIGNAL[s]?.en ?? s,
  },
  fr: {
    title: "Famille de Scam / Projets Liés",
    subtitle: "Analyse de groupes · heuristiques on-chain Helius",
    loading: "Analyse des groupes de wallets…",
    error: "Analyse graphe indisponible",
    walletGroups: "Groupes de wallets",
    related: "Tokens liés",
    noData: "Aucun groupe détecté dans cette fenêtre",
    proofs: "Preuves",
    sharedWallets: "wallets communs",
    wallets: "wallets",
    heuristic: (h: string) => HEURISTIC[h]?.fr ?? h,
    signal: (s: string) => SIGNAL[s]?.fr ?? s,
  },
};

function StatusBadge({ status, locale = "en" }: { status: string; locale?: string }) {
  const c: Record<string,string> = { CORROBORATED:"bg-orange-500/20 text-orange-400 border-orange-500/30", REFERENCED:"bg-zinc-700/40 text-zinc-400 border-zinc-600/30", PARTIAL:"bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  const labels: Record<string, Record<string,string>> = {
    fr: { CORROBORATED:"CORROBORÉ", REFERENCED:"RÉFÉRENCÉ", PARTIAL:"PARTIEL" },
    en: { CORROBORATED:"CORROBORATED", REFERENCED:"REFERENCED", PARTIAL:"PARTIAL" },
  };
  const label = (labels[locale]??labels.en)[status] ?? status;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase tracking-widest ${c[status]??c.REFERENCED}`}>{label}</span>;
}
function StrengthDot({ s }: { s: string }) {
  const c: Record<string,string> = { HIGH:"bg-red-500", MED:"bg-orange-400", LOW:"bg-zinc-500" };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[s]??c.LOW} mr-1.5`} />;
}

export default function ScamFamilyBlock({ mint, hops=1, days=30, locale="en", showDebug=false }: Props) {
  const t = T[locale];
  const [report, setReport] = useState<GraphReport|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [tab, setTab] = useState<"clusters"|"related">("clusters");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/scan/solana/graph?mint=${encodeURIComponent(mint)}&hops=${hops}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch(e) { setError(e instanceof Error ? e.message : "error"); }
    finally { setLoading(false); }
  }, [mint, hops, days]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-5">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm">{t.loading}</span>
      </div>
    </div>
  );
  if (error || !report) return (
    <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/40 p-4">
      <span className="text-zinc-600 text-sm">⚠ {t.error}</span>
    </div>
  );

  const filteredRelated = report.related_projects.filter(p => !p.symbol || !UTILITY_SYMBOLS.has(p.symbol.toUpperCase()));
  const hasClusters = report.clusters.length > 0;
  const hasRelated = filteredRelated.length > 0;

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 overflow-hidden">
      {/* Header — cliquable pour collapse */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-4 border-b border-zinc-700/40 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left"
      >
        <span className="text-lg">🕸</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-zinc-100 font-semibold text-sm">{t.title}</h3>
          <p className="text-zinc-500 text-xs">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={report.overall_status} locale={locale} />
          {report.cache_hit && <span className="text-[10px] font-mono text-zinc-600">cached</span>}
          <span className="text-zinc-600 text-xs ml-1">{collapsed ? "▼" : "▲"}</span>
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Stats bar */}
          <div className="px-5 py-2 border-b border-zinc-800/60 flex gap-4 text-xs text-zinc-500 font-mono">
            <span>{report.limits.seeds_used}/{report.limits.max_seeds} seeds</span>
            <span>{report.limits.tx_fetched.toLocaleString()} txs</span>
            <span>{report.clusters.length} {t.walletGroups.toLowerCase()}</span>
            <span>{filteredRelated.length} {t.related.toLowerCase()}</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800/60">
            {(["clusters","related"] as const).map(tabId => (
              <button key={tabId}
                data-tab={tabId}
                onClick={() => setTab(tabId)}
                className={`px-5 py-2.5 text-xs font-medium transition-colors ${tab===tabId?"text-orange-400 border-b-2 border-orange-400":"text-zinc-500 hover:text-zinc-300"}`}>
                {tabId==="clusters"
                  ? `${t.walletGroups} (${report.clusters.length})`
                  : `${t.related} (${filteredRelated.length})`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {!hasClusters && !hasRelated && <p className="text-zinc-500 text-sm text-center py-4">{t.noData}</p>}

            {tab==="clusters" && hasClusters && report.clusters.map(c => (
              <div key={c.id} className="border border-zinc-700/50 rounded-lg p-3 bg-zinc-800/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <StrengthDot s={c.strength} />
                  <span className="text-zinc-100 text-sm font-medium flex-1">{c.label}</span>
                  <StatusBadge status={c.status} locale={locale} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400 mb-2">
                  <span className="font-mono bg-zinc-900/60 px-2 py-0.5 rounded">{t.heuristic(c.heuristic)}</span>
                  <span>{c.wallets.length} {t.wallets}</span>
                  {c.proofs.length>0 && <span className="text-orange-400/80">{c.proofs.length} {t.proofs.toLowerCase()}</span>}
                </div>
                {c.proofs.length>0 && (
                  <>
                    <button onClick={()=>setExpanded(expanded===c.id?null:c.id)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                      {expanded===c.id?"▲":"▼"} {c.proofs.length} tx
                    </button>
                    {expanded===c.id && (
                      <div className="mt-2 space-y-1">
                        {c.proofs.slice(0,5).map((p,i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px]">
                            <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-orange-400/80 hover:text-orange-400 underline underline-offset-2 truncate max-w-[140px]">
                              {p.tx_signature.slice(0,14)}…
                            </a>
                            <span className="text-zinc-500 shrink-0">{new Date(p.timestamp*1000).toLocaleDateString()}</span>
                            <span className="text-zinc-400 truncate">{p.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {tab==="related" && hasRelated && filteredRelated.map(p => (
              <div key={p.mint} className="border border-zinc-700/50 rounded-lg p-3 bg-zinc-800/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-lg font-bold font-mono ${p.link_score>=70?"text-red-400":p.link_score>=40?"text-orange-400":"text-zinc-400"}`}>{p.link_score}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-zinc-100 text-sm font-medium">{p.symbol??p.mint.slice(0,8)+"…"}</span>
                    {p.name && <span className="ml-2 text-zinc-500 text-xs">{p.name}</span>}
                  </div>
                  <StatusBadge status={p.status} locale={locale} />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {p.signals.map(s => (
                    <span key={s} className="text-[10px] font-mono bg-zinc-900/60 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/40">
                      {t.signal(s)}
                    </span>
                  ))}
                  <span className="text-[10px] text-zinc-500">{p.shared_wallets} {t.sharedWallets}</span>
                </div>
                <a href={`https://solscan.io/token/${p.mint}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[11px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 truncate block max-w-[220px]">
                  {p.mint}
                </a>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-2 bg-zinc-900/40 border-t border-zinc-800/40 text-[10px] text-zinc-600 font-mono">
            {report.provider.name} · h{report.query.hops} · {report.query.days}d · h1={report.limits.wallets_expanded_hop1} h2={report.limits.wallets_expanded_hop2}
          </div>

          {showDebug && (
            <details className="border-t border-zinc-800">
              <summary className="px-4 py-2 text-[10px] font-mono text-orange-400 cursor-pointer">raw JSON</summary>
              <pre className="p-4 text-[9px] text-zinc-500 overflow-auto max-h-60">{JSON.stringify(report,null,2)}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
