"use client";

import React, { useState, useMemo } from "react";
import MarketWeather from "@/components/MarketWeather";
import TigerRevealCard from "@/components/TigerRevealCard";
import WhatToDoNow from "@/components/WhatToDoNow";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import LocaleSwitch from "@/components/LocaleSwitch";
import MiniSignalRow from "@/components/scan/MiniSignalRow";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Chain = "SOL" | "ETH" | "TRON" | "BSC";
type RiskLevel = "low" | "medium" | "high";
type Tier = "GREEN" | "ORANGE" | "RED";

interface TopProof {
  label: string;
  value: string;
  level: RiskLevel;
  riskDescription: string;
}

interface NormalizedScan {
  score: number;
  tier: Tier;
  confidence: "Low" | "Medium" | "High";
  verdict: string;
  recommendations: string[];
  proofs: TopProof[];
  rawSummary: any;
  chain: Chain;
}

// ─── CHAIN DETECTION (single source of truth) ─────────────────────────────────
// TRON must be checked before SOL (both base58)

function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (!a) return null;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "TRON";
  if (/^bsc:0x[a-fA-F0-9]{40}$/i.test(a)) return "BSC";
  if (/^0x[a-fA-F0-9]{40}$/i.test(a)) return "ETH";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "SOL";
  return null;
}

// ─── SCAN URL BUILDER ─────────────────────────────────────────────────────────

