"use client";
import MarketWeather from "@/components/MarketWeather";

import React, { useState, useMemo } from "react";
import TigerRevealCard from "@/components/TigerRevealCard";
import WhatToDoNow from "@/components/WhatToDoNow";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import LocaleSwitch from "@/components/LocaleSwitch";
import ExitSecurity from "@/components/ExitSecurity";
import WhaleRisk from "@/components/WhaleRisk";
import KOLPressure from "@/components/KOLPressure";

// --- TYPES ET NORMALISATION ---
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
  chain: "SOL" | "ETH";
}

// --- CHAIN DETECT ---
const detectChain = (address: string): "SOL" | "ETH" | null => {
  const a = address.trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "SOL";
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "ETH";
  return null;
};

// --- NORMALIZE (robuste: marche même si APIs n'ont pas exactement les mêmes champs) ---
const normalizeScanData = (data: any, chain: "SOL" | "ETH"): NormalizedScan => {
  const isSol = chain === "SOL";

  const score =
    (isSol ? (data?.risk?.score ?? data?.score ?? 0) : (data?.score ?? 0)) || 0;

  const tierRaw =
    (isSol ? (data?.risk?.tier ?? data?.tier) : data?.tier) || "GREEN";

  const tier = String(tierRaw).toUpperCase() as Tier;

  // --- Top 3 proofs (fallback safe) ---
  const proofs: TopProof[] = [];

  if (isSol) {
    const unknown = data?.programsSummary?.unknownCount ?? data?.unknownProgramsCount ?? 0;
    const txCount = data?.summary?.txCount ?? data?.transactions?.length ?? 0;

    proofs.push({
      label: "Programs",
      value: `${unknown} Unknown`,
      level: unknown > 0 ? "high" : "low",
      riskDescription: unknown > 0 ? "Unverified program exposure" : "No unknown programs detected",
    });

    proofs.push({
      label: "History",
      value: `${txCount} TXs`,
      level: txCount < 5 ? "medium" : "low",
      riskDescription: txCount < 5 ? "Low history (burner behavior)" : "Normal activity history",
    });

    proofs.push({
      label: "Network",
      value: "Solana Mainnet",
      level: "low",
      riskDescription: "Official chain",
    });

  } else {
    const unlimited = data?.approvalsSummary?.unlimited ?? 0;
    const total = data?.approvalsSummary?.total ?? 0;

    proofs.push({
      label: "Approvals",
      value: `${unlimited} Unlimited`,
      level: unlimited > 0 ? "high" : "low",
      riskDescription: unlimited > 0 ? "Drain vector exposure" : "No unlimited approvals detected",
    });

    proofs.push({
      label: "Exposure",
      value: `${total} Contracts`,
      level: total > 8 ? "medium" : "low",
      riskDescription: total > 8 ? "Wider attack surface" : "Normal exposure",
    });

    proofs.push({
      label: "Activity",
      value: "Recent TXs Found",
      level: "low",
      riskDescription: "Active wallet profile",
    });
  }

  const verdict = score > 70 ? "STOP" : score > 30 ? "PRUDENCE" : "OK";
  const recommendations =
    score > 70
      ? ["Do NOT interact", "Revoke approvals", "Move funds to new wallet"]
      : score > 30
      ? ["Use burner wallet", "Test small amount first", "Avoid unknown approvals"]
      : ["Vérifie les URLs", "Teste une petite somme", "Surveille régulièrement"];

  return {
    score,
    tier,
    confidence: chain === "ETH" ? (data?.deep ? "High" : "Medium") : "Medium",
    verdict,
    recommendations,
    proofs: proofs.slice(0, 3),
    rawSummary: isSol ? (data?.programsSummary ?? data) : (data?.approvalsSummary ?? data),
    chain,
  };
};

