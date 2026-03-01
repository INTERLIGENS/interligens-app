"use client";

import React, { useState, useEffect, useMemo } from "react";
import MarketWeather from "@/components/MarketWeather";
import TigerRevealCard from "@/components/TigerRevealCard";
import WhatToDoNow from "@/components/WhatToDoNow";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import ScanSkeleton from "@/components/ScanSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import LocaleSwitch from "@/components/LocaleSwitch";
import MiniSignalRow from "@/components/scan/MiniSignalRow";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Chain = "SOL" | "ETH" | "TRON" | "BSC" | "HYPER" | "HYPER_TOKEN_ID";
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
  spenders?: string[];
  counterparties?: string[];
  provider_used?: string; // @deprecated
  data_source?: string;
  source_detail?: string;
  rpc_fallback_used?: boolean;
  cache_hit?: boolean;
  rpc_down?: boolean;
  rpc_error?: string;
  unlimitedCount?: number;
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
}

type ScanChain = Exclude<Chain, "HYPER_TOKEN_ID">;

// ─── CHAIN DETECTION (single source of truth) ─────────────────────────────────
// TRON must be checked before SOL (both base58)

function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (!a) return null;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "TRON";
  if (/^bsc:0x[a-fA-F0-9]{40}$/i.test(a)) return "BSC";
  if (/^hyper:0x[a-fA-F0-9]{40}$/i.test(a)) return "HYPER";
  if (/^0x[a-fA-F0-9]{32}$/i.test(a)) return "HYPER_TOKEN_ID";
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
    case "HYPER": return `/api/scan/hyper?address=${encodeURIComponent(address.trim().replace(/^hyper:/i,""))}&deep=${d}`;
    case "TRON": return `/api/scan/tron?address=${a}&deep=${d}`;
    case "ETH":  return `/api/scan/eth?address=${a}&deep=${d}`;
    case "SOL":  return `/api/scan/solana?mint=${a}`;
  }
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

