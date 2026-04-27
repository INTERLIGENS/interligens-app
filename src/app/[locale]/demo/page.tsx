"use client";
import { getActionCopy } from "@/lib/copy/actions";
import { buildDemoUrl } from "@/lib/demo/url";
import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import MarketWeather from "@/components/MarketWeather";
import TigerRevealCard from "@/components/TigerRevealCard";
import WhatToDoNow from "@/components/WhatToDoNow";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import MiniSignalRow from "@/components/scan/MiniSignalRow";
import { OsintSectionClient } from "@/components/osint/OsintSectionClient";
import CaseIntelBadge from "@/components/intelligence/CaseIntelBadge";
import RetailVerdictBanner from "@/components/scan/RetailVerdictBanner";
import { ExplanationLayer } from "@/components/explanation/ExplanationLayer";
import BetaNav from "@/components/beta/BetaNav";
import WatchButton from "@/components/watch/WatchButton";
import { normalizeToAnalysisSummary } from "@/lib/explanation/normalizer";
import type { Locale } from "@/lib/explanation/types";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Chain = "SOL" | "ETH" | "TRON" | "BSC" | "HYPER" | "HYPER_TOKEN_ID" | "BASE" | "ARBITRUM";
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

type ScanChain = Exclude<Chain, "HYPER_TOKEN_ID">;

// ─── CHAIN DETECTION (single source of truth) ─────────────────────────────────
// TRON must be checked before SOL (both base58)

function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (!a) return null;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "TRON";
  if (/^bsc:0x[a-fA-F0-9]{40}$/i.test(a)) return "BSC";
  if (/^base:0x[a-fA-F0-9]{40}$/i.test(a)) return "BASE";
  if (/^arb:0x[a-fA-F0-9]{40}$/i.test(a)) return "ARBITRUM";
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
    case "BASE": return `/api/scan/base?address=${encodeURIComponent(address.trim().replace(/^base:/i,""))}&deep=${d}`;
    case "ARBITRUM": return `/api/scan/arbitrum?address=${encodeURIComponent(address.trim().replace(/^arb:/i,""))}&deep=${d}`;
    case "HYPER": return `/api/scan/hyper?address=${encodeURIComponent(address.trim().replace(/^hyper:/i,""))}&deep=${d}`;
    case "TRON": return `/api/scan/tron?address=${a}&deep=${d}`;
    case "ETH":  return `/api/scan/eth?address=${a}&deep=${d}`;
    case "SOL":
      // Token mint (pump.fun ou autres) → endpoint token avec booster market
      if (address.trim().toLowerCase().endsWith("pump"))
        return `/api/scan/solana?mint=${a}&deep=${d}`;
      return `/api/wallet/scan?address=${a}&deep=${d}`;
    default: return `/api/scan/sol?address=${a}&deep=${d}`;
  }
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