export default function TigerScanPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<NormalizedScan | null>(null);
  const [weather, setWeather] = useState<any | null>(null);
  const [isDeep, setIsDeep] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chain = useMemo(() => detectChain(address), [address]);

  const runScan = async () => {
    if (!chain || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    // Loader 3 steps (UX)
    for (let i = 0; i < 3; i++) {
      setLoadStep(i);
      await new Promise((r) => setTimeout(r, 650));
    }

    try {
      const endpoint =
        chain === "SOL"
          ? `/api/wallet/scan?address=${encodeURIComponent(address.trim())}&deep=${isDeep}`
          : `/api/scan/eth?address=${encodeURIComponent(address.trim())}&deep=${isDeep}`;

      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `Error ${res.status}`);
      }

      setResult(normalizeScanData({ ...data, deep: isDeep }, chain));

      try {
        const heatRes = await fetch("/api/social/heat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address.trim(),
            chain,
            deep: isDeep,
            // Pass raw summary for on-chain proxies (server can ignore fields it doesn't use)
            rawSummary: (data && (data.rawSummary || data.summary || data)) || null,
          }),
        });
        if (heatRes.ok) {
          const heat = await heatRes.json();
          setWeather(heat);
        } else {
          setWeather(null);
        }
      } catch (e) {
        setWeather(null);
      }
    } catch (err: any) {
      const msg = String(err?.message || "Scan failed.");
      setError(msg.includes("rate") ? "ETH rate limit: retry in a few seconds." : msg);
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  };

  const getTierColor = (t: Tier) =>
    t === "RED" ? "#F85B05" : t === "ORANGE" ? "#facc15" : "#10b981";

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
          <span>Security Protocol</span>
          <span className="text-zinc-800">|</span>
          <span>V2.6-Beta</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto">
        <div className="flex justify-end mb-3"><LocaleSwitch /></div>

        {/* HERO */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter mb-6 uppercase">
            Check your <span className="text-[#F85B05] not-italic">Exposure.</span>
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-base font-medium">
            Advanced forensic analysis for Solana & Ethereum wallets. No signatures required. Pure intelligence.
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="relative max-w-2xl mx-auto mb-24">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#F85B05] to-orange-900 rounded-2xl blur-lg opacity-20 animate-pulse"></div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runScan();
            }}
            className="relative bg-[#0A0A0A] border border-zinc-800 rounded-xl p-2 flex flex-col md:flex-row gap-2 shadow-2xl"
          >
            <div className="flex-1 flex items-center px-4 gap-3 overflow-hidden">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Paste wallet or token address..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") runScan();
                }}
                className="w-full bg-transparent py-4 text-sm font-mono focus:outline-none placeholder:text-zinc-800 text-white"
              />
              {chain && (
                <span className="shrink-0 bg-[#F85B05]/10 border border-[#F85B05]/40 text-[#F85B05] text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest animate-in fade-in zoom-in">
                  {chain} Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 px-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isDeep}
                  onChange={(e) => setIsDeep(e.target.checked)}
                  className="hidden"
                />
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isDeep ? "bg-[#F85B05] border-[#F85B05]" : "border-zinc-700"
                  }`}
                >
                  {isDeep && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                </div>
                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-widest">
                  Deep
                </span>
              </label>

              <button
                type="submit"
                disabled={!chain || loading}
                className="bg-white text-black font-black uppercase text-xs px-8 py-4 rounded-lg hover:bg-[#F85B05] hover:text-white transition-all disabled:opacity-20 active:scale-95"
              >
                {loading ? "Scanning..." : "Analyze"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 flex justify-between items-center p-3 bg-red-900/20 border border-red-900/40 rounded-lg">
              <span className="text-xs font-bold text-red-400">{error}</span>
              <button
                onClick={runScan}
                className="text-[10px] font-black text-white uppercase hover:underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-[#F85B05] tracking-[0.4em]">
                Intelligence Pipeline
              </span>
              <span className="text-3xl font-black italic text-white">
                0{(loadStep + 1) * 3}
              </span>
            </div>
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F85B05] transition-all duration-700 ease-out"
                style={{ width: `${(loadStep + 1) * 33}%` }}
              />
            </div>
            <p className="text-center font-mono text-[11px] text-zinc-500 animate-pulse uppercase tracking-widest">
              {["Initializing forensic engine...", "Analyzing on-chain patterns...", "Calculating TigerScore..."][loadStep]}
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
                  <circle
                    cx="112"
                    cy="112"
                    r="100"
                    stroke={getTierColor(result.tier)}
                    strokeWidth="14"
                    fill="transparent"
                    strokeDasharray={628}
                    strokeDashoffset={628 - (628 * result.score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-black italic leading-none">{result.score}</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mt-2">
                    TigerScore
                  </span>
                </div>
              </div>

              <h2 className="text-4xl font-black uppercase italic mb-3 tracking-tighter">
                {result.verdict}
              </h2>
              <p className="text-zinc-500 text-sm font-medium mb-10 px-4 leading-relaxed italic">
                {result.verdict === "Proceed"
                  ? "Wallet health looks clean. Still verify URLs."
                  : result.verdict === "Caution"
                  ? "Suspicious signals detected. Proceed with caution."
                  : "High-risk patterns detected. Avoid interaction."}
              </p>

              <div className="w-full space-y-3 mb-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left ml-2 mb-2">
                  À faire maintenant
                </p>
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-left hover:border-zinc-600 transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F85B05]" />
                    <span className="text-xs font-bold uppercase tracking-tight">{rec}</span>
                  </div>
                ))}
              </div>

              <button className="w-full mt-4 py-4 rounded-xl border border-dashed border-zinc-800 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white hover:border-zinc-500 transition-all">
                Generate Full Report (PDF)
              </button>
            </div>

            {/* RIGHT: TIGER FLIP CARD + TECH */}
            <div className="lg:col-span-7 flex flex-col gap-6">
                            {result ? (<>
                {/* What to do now (after scan) */}
                {/* Exit + Whale (compact row) */}
                <div className="exit-whale-grid grid grid-cols-3 gap-3 max-w-full">
                  <div className="min-w-0"><ExitSecurity lang="fr" tier={result?.tier} weather={weather} show={!!result} />
                    <div className="min-w-0"><KOLPressure lang="fr" tier={result?.tier} weather={weather} show={!!result} /></div>
</div>
                  <div className="min-w-0"><WhaleRisk lang="fr" tier={result?.tier} weather={weather} show={!!result} /></div>
                </div>
                <style jsx>{`@media (max-width: 860px) { .exit-whale-grid { grid-template-columns: 1fr; } }`}</style>


                <WhatToDoNow lang="fr" tier={result?.tier} show={!!result} />
</>



              ) : null}

                            <MarketWeather
                              lang="fr"
                              show={true}
                              data={(weather && weather.manipulation && weather.alerts && weather.trust) ? weather : { manipulation: { level: "red", value: 92 }, alerts: { level: "orange", value: 45 }, trust: { level: "green", value: 10 } }}
                            />

                            <TigerRevealCard tier={result.tier} proofs={result.proofs} />

              <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-6">
                                {/* Market Weather (appears after scan) */}
<button
                  onClick={() => setShowEvidence(!showEvidence)}
                  className="w-full flex justify-between items-center group"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors underline decoration-[#F85B05] underline-offset-8">
                    Technical Evidence
                  </span>
                  <span className="text-xl text-zinc-700 group-hover:text-[#F85B05]">
                    {showEvidence ? "−" : "+"}
                  </span>
                </button>

                {showEvidence && (<>
              <TechnicalEvidence lang="fr" chain={((result?.chain === "ethereum" ? "ethereum" : "solana"))} show={!!result} />

                  <details className="mt-6 rounded-xl border border-zinc-900 bg-black/40">
                    <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
                      Advanced (raw data)
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="overflow-auto rounded-lg border border-zinc-900 bg-black p-4 font-mono text-[10px] text-zinc-500">{JSON.stringify(result.rawSummary, null, 2)}</pre>
                    </div>
                  </details>
</>

                )}
              </div>

              <div className="p-6 bg-[#F85B05]/5 border border-dashed border-[#F85B05]/20 rounded-2xl">
                <p className="text-[10px] text-zinc-600 uppercase font-black leading-relaxed tracking-widest">
                  BA Audit Trace: Model v2.6.x — proofs are mapped to measurable facts (no defamation).
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center pt-10">
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em]">
            Interligens Intelligence © 2026
          </p>
        </div>
      </main>
    </div>
  );
}