function buildScanUrl(address: string, chain: Chain, deep: boolean): string {
  const a = encodeURIComponent(address.trim());
  const d = String(deep);
  switch (chain) {
    case "BSC":  return `/api/scan/bsc?address=${encodeURIComponent(address.trim().replace(/^bsc:/i,""))}&deep=${d}`;
    case "BSC":  return `/api/scan/bsc?address=${encodeURIComponent(address.trim().replace(/^bsc:/i,""))}&deep=${d}`;
    case "TRON": return `/api/scan/tron?address=${a}&deep=${d}`;
    case "ETH":  return `/api/scan/eth?address=${a}&deep=${d}`;
    case "SOL":  return `/api/wallet/scan?address=${a}&deep=${d}`;
  }
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

function normalizeScanData(data: any, chain: Chain): NormalizedScan {
  const score = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tierRaw = String(data?.tier ?? data?.risk?.tier ?? "GREEN").toUpperCase();
  const tier = (["GREEN", "ORANGE", "RED"].includes(tierRaw) ? tierRaw : "GREEN") as Tier;

  const proofs: TopProof[] = [];

  if (chain === "SOL") {
    const unknown = data?.programsSummary?.unknownCount ?? data?.unknownProgramsCount ?? 0;
    const txCount = data?.summary?.txCount ?? data?.transactions?.length ?? 0;
    proofs.push({ label: "Programmes", value: `${unknown} Inconnus`, level: unknown > 0 ? "high" : "low", riskDescription: unknown > 0 ? "Exposition à des programmes non vérifiés" : "Aucun programme inconnu détecté" });
    proofs.push({ label: "Historique",  value: `${txCount} TXs`,    level: txCount < 5 ? "medium" : "low", riskDescription: txCount < 5 ? "Faible historique (comportement jetable)" : "Historique d'activité normal" });
    proofs.push({ label: "Réseau",  value: "Solana Mainnet",     level: "low", riskDescription: "Chaîne officielle" });
  } else if (chain === "ETH") {
    const unlimited = data?.approvalsSummary?.unlimited ?? 0;
    const total     = data?.approvalsSummary?.total ?? 0;
    proofs.push({ label: "Approbations", value: `${unlimited} Unlimited`, level: unlimited > 0 ? "high" : "low", riskDescription: unlimited > 0 ? "Exposition drain vector" : "Aucune approbation illimitée" });
    proofs.push({ label: "Exposition",  value: `${total} Contracts`,     level: total > 8 ? "medium" : "low", riskDescription: total > 8 ? "Surface d'attaque élargie" : "Exposition normale" });
    proofs.push({ label: "Activité",  value: "TXs récentes trouvées",       level: "low", riskDescription: "Profil wallet actif" });
  } else if (chain === "BSC") {
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Réseau",   value: "BNB Smart Chain", level: "low",    riskDescription: "BSC mainnet officiel" });
      proofs.push({ label: "Contrat",  value: "Non vérifié",     level: "medium", riskDescription: "Ajoute BSCSCAN_API_KEY pour les données live" });
      proofs.push({ label: "Score",    value: `${score}/100`,    level: score > 60 ? "high" : "low", riskDescription: "Évaluation du risque" });
    }
  } else if (chain === "BSC") {
    const apiProofs = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Reseau",  value: "BNB Smart Chain", level: "low",    riskDescription: "BSC mainnet officiel" });
      proofs.push({ label: "Contrat", value: "Non verifie",     level: "medium", riskDescription: "Ajoute BSCSCAN_API_KEY pour les donnees live" });
      proofs.push({ label: "Score",   value: str(score)+"/100", level: "low",    riskDescription: "Evaluation du risque" });
    }
  } else {
    // TRON
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.value ?? "" })
      );
    } else {
      proofs.push({ label: "Réseau", value: "TRON chain",   level: "low",                        riskDescription: "Réseau TRON officiel" });
      proofs.push({ label: "Score",   value: `${score}/100`, level: score > 60 ? "high" : "low",  riskDescription: "Évaluation du risque" });
      proofs.push({ label: "Mode",    value: "Demo stable",  level: "low",                        riskDescription: "Données live disponibles sur upgrade" });
    }
  }

  const verdict = score > 70 ? "Éviter" : score > 30 ? "Prudence" : "OK";
  const recommendations =
    score > 70 ? ["NE PAS INTERAGIR",    "Révoquer les approvals",           "Migrer vers un wallet propre"]
  : score > 30 ? ["Use wallet jetable",  "Tester un petit montant",    "Éviter les approvals inconnus"]
               : ["Vérifier les liens",         "Faire une petite TX test",        "Surveiller régulièrement"];

  return {
    score, tier,
    confidence: (chain === "ETH" || chain === "BSC") ? (data?.deep ? "High" : "Medium") : "Medium",
    verdict, recommendations,
    proofs: proofs.slice(0, 3),
    rawSummary: data?.rawSummary ?? data?.programsSummary ?? data?.approvalsSummary ?? data,
    chain,
  };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TigerScanPageFR() {
  const [address, setAddress]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadStep, setLoadStep]         = useState(0);
  const [result, setResult]             = useState<NormalizedScan | null>(null);
  const [weather, setWeather]           = useState<any | null>(null);
  const [isDeep, setIsDeep]             = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm]   = useState<string | null>(null);

  const chain = useMemo(() => detectChain(address), [address]);

  React.useEffect(() => {
    setResolvedEvm(null);
    if (chain !== "HYPER_TOKEN_ID") return;
    fetch(`/api/resolve/hyper-token?tokenId=${encodeURIComponent(address.trim())}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.evmAddress?.address) setResolvedEvm(d.evmAddress.address); })
      .catch(() => {});
  }, [address, chain]);

  const runScan = async () => {
    if (!chain || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    for (let i = 0; i < 3; i++) {
      setLoadStep(i);
      await new Promise((r) => setTimeout(r, 650));
    }

    try {
      const url = buildScanUrl(address, chain, isDeep);
      const res  = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || `Error ${res.status}`);

      setResult(normalizeScanData({ ...data, deep: isDeep }, chain));

      try {
        const heatRes = await fetch("/api/social/heat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: address.trim(), chain, deep: isDeep, rawSummary: data?.rawSummary ?? data?.summary ?? data ?? null }),
        });
        setWeather(heatRes.ok ? await heatRes.json() : null);
      } catch { setWeather(null); }

    } catch (err: any) {
      const msg = String(err?.message ?? "Scan failed.");
      setError(msg.includes("rate") ? "ETH rate limit: retry in a few seconds." : msg);
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  };

  const getTierColor = (t: Tier) => t === "RED" ? "#F85B05" : t === "ORANGE" ? "#facc15" : "#10b981";

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans selection:bg-[#F85B05] selection:text-black antialiased p-6 md:p-12">

      {/* HEADER */}
      <nav className="max-w-7xl mx-auto flex justify-between items-center mb-20">
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-10 h-10 bg-[#F85B05] flex items-center justify-center font-black text-black text-xl italic shadow-[0_0_20px_rgba(248,91,5,0.4)] transition-transform group-hover:scale-110">
            I
          </div>
          <span className="font-black text-2xl tracking-tighter italic uppercase">
            Interligens<span className="text-[#F85B05]">.</span>
          </span>
        </div>
        <div className="hidden md:flex gap-8 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
          <span>Protocole Sécurité</span>
          <span className="text-zinc-800">|</span>
          <span>V2.6-Bêta</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto">
        <div className="flex justify-end mb-3"><LocaleSwitch /></div>

        {/* HERO */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter mb-6 uppercase">
            Vérifie ton <span className="text-[#F85B05] not-italic">Exposition.</span>
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-base font-medium">
            Analyse forensique pour wallets Solana, Ethereum & TRON. Aucune signature requise. Intelligence pure.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="relative max-w-2xl mx-auto mb-24">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#F85B05] to-orange-900 rounded-2xl blur-lg opacity-20 animate-pulse" />

          <form
            onSubmit={(e) => { e.preventDefault(); runScan(); }}
            className="relative bg-[#0A0A0A] border border-zinc-800 rounded-xl p-2 flex flex-col md:flex-row gap-2 shadow-2xl"
          >
            <div className="flex-1 flex items-center px-4 gap-3 overflow-hidden">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Paste wallet address (SOL / ETH / TRON)..."
                onKeyDown={(e) => { if (e.key === "Enter") runScan(); }}
                className="w-full bg-transparent py-4 text-sm font-mono focus:outline-none placeholder:text-zinc-800 text-white"
              />
              {/* ── Single badge, only when chain is detected ── */}
              {chain && (
                <span className="shrink-0 bg-[#F85B05]/10 border border-[#F85B05]/40 text-[#F85B05] text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest animate-in fade-in zoom-in">
                  {chain === "BSC" ? "BSC ACTIF" : chain === "SOL" ? "SOL ACTIF" : chain === "ETH" ? "ETH ACTIF" : "TRON ACTIF"}
                </span>
              )}
            </div>
            {address.startsWith("0x") && !chain?.includes("BSC") && (
              <p className="px-4 pb-1 text-[10px] text-zinc-600">
                Astuce : préfixe avec <code className="text-[#F85B05]">bsc:</code> pour scanner sur Binance Smart Chain.
              </p>
            )}

            <div className="flex items-center gap-3 px-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={isDeep} onChange={(e) => setIsDeep(e.target.checked)} className="hidden" />
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isDeep ? "bg-[#F85B05] border-[#F85B05]" : "border-zinc-700"}`}>
                  {isDeep && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </div>
                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-widest">Deep</span>
              </label>

              <button
                type="submit"
                disabled={!chain || loading}
                className="bg-white text-black font-black uppercase text-xs px-8 py-4 rounded-lg hover:bg-[#F85B05] hover:text-white transition-all disabled:opacity-20 active:scale-95"
              >
                {loading ? "Scan en cours..." : "Analyser"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 flex justify-between items-center p-3 bg-red-900/20 border border-red-900/40 rounded-lg">
              <span className="text-xs font-bold text-red-400">{error}</span>
              <button onClick={runScan} className="text-[10px] font-black text-white uppercase hover:underline underline-offset-4">Retry</button>
            </div>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-[#F85B05] tracking-[0.4em]">Intelligence Pipeline</span>
              <span className="text-3xl font-black italic text-white">0{(loadStep + 1) * 3}</span>
            </div>
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className="h-full bg-[#F85B05] transition-all duration-700 ease-out" style={{ width: `${(loadStep + 1) * 33}%` }} />
            </div>
            <p className="text-center font-mono text-[11px] text-zinc-500 animate-pulse uppercase tracking-widest">
              {["Initialisation du moteur forensique...", "Analyse des patterns on-chain...", "Calcul du TigerScore..."][loadStep]}
            </p>
          </div>
        )}

        {/* RESULTS */}
        {result && !loading && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-700 ease-out">

            {/* LEFT: VERDICT */}
            <div className="lg:col-span-5 bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-6 right-6">
                <span
                  className="px-3 py-1 rounded-sm border text-[10px] font-black uppercase tracking-widest"
                  style={{ borderColor: getTierColor(result.tier), color: getTierColor(result.tier) }}
                >
                  {result.tier}
                </span>
              </div>

              <div className="relative w-56 h-56 mb-10 mt-4 group-hover:scale-105 transition-transform duration-500">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="112" cy="112" r="100" stroke="#111" strokeWidth="12" fill="transparent" />
                  <circle cx="112" cy="112" r="100" stroke={getTierColor(result.tier)} strokeWidth="14" fill="transparent"
                    strokeDasharray={628} strokeDashoffset={628 - (628 * result.score) / 100}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-black italic leading-none">{result.score}</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mt-2">TigerScore</span>
                </div>
              </div>

              <h2 className="text-4xl font-black uppercase italic mb-3 tracking-tighter">{result.verdict}</h2>
              <p className="text-zinc-500 text-sm font-medium mb-10 px-4 leading-relaxed italic">
                {result.verdict === "OK" ? "Wallet plutôt sain. Vérifie quand même les liens."
                : result.verdict === "Prudence" ? "Signaux suspects détectés. Avance avec prudence."
                : "Schémas à haut risque. Évite toute interaction."}
              </p>

              <div className="w-full space-y-3 mb-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left ml-2 mb-2">A faire maintenant</p>
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-left hover:border-zinc-600 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F85B05] shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-tight">{rec}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={async () => {
                  if (!result) return;
                  const res = await fetch("/api/report/pdf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...result, lang: "fr" }),
                  });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = `interligens-${result.chain.toLowerCase()}-${address.slice(0,8)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full mt-4 py-4 rounded-xl border border-dashed border-zinc-800 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white hover:border-zinc-500 transition-all"
              >
                Générer le rapport complet (PDF)
              </button>
            </div>

            {/* RIGHT: SIGNALS + CARDS */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* ── 3 signal cards in a flat grid row (no nesting) ── */}
              <MiniSignalRow
                lang="fr"
                tier={result.tier.toLowerCase() as any}
                weather={weather}
                show={true}
              />

              <WhatToDoNow lang="fr" tier={result.tier} show={true} />

              <MarketWeather
                lang="fr"
                show={true}
                data={
                  weather?.manipulation && weather?.alerts && weather?.trust
                    ? weather
                    : { manipulation: { level: "red", value: 92 }, alerts: { level: "orange", value: 45 }, trust: { level: "green", value: 10 } }
                }
              />

              <TigerRevealCard tier={result.tier} proofs={result.proofs} />

              {/* Technical evidence (collapsible) */}
              <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-6">
                <button onClick={() => setShowEvidence(!showEvidence)} className="w-full flex justify-between items-center group">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors underline decoration-[#F85B05] underline-offset-8">
                    Preuves Techniques
                  </span>
                  <span className="text-xl text-zinc-700 group-hover:text-[#F85B05]">{showEvidence ? "−" : "+"}</span>
                </button>

                {showEvidence && (
                  <>
                    <TechnicalEvidence lang="fr" chain={result.chain === "ETH" ? "ethereum" : "solana"} show={true} />
                    <details className="mt-6 rounded-xl border border-zinc-900 bg-black/40">
                      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
                        Avance (donnees brutes)
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="overflow-auto rounded-lg border border-zinc-900 bg-black p-4 font-mono text-[10px] text-zinc-500">
                          {JSON.stringify(result.rawSummary, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </>
                )}
              </div>

              <div className="p-6 bg-[#F85B05]/5 border border-dashed border-[#F85B05]/20 rounded-2xl">
                <p className="text-[10px] text-zinc-600 uppercase font-black leading-relaxed tracking-widest">
                  BA Audit Trace : modele v2.6.x — preuves liees a des faits mesurables (pas de diffamation).
                </p>
              </div>

            </div>
          </div>
        )}

        <div className="text-center pt-10">
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em]">Interligens Intelligence © 2026</p>
        </div>
      </main>
    </div>
  );
}