function normalizeScanData(data: any, chain: Chain): NormalizedScan {
  // Préférer tiger_score (boosteur market) si présent et plus élevé
  const baseScore = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tigerScore = Number(data?.tiger_score ?? 0) || 0;
  const score = Math.max(baseScore, tigerScore);
  const tierRaw = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : (String(data?.tier ?? data?.risk?.tier ?? "GREEN").toUpperCase());
  const tier = (["GREEN", "ORANGE", "RED"].includes(tierRaw) ? tierRaw : "GREEN") as Tier;

  const proofs: TopProof[] = [];

  if (chain === "SOL") {
    const unknown = data?.programsSummary?.unknownCount ?? data?.unknownProgramsCount ?? 0;
    const txCount = data?.summary?.txCount ?? data?.transactions?.length ?? 0;
    proofs.push({ label: "Programs", value: `${unknown} Unknown`, level: unknown > 0 ? "high" : "low", riskDescription: unknown > 0 ? "Unverified program exposure" : "No unknown programs detected" });
    proofs.push({ label: "History",  value: `${txCount} TXs`,    level: txCount < 5 ? "medium" : "low", riskDescription: txCount < 5 ? "Low history (burner behavior)" : "Normal activity history" });
    proofs.push({ label: "Network",  value: "Solana Mainnet",     level: "low", riskDescription: "Official chain" });
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
  } else if (chain === "BASE") {
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    const baseSignals: any[] = Array.isArray(data?.signals) ? data.signals : [];
    if (baseSignals.length > 0) {
      baseSignals.slice(0, 3).forEach((s: any) =>
        proofs.push({ label: String(s.kind ?? "Signal").replace(/_/g, " "), value: s.label ?? "—", level: s.severity === "CRITICAL" ? "high" : s.severity === "HIGH" ? "medium" : "low", riskDescription: s.label ?? "" })
      );
    } else if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Network",  value: "Base (Coinbase L2)", level: "low",    riskDescription: "Official Base mainnet" });
      proofs.push({ label: "Score",    value: `${score}/100`,       level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
      proofs.push({ label: "Source",   value: "Etherscan v2",       level: "low",    riskDescription: "Basescan via Etherscan v2 API" });
    }
  } else if (chain === "ARBITRUM") {
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    const arbSignals: any[] = Array.isArray(data?.signals) ? data.signals : [];
    if (arbSignals.length > 0) {
      arbSignals.slice(0, 3).forEach((s: any) =>
        proofs.push({ label: String(s.kind ?? "Signal").replace(/_/g, " "), value: s.label ?? "—", level: s.severity === "CRITICAL" ? "high" : s.severity === "HIGH" ? "medium" : "low", riskDescription: s.label ?? "" })
      );
    } else if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      proofs.push({ label: "Network",  value: "Arbitrum One",  level: "low",    riskDescription: "Official Arbitrum L2 mainnet" });
      proofs.push({ label: "Score",    value: `${score}/100`,  level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
      proofs.push({ label: "Source",   value: "Etherscan v2",  level: "low",    riskDescription: "Arbiscan via Etherscan v2 API" });
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
  const _ac = getActionCopy({ scan_type: "token", tier: score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN", chain: (chain as any) ?? "SOL" });
  const recommendations = _ac.en;

  return {
    score, tier,
    confidence: (chain === "ETH" || chain === "BSC" || chain === "HYPER" || chain === "BASE" || chain === "ARBITRUM") ? (data?.deep ? "High" : "Medium") : "Medium",
    verdict, recommendations,
    proofs: proofs.slice(0, 3),
    rawSummary: data?.rawSummary ?? data?.programsSummary ?? data?.approvalsSummary ?? data,
    chain,
  };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const DEMO_PRESETS = [
  { id: "botify",  label: "BOTIFY",  tag: "SCAM",  address: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb" },
  { id: "pump",    label: "PUMP.FUN", tag: "SOL",  address: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump" },
  { id: "bonk",    label: "BONK",    tag: "SOL",   address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { id: "vitalik", label: "VITALIK", tag: "ETH",   address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { id: "tron",    label: "TRON",    tag: "TRX",   address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6" },
] as const;

function TigerScanPageInner() {
  const searchParams  = useSearchParams();
  const pathname      = usePathname();
  const locale        = pathname?.startsWith('/fr') ? 'fr' : 'en';
  const debug         = searchParams.get("debug") === "1";
  const hasAutoRun    = useRef(false);

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [copyDone, setCopyDone]         = useState(false);
  const [address, setAddress]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadStep, setLoadStep]         = useState(0);
  const [result, setResult]             = useState<NormalizedScan | null>(null);
  const [corrobData, setCorrobData] = useState<any>(null);
  const [addressLabel, setAddressLabel] = useState<any>(null);
  const [weather, setWeather]           = useState<any | null>(null);
  const [isDeep, setIsDeep]             = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm]   = useState<string | null>(null);


  // Safety net: débloque le bouton si loading reste bloqué > 8s
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError("Scan timeout — retry."); }, 8000);
    return () => clearTimeout(t);
  }, [loading]);

  const chain = useMemo(() => detectChain(address), [address]);
  const analysisSummary = useMemo(() => result ? normalizeToAnalysisSummary({ ...result, address: address.trim() }) : null, [result, address]);
  const explanationLocale = (locale === "fr" ? "fr" : "en") as Locale;

  // ── Autoload depuis URL params ──
  useEffect(() => {
    const addr  = searchParams.get("addr");
    const auto  = searchParams.get("auto") === "1";
    const deep  = searchParams.get("deep") === "1";
    const mock  = searchParams.get("mock");
    if (addr) {
      setAddress(addr);
      if (deep) setIsDeep(true);
    }
    if (auto && addr && !hasAutoRun.current) {
      hasAutoRun.current = true;
      // Enlever auto=1 de l'URL sans refresh
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("auto");
      const newUrl = pathname + (newParams.toString() ? "?" + newParams.toString() : "");
      window.history.replaceState(null, "", newUrl);
      // Lancer le scan après un tick
      setTimeout(() => {
        const detectedChain = detectChain(addr);
        if (detectedChain && detectedChain !== "HYPER_TOKEN_ID" && !mock) {
          document.querySelector<HTMLButtonElement>("[data-scan-btn]")?.click();
        }
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setResolvedEvm(null);
    if (chain !== "HYPER_TOKEN_ID") return;
    fetch(`/api/resolve/hyper-token?tokenId=${encodeURIComponent(address.trim())}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.evmAddress?.address) setResolvedEvm(d.evmAddress.address); })
      .catch(() => {});
  }, [address, chain]);

  const isHyperTokenId = chain === "HYPER_TOKEN_ID";

  const runScan = async () => {
    if (!chain || chain === "HYPER_TOKEN_ID" || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      for (let i = 0; i < 3; i++) {
        setLoadStep(i);
        await new Promise((r) => setTimeout(r, 650));
      }
      const url = buildScanUrl(address, chain, isDeep);
      const res  = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || `Error ${res.status}`);

      let enrichedData = { ...data, deep: isDeep };
      // Pour SOL: enrichir avec tiger_score depuis /api/scan/solana
      const detectedChainForEnrich = detectChain(address.trim());
      if (detectedChainForEnrich === "SOL") {
        try {
          const tokenRes = await fetch(`/api/scan/solana?mint=${encodeURIComponent(address.trim())}`);
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.tiger_score != null) {
              enrichedData = { ...enrichedData, tiger_score: tokenData.tiger_score, tiger_tier: tokenData.tiger_tier, tiger_drivers: tokenData.tiger_drivers };
            }
          }
        } catch { /* enrichissement optionnel */ }
      }
      setAddressLabel(null)
      setCorrobData(null)
      const trimmed = address.trim()
      fetch('/api/scan/label?address=' + trimmed)
        .then(r => r.json())
        .then(d => { if (d.found) setAddressLabel(d) })
        .catch(() => {})
      fetch('/api/scan/corroboration?address=' + trimmed)
        .then(r => r.json())
        .then(d => { if (d.found) setCorrobData(d) })
        .catch(() => {})
      setResult(normalizeScanData(enrichedData, chain));

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
    <div className="min-h-screen bg-black text-[#E4E4E7] font-sans selection:bg-[#F85B05] selection:text-black antialiased" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

      <BetaNav />

      <div className="p-6 md:p-12">
      <main className="max-w-5xl mx-auto">
        {/* HERO */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter mb-6 uppercase">
            Check your <span className="text-[#F85B05] not-italic">Exposure.</span>
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-base font-medium">
            Advanced forensic analysis for Solana, Ethereum, Base, Arbitrum, BSC & TRON wallets. No signatures required. Pure intelligence.
          </p>
        </div>

        {/* DEMO PRESETS CHIPS */}
        <div className="max-w-2xl mx-auto mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-700 shrink-0">Quick scan</span>
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActivePreset(p.id);
                  setAddress(p.address);
                  setIsDeep(false);
                  setTimeout(() => document.querySelector<HTMLButtonElement>("[data-scan-btn]")?.click(), 80);
                }}
                className={[
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                  activePreset === p.id
                    ? "border-[#F85B05] text-[#F85B05] bg-[#F85B05]/5"
                    : "border-zinc-800 text-zinc-500 hover:border-[#F85B05]/60 hover:text-zinc-300",
                ].join(" ")}
              >
                {p.label}
                <span className={[
                  "text-[8px] px-1 py-0.5 rounded-sm font-black",
                  p.tag === "SCAM" ? "bg-red-900/40 text-red-400" : "bg-zinc-900 text-zinc-600",
                ].join(" ")}>{p.tag}</span>
              </button>
            ))}
            <button
              onClick={() => {
                const base = pathname ?? "/en/demo";
                const url = buildDemoUrl({ base, addr: address, deep: isDeep, auto: true });
                const full = window.location.origin + url;
                navigator.clipboard.writeText(full).then(() => {
                  setCopyDone(true);
                  setTimeout(() => setCopyDone(false), 2000);
                }).catch(() => window.prompt("Copy this link:", full));
              }}
              className="ml-auto text-[9px] font-black uppercase tracking-widest text-zinc-700 hover:text-[#F85B05] transition-colors"
            >
              {copyDone ? "✓ Copied" : "Copy link"}
            </button>
          </div>
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
                onChange={(e) => { setAddress(e.target.value); setLoading(false); setError(null); }}
                placeholder="Paste address (SOL / ETH / TRON / base:0x… / arb:0x… / bsc:0x… / hyper:0x…)"
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
                Tip: <code className="text-[#F85B05]">base:0x…</code> for Base &nbsp;|&nbsp; <code className="text-[#F85B05]">arb:0x…</code> for Arbitrum &nbsp;|&nbsp; <code className="text-[#F85B05]">bsc:0x…</code> for BSC &nbsp;|&nbsp; <code className="text-[#F85B05]">hyper:0x…</code> for Hyperliquid.
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
                data-scan-btn
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

              {analysisSummary && (
                <ExplanationLayer summary={analysisSummary} locale={locale} />
              )}

              <WatchButton
                address={address.trim()}
                chain={result.chain}
                score={result.score}
              />

              <button
                onClick={async () => {
                  if (!result) return;
                  const res = await fetch(`/api/report/v2?mint=${encodeURIComponent(address.trim())}&lang=en`);
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
                    const res = await fetch(`/api/report/casefile?mint=${encodeURIComponent(address.trim())}`);
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

              {/* ── CORROBORATION SCORE ── */}
              {corrobData?.found && (
                <div style={{ background: '#0f172a', border: '1px solid ' + corrobData.label.color + '44', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center', minWidth: 64 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: corrobData.label.color, lineHeight: 1, fontFamily: 'monospace' }}>{corrobData.score}</div>
                    <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 2 }}>CORROBORATION</div>
                  </div>
                  <div style={{ width: 1, height: 40, background: '#1f2937' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: corrobData.label.color, letterSpacing: '0.1em', marginBottom: 4 }}>{locale === 'fr' ? corrobData.label.fr : corrobData.label.en}</div>
                    <div style={{ fontSize: 12, color: '#f9fafb', fontWeight: 600 }}>{corrobData.caseTitle}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{corrobData.totalNodes} entities · {corrobData.totalEdges} links · {corrobData.flaggedNodes} suspects</div>
                  </div>
                  <a href={"/" + locale + "/scan/" + address.trim() + "/timeline"} style={{ background: corrobData.label.color + '22', border: '1px solid ' + corrobData.label.color + '44', borderRadius: 6, color: corrobData.label.color, padding: '6px 14px', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
                    {locale === 'fr' ? 'Investigation complète →' : 'Full investigation →'}
                  </a>
                </div>
              )}

              {/* ── CASE INTELLIGENCE BADGE ── */}
              <CaseIntelBadge
                address={address.trim()}
                chain={result.chain === "ETH" ? "ethereum" : result.chain === "SOL" ? "solana" : undefined}
                locale={locale === "fr" ? "fr" : "en"}
              />

              {/* ── KNOWN ADDRESS BADGE ── */}
              {addressLabel?.found && (
                <div style={{ background: addressLabel.badgeColor + '11', border: '1px solid ' + addressLabel.badgeColor + '44', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 4, height: 40, background: addressLabel.badgeColor, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: addressLabel.badgeColor, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>{addressLabel.badgeText}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{addressLabel.label}</div>
                    {addressLabel.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{addressLabel.notes}</div>}
                  </div>
                </div>
              )}

              {/* ── RETAIL VERDICT BANNER ── */}
              <RetailVerdictBanner
                tier={result.tier}
                score={result.score}
                proofs={result.proofs}
                address={address.trim()}
                chain={result.chain}
                lang={locale === 'fr' ? 'fr' : 'en'}
              />

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
                    <TechnicalEvidence lang="en" chain={result.chain === "ETH" ? "ethereum" : "solana"} show={true} />
                    {debug && (
                    <details className="mt-6 rounded-xl border border-zinc-900 bg-black/40">
                      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-orange-400 hover:text-orange-300">
                        Advanced (debug)
                      </summary>
                      <div className="px-4 pb-4">
                        <pre className="overflow-auto rounded-lg border border-zinc-900 bg-black p-4 font-mono text-[10px] text-zinc-500">
                          {JSON.stringify(result.rawSummary, null, 2)}
                        </pre>
                      </div>
                    </details>
                    )}
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

        {/* ── OSINT Watchlist — Public X Signals ── */}
        <div className="space-y-3 mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            OSINT Layer — Public X Signals
          </p>
          <OsintSectionClient />
        </div>

        <div className="text-center pt-10">
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em]">Interligens Intelligence © 2026</p>
        </div>
      </main>
      </div>
    </div>
  );
}

export default function TigerScanPage() {
  return (
    <Suspense fallback={null}>
      <TigerScanPageInner />
    </Suspense>
  );
}
