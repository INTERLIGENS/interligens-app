"use client";
import BetaNav from "@/components/beta/BetaNav";
import { pushScanHistory } from "@/app/history/page";
import { getActionCopy } from "@/lib/copy/actions";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getTier, getTierColor as getTierColorUtil, computeFinalVerdict } from "@/lib/risk/tier";
import { getVerdictCopy } from "@/lib/copy/verdictCopy";
import MarketWeather from "@/components/MarketWeather";
import TigerRevealCard from "@/components/TigerRevealCard";
import AnimatedScoreRing from "@/components/AnimatedScoreRing";
import CaseFileCTA from "@/components/CaseFileCTA";
import LegalFooter from "@/components/legal/LegalFooter";
import QuickDemoBar from "@/components/demo/QuickDemoBar";
import { DEMO_PRESETS, type DemoScenario } from "@/lib/demo/presets";
import WhatToDoNow from "@/components/WhatToDoNow";
import { ExplanationLayer } from "@/components/explanation/ExplanationLayer";
import MarketContext from "@/components/market/MarketContext";
import TokenPicker, { type TokenCandidate } from "@/components/scan/TokenPicker";
import { normalizeToAnalysisSummary } from "@/lib/explanation/normalizer";
import type { Locale } from "@/lib/explanation/types";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import ScanSkeleton from "@/components/ScanSkeleton";
import AnalyzingCard from "@/components/scan/AnalyzingCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import LocaleSwitch from "@/components/LocaleSwitch";
import MiniSignalRow from "@/components/scan/MiniSignalRow";
import RetailVerdictBanner from "@/components/scan/RetailVerdictBanner";
import { computeCabalScore } from "@/lib/risk/cabal";
import ScamFamilyBlock from "@/components/scan/ScamFamilyBlock";
import RecidivismAlertBanner, { detectRecidivism } from "@/components/scan/RecidivismAlertBanner";

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
  recidivismDetected: boolean;
  recidivismConfidence: "HIGH" | "MED" | "LOW";
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
    default: return `/api/scan/sol?address=${encodeURIComponent(address.trim())}&deep=${String(deep)}`;
  }
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