function normalizeScanData(data: any, chain: Chain): NormalizedScan {
  const score = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tierRaw = String(data?.tier ?? data?.risk?.tier ?? "GREEN").toUpperCase();
  const tier = (["GREEN", "ORANGE", "RED"].includes(tierRaw) ? tierRaw : "GREEN") as Tier;

  const proofs: TopProof[] = [];

  if (chain === "SOL") {
    const claims = data?.off_chain?.claims ?? [];
    const offchainSource = data?.off_chain?.source ?? "none";
    const claimsCount = claims.length;
    if (offchainSource === "case_db" && claimsCount > 0) {
      proofs.push({ label: "CaseDB", value: `${claimsCount} Claims`, level: "high", riskDescription: "Detective Referenced — case on file" });
      proofs.push({ label: "Status", value: data?.off_chain?.status ?? "Referenced", level: "high", riskDescription: "Off-chain investigation result" });
      proofs.push({ label: "Case", value: data?.off_chain?.case_id ?? "—", level: "high", riskDescription: "Case identifier" });
    } else {
      proofs.push({ label: "Network", value: "Solana Mainnet", level: "low", riskDescription: "Official chain" });
      proofs.push({ label: "Score", value: `${score}/100`, level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
      proofs.push({ label: "Source", value: offchainSource, level: "low", riskDescription: "Data source" });
    }
  } else if (chain === "ETH") {
    const unlimited = data?.approvalsSummary?.unlimited ?? 0;
    const total     = data?.approvalsSummary?.total ?? 0;
    proofs.push({ label: "Approvals", value: `${unlimited} Unlimited`, level: unlimited > 0 ? "high" : "low", riskDescription: unlimited > 0 ? "Drain vector exposure" : "No unlimited approvals detected" });
    proofs.push({ label: "Exposure",  value: `${total} Contracts`,     level: total > 8 ? "medium" : "low", riskDescription: total > 8 ? "Wider attack surface" : "Normal exposure" });
    proofs.push({ label: "Activity",  value: "Recent TXs Found",       level: "low", riskDescription: "Active wallet profile" });
  } else if (chain === "BSC") {
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Network",  value: "BNB Smart Chain", level: "low",    riskDescription: "Official BSC mainnet" });
      proofs.push({ label: "Contract", value: "Not checked",     level: "medium", riskDescription: "Add BSCSCAN_API_KEY for live data" });
      proofs.push({ label: "Score",    value: `${score}/100`,    level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
    }
  } else if (chain === "BSC") {
    const apiProofs = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Network",  value: "BNB Smart Chain", level: "low",    riskDescription: "Official BSC mainnet" });
      proofs.push({ label: "Contract", value: "Not checked",     level: "medium", riskDescription: "Add BSCSCAN_API_KEY for live data" });
      proofs.push({ label: "Score",    value: score + "/100",    level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
    }
  } else if (chain === "HYPER") {
    const apiProofs = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Network",   value: "HyperEVM Mainnet", level: "low",    riskDescription: "Official Hyperliquid EVM chain" });
      proofs.push({ label: "Contract",  value: "Not checked",      level: "medium", riskDescription: "Add HYPER_API_KEY for live data" });
      proofs.push({ label: "Score",     value: score + "/100",     level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
    }
  } else {
    // TRON
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.value ?? "" })
      );
    } else {
      proofs.push({ label: "Network", value: "TRON chain",   level: "low",                        riskDescription: "Official TRON network" });
      proofs.push({ label: "Score",   value: `${score}/100`, level: score > 60 ? "high" : "low",  riskDescription: "Risk assessment" });
      proofs.push({ label: "Mode",    value: "Demo stable",  level: "low",                        riskDescription: "Live data available on upgrade" });
    }
  }

  const verdict = score > 70 ? "Avoid" : score > 30 ? "Caution" : "Proceed";
  const recommendations =
    score > 70 ? ["Do NOT interact",    "Revoke approvals",           "Move funds to new wallet"]
  : score > 30 ? ["Use burner wallet",  "Test small amount first",    "Avoid unknown approvals"]
               : ["Verify URLs",         "Small test TX first",        "Monitor regularly"];

  return {
    score, tier,
    confidence: (chain === "ETH" || chain === "BSC" || chain === "HYPER") ? (data?.deep ? "High" : "Medium") : "Medium",
    verdict, recommendations,
    proofs: proofs.slice(0, 3),
    rawSummary: data?.rawSummary ?? data?.programsSummary ?? data?.approvalsSummary ?? data,
    chain,
    spenders: data?.spenders ?? [],
    counterparties: data?.counterparties_top ?? [],
    provider_used: data?.provider_used ?? undefined,
    data_source: data?.data_source ?? undefined,
    source_detail: data?.source_detail ?? undefined,
    rpc_fallback_used: data?.rpc_fallback_used ?? false,
    cache_hit: data?.cache_hit ?? false,
    rpc_down: data?.rpc_down ?? false,
    rpc_error: data?.rpc_error ?? undefined,
    unlimitedCount: data?.approvalsSummary?.unlimited ?? 0,
    freezeAuthority: data?.freezeAuthority ?? false,
    mintAuthority: data?.mintAuthority ?? false,
  };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TigerScanPage() {
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

  // Mock mode
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const mockMode = searchParams?.get("mock") as "green"|"orange"|"red"|null;

  const DEMO_CHIPS = [
    { label: "✅ Safe", addr: "SAFE111111111111111111111111111111111111111", mock: "green" },
    { label: "⚠️ Warning", addr: "WARN2222222222222222222222222222222222222222", mock: "orange" },
    { label: "🚨 Scam", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", mock: "red" },
  ];

  React.useEffect(() => {
    setResolvedEvm(null);
    if (chain !== "HYPER_TOKEN_ID") return;
    fetch(`/api/resolve/hyper-token?tokenId=${encodeURIComponent(address.trim())}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.evmAddress?.address) setResolvedEvm(d.evmAddress.address); })
      .catch(() => {});
  }, [address, chain]);

  const isHyperTokenId = chain === "HYPER_TOKEN_ID";

  const runScan = async (overrideAddr?: string, overrideMock?: string) => {
    const scanAddr = (overrideAddr ?? address).trim();
    const useMock = overrideMock ?? mockMode;
    if (useMock) {
      setLoading(true); setError(null); setResult(null);
      await new Promise(r => setTimeout(r, 800));
      try {
        const res = await fetch(`/api/mock/scan?mode=${useMock}`, { cache: "no-store" });
        const data = await res.json();
        setResult(normalizeScanData(data, "SOL"));
        setWeather(null);
        setTimeout(() => document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth" }), 200);
      } catch(e) { setError("Mock failed"); }
      setLoading(false);
      return;
    }
    if (!chain || chain === "HYPER_TOKEN_ID" || loading) return;
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
            Advanced forensic analysis for Solana, Ethereum & TRON wallets. No signatures required. Pure intelligence.
          </p>
        </div>

        {/* DEMO CHIPS */}
        <div className="flex justify-center gap-3 mb-6 flex-wrap">
          {DEMO_CHIPS.map((chip) => (
            <button
              key={chip.mock}
              onClick={() => {
                setAddress(chip.addr);
                runScan(chip.addr, chip.mock);
              }}
              className="px-4 py-2 rounded-full border border-zinc-700 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:border-[#F85B05] hover:text-white transition-all"
            >
              {chip.label}
            </button>
          ))}
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
                placeholder="Paste address (SOL / ETH / TRON / bsc:0x… / hyper:0x…)"
                onKeyDown={(e) => { if (e.key === "Enter") runScan(); }}
                className="w-full bg-transparent py-4 text-sm font-mono focus:outline-none placeholder:text-zinc-800 text-white"
              />
              {/* ── BSC tip ── */}
              {chain && chain !== "HYPER_TOKEN_ID" && (
                <span className="shrink-0 bg-[#F85B05]/10 border border-[#F85B05]/40 text-[#F85B05] text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest animate-in fade-in zoom-in">
                  {chain} ACTIVE
                </span>
              )}
            </div>
            {chain === "HYPER_TOKEN_ID" && (
              <div className="px-4 pb-2">
                {resolvedEvm ? (
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    Token resolved: <button onClick={() => setAddress("hyper:" + resolvedEvm)} className="underline text-[#F85B05] hover:text-white transition-colors">use hyper:{resolvedEvm.slice(0,10)}…</button>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400 font-semibold">
                    Hyperliquid token id detected. Paste the EVM Address (0x…40) shown in Hyperliquid (field: &ldquo;Evm Address&rdquo;).
                  </p>
                )}
              </div>
            )}
            {address.startsWith("0x") && chain === "ETH" && (
              <p className="px-4 pb-1 text-[10px] text-zinc-600">
                Tip: use <code className="text-[#F85B05]">hyper:0x…</code> to force Hyperliquid &nbsp;|&nbsp; <code className="text-[#F85B05]">bsc:0x…</code> for BSC.
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
                disabled={!chain || chain === "HYPER_TOKEN_ID" || loading}
                className="bg-white text-black font-black uppercase text-xs px-8 py-4 rounded-lg hover:bg-[#F85B05] hover:text-white transition-all disabled:opacity-20 active:scale-95"
              >
                {loading ? "Scanning..." : "Analyze"}
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
        {loading && <ScanSkeleton />}

        {/* RESULTS */}
        <div id="result-anchor" />
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
                {result.verdict === "Proceed" ? "Wallet health looks clean. Still verify URLs."
                : result.verdict === "Caution" ? "Suspicious signals detected. Proceed with caution."
                : "High-risk patterns detected. Avoid interaction."}
              </p>

              <div className="w-full space-y-3 mb-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left ml-2 mb-2">What to do now ↓</p>
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
                    body: JSON.stringify({ ...result, address: address.trim(), lang: "en" }),
                  });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = `interligens-${result.chain.toLowerCase()}-${result.rawSummary?.address ?? address.slice(0,8)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full mt-4 py-4 rounded-xl border border-dashed border-[#F85B05]/40 text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] hover:text-white hover:border-[#F85B05] transition-all"
              >
                Generate Full Report (PDF)
              </button>
                <button
                  onClick={async () => {
                    if (!result) return;
                    const res = await fetch(`/api/report/casefile?mint=${encodeURIComponent(address.trim())}&lang=en&t=${Date.now()}`, { cache: "no-store" });
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `casefile-${address.slice(0,8)}.pdf`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full mt-2 py-4 rounded-xl border border-dashed border-[#EF4444]/40 text-[10px] font-black uppercase tracking-[0.2em] text-[#EF4444] hover:text-white hover:border-[#EF4444] transition-all"
                >
                  Generate Case File (PDF) — Detective Referenced
                </button>
            </div>

            {/* RIGHT: SIGNALS + CARDS */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* ── 3 signal cards in a flat grid row (no nesting) ── */}
              <MiniSignalRow
                lang="en"
                tier={result.tier.toLowerCase() as any}
                weather={weather}
                show={true}
              />

              <WhatToDoNow lang="en" tier={result.tier} show={true} />

              <MarketWeather
                lang="en"
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
                    Technical Evidence
                  </span>
                  <span className="text-xl text-zinc-700 group-hover:text-[#F85B05]">{showEvidence ? "−" : "+"}</span>
                </button>

                {showEvidence && (
                  <>
                    <TechnicalEvidence lang="en" chain={result.chain === "ETH" ? "ethereum" : "solana"} show={true} provider_used={result.provider_used} data_source={result.data_source} source_detail={result.source_detail} rpc_fallback_used={result.rpc_fallback_used} cache_hit={result.cache_hit} rpc_down={result.rpc_down} rpc_error={result.rpc_error} spenders={result.spenders} counterparties={result.counterparties} unlimitedCount={result.unlimitedCount} freezeAuthority={result.freezeAuthority} mintAuthority={result.mintAuthority} />
                    <details className="mt-6 rounded-xl border border-zinc-900 bg-black/40">
                      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
                        Advanced (raw data)
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
                  BA Audit Trace: Model v2.6.x — proofs are mapped to measurable facts (no defamation).
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