function normalizeScanData(data: any, chain: Chain): NormalizedScan {
  const baseScore = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tigerScore = Number(data?.tiger_score ?? 0) || 0;
  const score = Math.max(baseScore, tigerScore);
  const tier = getTier(score);

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

  const _t = getTier(score);
  const verdict = _t === "RED" ? "Avoid" : _t === "ORANGE" ? "Caution" : "Proceed";
  const _ac = getActionCopy({ scan_type: "token", tier: score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN", chain: (chain as any) ?? "SOL" });
  const recommendations = _ac.en;

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
    recidivismDetected: false,
    recidivismConfidence: "LOW" as "HIGH"|"MED"|"LOW",
  };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function TigerScanPage() {
  const [address, setAddress]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadStep, setLoadStep]         = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<"idle"|"running"|"done"|"error">("idle");
  const [graphData, setGraphData] = useState<any>(null);
  const [result, setResult]             = useState<NormalizedScan | null>(null);
  const [weather, setWeather]           = useState<any | null>(null);
  const [isDeep, setIsDeep]             = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm]   = useState<string | null>(null);

  const chain = useMemo(() => detectChain(address), [address]);
  const analysisSummary = useMemo(() => result ? normalizeToAnalysisSummary({ ...result, address: address.trim() }) : null, [result, address]);
  const explanationLocale = "en" as Locale;
  const [debug] = React.useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1");

  // Mock mode + scenario state
  const [selectedScenario, setSelectedScenario] = React.useState<DemoScenario | null>(() => {
    if (typeof window === "undefined") return null;
    return (new URLSearchParams(window.location.search).get("mock") as DemoScenario | null);
  });
  const mockMode = selectedScenario;
  const hasAutoRun = useRef(false);

  // ── Autoload ?addr + ?auto ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const addr = p.get("addr");
    const auto = p.get("auto") === "1";
    const deep = p.get("deep") === "1";
    const mock = p.get("mock");
    if (addr && !mock) {
      setAddress(addr);
      if (deep) setIsDeep(true);
      if (auto && !hasAutoRun.current) {
        hasAutoRun.current = true;
        const newP = new URLSearchParams(window.location.search);
        newP.delete("auto");
        window.history.replaceState(null, "", window.location.pathname + (newP.toString() ? "?" + newP.toString() : ""));
        setTimeout(() => runScan(addr, undefined), 80);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const LIVE_PRESETS = [
    { id: "botify",  label: "BOTIFY",   tag: "SCAM", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb" },
    { id: "pump",    label: "PUMP.FUN", tag: "SOL",  addr: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump" },
    { id: "bonk",    label: "BONK",     tag: "SOL",  addr: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
    { id: "vitalik", label: "VITALIK",  tag: "ETH",  addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    { id: "tron",    label: "TRON",     tag: "TRX",  addr: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6" },
  ] as const;
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  const [copyDone, setCopyDone] = React.useState(false);
  const [recidivismDetected, setRecidivismDetected] = React.useState(false);
  const [recidivismConfidence, setRecidivismConfidence] = React.useState<"HIGH"|"MED"|"LOW">("LOW");
  const [tickers, setTickers] = React.useState<{ok:boolean,btc?:{price_usd:number,change_24h_pct:number},eth?:{price_usd:number,change_24h_pct:number},sol?:{price_usd:number,change_24h_pct:number}}|null>(null);
  const [corrobData, setCorrobData] = React.useState<any>(null);
  const [addressLabel, setAddressLabel] = React.useState<any>(null);
  const [tickerState, setTickerState] = React.useState<{
    query: string
    candidates: TokenCandidate[]
    loading: boolean
  } | null>(null);

  const DEMO_CHIPS = [
    { label: "✅ Safe", addr: "SAFE111111111111111111111111111111111111111", mock: "green" },
    { label: "⚠️ Warning", addr: "WARN2222222222222222222222222222222222222222", mock: "orange" },
    { label: "🚨 Scam", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", mock: "red" },
  ];

  // Auto-trigger on mount if ?mock= param present
  React.useEffect(() => {
    if (selectedScenario) {
      const preset = DEMO_PRESETS.SOL[selectedScenario];
      setAddress(preset.addr);
      setTimeout(() => runScan(preset.addr, selectedScenario), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyline = selectedScenario ? DEMO_PRESETS.SOL[selectedScenario].storyline.en : null;

  const handleSelectScenario = (scenario: DemoScenario) => {
    const preset = DEMO_PRESETS.SOL[scenario];
    setSelectedScenario(scenario);
    setAddress(preset.addr);
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set("mock", scenario);
    window.history.replaceState({}, "", url.toString());
    runScan(preset.addr, scenario);
  };

  React.useEffect(() => {
    setResolvedEvm(null);
    if (chain !== "HYPER_TOKEN_ID") return;
    fetch(`/api/resolve/hyper-token?tokenId=${encodeURIComponent(address.trim())}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.evmAddress?.address) setResolvedEvm(d.evmAddress.address); })
      .catch(() => {});
  }, [address, chain]);


  React.useEffect(() => {
    if (mockMode) {
      setTickers({ ok: true, btc: { price_usd: 95000, change_24h_pct: 1.2 }, eth: { price_usd: 3200, change_24h_pct: 0.8 }, sol: { price_usd: 180, change_24h_pct: -0.5 } });
      return;
    }
    fetch("/api/market/tickers").then(r => r.json()).then(d => setTickers(d)).catch(() => setTickers({ ok: false }));
  }, [mockMode]);

  const isHyperTokenId = chain === "HYPER_TOKEN_ID";

  // Detect whether the user typed a ticker (e.g. "$BOTIFY") rather than an
  // on-chain address. Tickers are short alphanumeric tokens, optionally
  // prefixed with $, that don't match any known address shape.
  const looksLikeTicker = (raw: string): string | null => {
    const v = raw.trim()
    if (!v) return null
    if (detectChain(v)) return null
    const m = v.match(/^\$?([A-Za-z0-9]{2,12})$/)
    if (!m) return null
    return m[1].toUpperCase()
  }

  const handleScanSubmit = async () => {
    const raw = address.trim()
    const ticker = looksLikeTicker(raw)
    if (!ticker) {
      setTickerState(null)
      runScan()
      return
    }
    setTickerState({ query: ticker, candidates: [], loading: true })
    setError(null)
    try {
      const r = await fetch('/api/scan/resolve?ticker=' + encodeURIComponent(ticker), { cache: 'no-store' })
      const data = await r.json()
      const results: TokenCandidate[] = Array.isArray(data?.results) ? data.results : []
      if (results.length === 1) {
        setTickerState(null)
        const c = results[0]
        const formatted = formatAddressForChain(c.address, c.chain)
        setAddress(formatted)
        runScan(formatted)
        return
      }
      setTickerState({ query: ticker, candidates: results, loading: false })
    } catch {
      setTickerState({ query: ticker, candidates: [], loading: false })
    }
  }

  const formatAddressForChain = (addr: string, chain: TokenCandidate['chain']): string => {
    if (chain === 'BSC') return 'bsc:' + addr
    if (chain === 'HYPER') return 'hyper:' + addr
    return addr
  }

  const handleTickerPick = (c: TokenCandidate) => {
    const formatted = formatAddressForChain(c.address, c.chain)
    setAddress(formatted)
    setTickerState(null)
    runScan(formatted)
  }

  const runScan = async (overrideAddr?: string, overrideMock?: string) => {
    const scanAddr = (overrideAddr ?? address).trim();
    const useMock = overrideMock ?? mockMode;
    if (useMock) {
      setLoading(true); setError(null); setResult(null);
      setAnalysisStatus("running");
      await new Promise(r => setTimeout(r, 800));
      try {
        const res = await fetch(`/api/mock/scan?mode=${useMock}`, { cache: "no-store" });
        const data = await res.json();
        setResult(normalizeScanData(data, "SOL"));
        setWeather(null);
        setAnalysisStatus("done");
        setTimeout(() => document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth" }), 200);
      } catch(e: any) { setError(`Scan mock failed: ${e?.message ?? String(e)}`); setAnalysisStatus("error"); }
      setLoading(false);
      return;
    }
    if (!chain || chain === "HYPER_TOKEN_ID" || loading) return;
    setLoading(true);
    setAnalysisStatus("running");
    setGraphData(null);
    setRecidivismDetected(false);
    setRecidivismConfidence("LOW");
    setError(null);
    setResult(null);

    for (let i = 0; i < 3; i++) {
      setLoadStep(i);
      await new Promise((r) => setTimeout(r, 300));
    }

    try {
      const url = buildScanUrl(address, chain, isDeep);

      // Scan + graph en PARALLÈLE — temps total = max(scan, graph)
      const graphUrl = chain === "SOL"
        ? `/api/scan/solana/graph?mint=${encodeURIComponent(address.trim())}&hops=1&days=14`
        : null;

      const [res, gData] = await Promise.all([
        fetch(url, { cache: "no-store" }),
        graphUrl
          ? fetch(graphUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) })
              .then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
      ]);

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || `Error ${res.status}`);

      const normalizedResult = normalizeScanData({ ...data, deep: isDeep }, chain);

      // Recidivism injecté DANS le result — un seul state, zéro async race
      if (gData?.clusters) {
        const rv = detectRecidivism(gData);
        if (rv.detected) {
          normalizedResult.recidivismDetected = true;
          normalizedResult.recidivismConfidence = rv.confidence;
        }
      }

      // Un seul setResult → un seul render → score final direct
      setGraphData(gData);
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
      setResult(normalizedResult);
      setAnalysisStatus("done");

      // Save to scan history
      pushScanHistory({
        address: address.trim(),
        chain,
        score: normalizedResult.score ?? null,
        tier: normalizedResult.tier ?? null,
        headline: normalizedResult.verdict ?? null,
        scannedAt: new Date().toISOString(),
      });

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
      setAnalysisStatus("error");
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  };

  const getTierColor = (t: Tier) => t === "RED" ? "#F85B05" : t === "ORANGE" ? "#facc15" : "#10b981";

  return (
    <div className="min-h-screen bg-black text-[#E4E4E7] font-sans selection:bg-[#F85B05] selection:text-black antialiased">
      <BetaNav />
      <div className="p-6 md:p-12">

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

        {/* LIVE PRESET CHIPS */}
        <div className="max-w-2xl mx-auto mb-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-700 shrink-0">Live scan</span>
            {LIVE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActivePreset(p.id);
                  setSelectedScenario(null);
                  setAddress(p.addr);
                  setTimeout(() => runScan(p.addr, undefined), 60);
                }}
                className={[
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all",
                  activePreset === p.id
                    ? "border-[#F85B05] text-[#F85B05] bg-[#F85B05]/5"
                    : "border-zinc-800 text-zinc-500 hover:border-[#F85B05]/60 hover:text-zinc-300",
                ].join(" ")}
              >
                {p.label}
                <span className={["text-[8px] px-1 py-0.5 rounded-sm font-black", p.tag === "SCAM" ? "bg-red-900/40 text-red-400" : "bg-zinc-900 text-zinc-600"].join(" ")}>{p.tag}</span>
              </button>
            ))}

          </div>
        </div>

        {/* QUICK DEMO BAR */}
        <QuickDemoBar
          locale="en"
          selectedScenario={selectedScenario}
          storyline={storyline}
          onSelectScenario={handleSelectScenario}
          shareUrl={typeof window !== "undefined" ? window.location.href : ""}
        />


        {/* SEARCH BAR */}
        <div className="relative max-w-2xl mx-auto mb-24">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#F85B05] to-orange-900 rounded-2xl blur-lg opacity-20 animate-pulse" />

          <form
            onSubmit={(e) => { e.preventDefault(); handleScanSubmit(); }}
            className="relative bg-[#0A0A0A] border border-zinc-800 rounded-xl p-2 flex flex-col md:flex-row gap-2 shadow-2xl"
          >
            <div className="flex-1 flex items-center px-4 gap-3 overflow-hidden">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Paste address or type $TICKER (BTC, ETH, SOL, BSC, TRON, HYPER)"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanSubmit(); } }}
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
              <span className="text-xs font-bold text-red-400">{error.length > 120 ? 'Scan failed — please retry.' : error}</span>
              <button onClick={() => runScan()} className="text-[10px] font-black text-white uppercase hover:underline underline-offset-4">Retry</button>
            </div>
          )}

          {tickerState && (
            <TokenPicker
              query={tickerState.query}
              candidates={tickerState.candidates}
              loading={tickerState.loading}
              locale="en"
              onPick={handleTickerPick}
              onClose={() => setTickerState(null)}
            />
          )}
        </div>

        {/* Copy link — discret, sous la barre */}
        <div className="flex justify-end max-w-2xl mx-auto -mt-20 mb-4 pr-1">
          <button
            onClick={() => {
              const base = window.location.pathname;
              const params = new URLSearchParams();
              if (address) params.set("addr", address);
              params.set("deep", isDeep ? "1" : "0");
              params.set("auto", "1");
              const full = window.location.origin + base + "?" + params.toString();
              navigator.clipboard.writeText(full).then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000); }).catch(() => window.prompt("Copy:", full));
            }}
            className="text-[9px] font-black uppercase tracking-widest text-zinc-700 hover:text-[#F85B05] transition-colors"
          >{copyDone ? "✓ Copied" : "⬡ Copy link"}</button>
        </div>

        {/* Off-chain Watchlist link */}
        <div className="flex justify-center mt-3 mb-6">
          <a
            href="/en/watchlist"
            className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-400 transition-colors group"
          >
            <span className="uppercase tracking-[0.2em]">Off-chain Watchlist</span>
            <span className="text-zinc-800 mx-1">·</span>
            <span className="text-zinc-700">Public signals • Demo mode</span>
            <span className="ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
        </div>


        {/* Analysis status flow */}
        <div className="relative">
          <div id="result-anchor" />

          {/* RUNNING: AnalyzingCard — masque le score */}
          {analysisStatus === "running" && (
            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5">
                <AnalyzingCard locale="en" step={loadStep} />
              </div>
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 h-40 animate-pulse" />
              </div>
            </div>
          )}

          {/* DONE: résultat final uniquement */}
          <div style={{ opacity: analysisStatus === "done" && result && !loading ? 1 : 0, transition: "opacity 300ms ease-in", pointerEvents: analysisStatus === "done" && result && !loading ? "auto" : "none" }}>
            {result && (() => {
              // Source de vérité : result OU graphData (pour éviter race condition)
              const _graphRv = (graphData?.clusters || graphData?.overall_status) ? detectRecidivism(graphData) : null;
              const _recDetected = result.recidivismDetected || (_graphRv?.detected ?? false);
              const _recConf = result.recidivismDetected ? result.recidivismConfidence : (_graphRv?.confidence ?? "LOW");
              const _fv = computeFinalVerdict(result.score, result.tier, _recDetected, _recConf);
              const finalTier = _fv.tier;
              const finalScore = _fv.score;
              const _vc = getVerdictCopy(_fv.tier, "en");
              const finalVerdict = _vc.label;
              const finalSub = _vc.subtitle;
              const finalActions = _vc.actions;
              const finalDisclaimer = _vc.disclaimer;
              const getTierColorFinal = getTierColorUtil;
              return (
              <>
              {/* ═══ ROW 1 — HERO: VERDICT + SIGNALS ═══ */}
              <div className="grid lg:grid-cols-12 gap-8">

            {/* ════ LEFT COLUMN ════ */}
            <div className="lg:col-span-5 bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-6 right-6">
                <span
                  className="px-3 py-1 rounded-sm border text-[10px] font-black uppercase tracking-widest"
                  style={{ borderColor: getTierColorFinal(finalTier), color: getTierColorFinal(finalTier) }}
                >
                  {finalTier}
                </span>
              </div>

              {/* 1. TigerScore ring */}
              <AnimatedScoreRing score={finalScore} tier={finalTier} color={getTierColorFinal(finalTier)} duration={900} />

              {/* 2. AVOID — verdict collé au score */}
              <h2
                className="text-5xl font-black uppercase italic tracking-tighter mt-0 mb-1"
                style={{ color: getTierColorFinal(finalTier), textShadow: `0 0 30px ${getTierColorFinal(finalTier)}44` }}
              >
                {finalVerdict}
              </h2>

              {/* 3. Phrase courte */}
              <p className="text-sm font-bold text-zinc-400 mb-6 px-4 leading-relaxed">
                {finalSub}
              </p>

              {/* 4. WHY THIS SCORE */}
              <a href="/en/demo/why" className="inline-flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] hover:text-white transition-all border border-[#F85B05]/40 hover:border-[#F85B05] bg-[#F85B05]/8 hover:bg-[#F85B05]/15 px-5 py-2.5 rounded-lg shadow-[0_0_12px_rgba(248,91,5,0.08)]">
                Why this score?
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6h7M6.5 2.5l3 3.5-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>

              {/* 5. ASK INTERLIGENS */}
              {analysisSummary && (
                <div className="w-full rounded-xl overflow-hidden" style={{ background: '#080808', border: '1px solid rgba(248,91,5,0.25)', boxShadow: '0 0 40px rgba(248,91,5,0.10)' }}>
                  <div className="px-5 pt-4 pb-2 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black" style={{ background: '#F85B05', color: '#000' }}>AI</div>
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#F85B05]">Ask INTERLIGENS</span>
                  </div>
                  <div className="px-5 pb-5">
                    <ExplanationLayer summary={analysisSummary} locale={explanationLocale} />
                  </div>
                </div>
              )}

              {/* 6. MARKET CONTEXT */}
              <div className="mt-4">
                <MarketContext locale="en" />
              </div>
            </div>

            {/* ════ RIGHT COLUMN ════ */}
            <div className="lg:col-span-7 flex flex-col gap-5">

              {/* 1. DO NOT BUY — with What to do now integrated */}
              <RetailVerdictBanner
                tier={finalTier}
                score={result.score}
                proofs={result.proofs}
                address={address.trim()}
                chain={result.chain}
                lang="en"
                actions={[...finalActions]}
                disclaimer={finalDisclaimer}
              />

              {/* ── KNOWN ADDRESS BADGE ── */}
              {addressLabel?.found && (
                <div style={{ background: addressLabel.badgeColor + '11', border: '1px solid ' + addressLabel.badgeColor + '44', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 4, height: 40, background: addressLabel.badgeColor, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: addressLabel.badgeColor, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>{addressLabel.badgeText}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb' }}>{addressLabel.label}</div>
                    {addressLabel.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{addressLabel.notes}</div>}
                    <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>Source: {addressLabel.source} · {addressLabel.confidence} confidence</div>
                  </div>
                </div>
              )}

              {/* ── RECIDIVISM ALERT ── */}
              {result.chain === "SOL" && (
                <RecidivismAlertBanner
                  mint={address.trim()}
                  locale="en"
                  graphData={graphData}
                />
              )}

              {/* 2. PROOF PACK — PDF, Casefile, Evidence, Timeline */}
              <div className="bg-[#080808] border border-zinc-800/80 rounded-xl p-4" style={{ borderTop: '2px solid #F85B0540' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05]">Proof Pack</span>
                  <span className="text-[9px] text-zinc-700 font-mono">{result.proofs?.length ?? 0} signals · {result.chain}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      if (!result) return;
                      const res = await fetch(`/api/report/v2?mint=${encodeURIComponent(address.trim())}&lang=en&mock=1`);
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href     = url;
                      a.download = `interligens-${result.chain.toLowerCase()}-${result.rawSummary?.address ?? address.slice(0,8)}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex-1 py-2.5 rounded-lg border border-[#F85B05]/30 text-[10px] font-black uppercase tracking-[0.15em] text-[#F85B05] hover:bg-[#F85B05]/10 transition-all"
                  >
                    PDF Report
                  </button>
                  <button
                    onClick={() => { setShowEvidence(true); setTimeout(() => document.getElementById('evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
                    className="flex-1 py-2.5 rounded-lg border border-zinc-800 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 hover:text-[#F85B05] hover:border-zinc-600 transition-all"
                  >
                    Evidence
                  </button>
                  {corrobData?.found && (
                    <a
                      href={'/en/scan/' + address.trim() + '/timeline'}
                      className="flex-1 py-2.5 rounded-lg border border-zinc-800 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 hover:text-[#F85B05] hover:border-zinc-600 transition-all text-center no-underline"
                    >
                      Timeline
                    </a>
                  )}
                </div>
                <div className="mt-3">
                  <CaseFileCTA id={address.trim() || null} lang="en" />
                </div>
              </div>

              {/* 3. MINI SIGNAL CARDS */}
              <MiniSignalRow
                lang="en"
                tier={finalTier.toLowerCase() as any}
                weather={weather}
                show={true}
                rawSummary={result.rawSummary}
              />

              {/* 4. TOP ON-CHAIN PROOFS + ASK TIGER ANALYST */}
              <TigerRevealCard tier={finalTier} proofs={result.proofs} />
            </div>
          </div>

              {/* ═══ ROW 2 — SCAM FAMILY / RELATED (full width) ═══ */}
              {result.chain === "SOL" && (
                <div className="mt-8">
                  <ScamFamilyBlock
                    mint={address.trim()}
                    hops={1}
                    days={30}
                    locale="en"
                    showDebug={debug}
                  />
                </div>
              )}

              {/* ── CORROBORATION ── */}
              {corrobData?.found && (
                <div className="mt-6" style={{ background: '#0f172a', border: '1px solid ' + corrobData.label.color + '44', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center', minWidth: 64 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: corrobData.label.color, lineHeight: 1, fontFamily: 'monospace' }}>{corrobData.score}</div>
                    <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>CORROBORATION</div>
                  </div>
                  <div style={{ width: 1, height: 40, background: '#1f2937' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: corrobData.label.color, letterSpacing: '0.1em', marginBottom: 4 }}>{corrobData.label.en}</div>
                    <div style={{ fontSize: 12, color: '#f9fafb', fontWeight: 600 }}>{corrobData.caseTitle}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                      {corrobData.totalNodes} entities · {corrobData.totalEdges} links · {corrobData.flaggedNodes} suspects · {corrobData.highEdges} HIGH confidence
                    </div>
                  </div>
                  <a href={'/en/scan/' + address.trim() + '/timeline'} style={{ background: corrobData.label.color + '22', border: '1px solid ' + corrobData.label.color + '44', borderRadius: 6, color: corrobData.label.color, padding: '6px 14px', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Full investigation →
                  </a>
                </div>
              )}

              {/* ═══ ROW 3 — DEPTH (collapsible) ═══ */}
              <div id="evidence-section" className="mt-6 border border-zinc-800/60 rounded-xl px-4 py-3">
                <button onClick={() => setShowEvidence(!showEvidence)} className="w-full flex justify-between items-center group">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    Technical Evidence
                  </span>
                  <span className="text-sm text-zinc-700 group-hover:text-[#F85B05]">{showEvidence ? "−" : "+"}</span>
                </button>

                {showEvidence && (
                  <div className="mt-4 space-y-4">
                    <TechnicalEvidence lang="en" chain={result.chain === "ETH" ? "ethereum" : "solana"} show={true} provider_used={result.provider_used} data_source={result.data_source} source_detail={result.source_detail} rpc_fallback_used={result.rpc_fallback_used} cache_hit={result.cache_hit} rpc_down={result.rpc_down} rpc_error={result.rpc_error} spenders={result.spenders} counterparties={result.counterparties} unlimitedCount={result.unlimitedCount} freezeAuthority={result.freezeAuthority} mintAuthority={result.mintAuthority} />
                    {debug && (
                      <details className="rounded-xl border border-zinc-900 bg-black/40">
                        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[#FF6B00]/60 hover:text-[#FF6B00]">Raw data (debug)</summary>
                        <div className="px-4 pb-4">
                          <pre className="overflow-auto rounded-lg border border-zinc-900 bg-black p-4 font-mono text-[10px] text-zinc-500">{JSON.stringify(result.rawSummary, null, 2)}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>

          </>
            );
            })()}
          </div>
        </div>

        {/* ── GO DEEPER ── */}
        {result && (
          <div className="mt-14 mb-6 border-t border-[#1a1a1a] pt-6 flex items-center gap-6 flex-wrap">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em]">Go deeper</span>
            <a href="/en/kol" className="text-[12px] font-semibold text-zinc-500 hover:text-[#FF6B00] transition-colors no-underline">KOL Registry &rarr;</a>
            <a href="/en/explorer" className="text-[12px] font-semibold text-zinc-500 hover:text-[#FF6B00] transition-colors no-underline">Case Explorer &rarr;</a>
            <a href="/en/methodology" className="text-[12px] font-semibold text-zinc-500 hover:text-[#FF6B00] transition-colors no-underline">Methodology &rarr;</a>
          </div>
        )}

        <div className="pt-10 flex flex-col items-center gap-3">
          <LegalFooter lang="en" />
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em]">Interligens Intelligence © 2026</p>
        </div>
      </main>
      </div>
    </div>
  );
}
