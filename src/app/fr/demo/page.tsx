"use client";
import { getActionCopy } from "@/lib/copy/actions";

import React, { useState, useRef, useMemo } from "react";
import MarketWeather from "@/components/MarketWeather";
import TigerRevealCard from "@/components/TigerRevealCard";
import AnimatedScoreRing from "@/components/AnimatedScoreRing";
import CaseFileCTA from "@/components/CaseFileCTA";
import QuickDemoBar from "@/components/demo/QuickDemoBar";
import { DEMO_PRESETS, type DemoScenario } from "@/lib/demo/presets";
import WhatToDoNow from "@/components/WhatToDoNow";
import TechnicalEvidence from "@/components/TechnicalEvidence";
import LocaleSwitch from "@/components/LocaleSwitch";
import MiniSignalRow from "@/components/scan/MiniSignalRow";
import { computeCabalScore } from "@/lib/risk/cabal";

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
    case "SOL":  return `/api/scan/solana?mint=${a}`;
    default: return `/api/scan/sol?address=${encodeURIComponent(address.trim())}&deep=${String(deep)}`;
  }
}

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

function normalizeScanData(data: any, chain: Chain): NormalizedScan {
  const baseScore = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tigerScore = Number(data?.tiger_score ?? 0) || 0;
  const score = Math.max(baseScore, tigerScore);
  const tierRaw = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : (String(data?.tier ?? data?.risk?.tier ?? "GREEN").toUpperCase());
  const tier = (["GREEN", "ORANGE", "RED"].includes(tierRaw) ? tierRaw : "GREEN") as Tier;

  const proofs: TopProof[] = [];

  if (chain === "SOL") {
    const claims = data?.off_chain?.claims ?? [];
    const offchainSource = data?.off_chain?.source ?? "none";
    const claimsCount = claims.length;
    if (offchainSource === "case_db" && claimsCount > 0) {
      proofs.push({ label: "CaseDB", value: `${claimsCount} Signaux`, level: "high", riskDescription: "Détective Référencé — dossier existant" });
      const statusFr = (data?.off_chain?.status ?? "Référencé").replace("Referenced", "Référencé").replace("Corroborated", "Corroboré").replace("Unknown", "Inconnu");
      proofs.push({ label: "Statut", value: statusFr, level: "high", riskDescription: "Résultat investigation hors-chaîne" });
      proofs.push({ label: "Dossier", value: data?.off_chain?.case_id ?? "—", level: "high", riskDescription: "Identifiant du dossier" });
      const scanDate = data?.scanned_at ? new Date(data.scanned_at).toLocaleString("fr-FR", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
      proofs.push({ label: "Scanné le", value: scanDate, level: "low", riskDescription: "Horodatage du scan" });
    } else {
      proofs.push({ label: "Réseau", value: "Solana Mainnet", level: "low", riskDescription: "Chaîne officielle" });
      proofs.push({ label: "Score", value: `${score}/100`, level: score > 60 ? "high" : "low", riskDescription: "Évaluation du risque" });
      proofs.push({ label: "Source", value: offchainSource, level: "low", riskDescription: "Source des données" });
    }
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
    // TRON
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
  const _acFr = getActionCopy({ scan_type: "token", tier: score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN", chain: (chain as any) ?? "SOL" });
  const recommendations = _acFr.fr;

  return {
    score, tier,
    confidence: (chain === "ETH" || chain === "BSC") ? (data?.deep ? "High" : "Medium") : "Medium",
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


function ScanSkeleton() {
  return (
    <div className="max-w-md mx-auto space-y-8 animate-pulse">
      <div className="h-2 bg-zinc-800 rounded-full w-full" />
      <div className="h-2 bg-zinc-800 rounded-full w-3/4" />
      <div className="h-2 bg-zinc-800 rounded-full w-1/2" />
    </div>
  );
}
export default function TigerScanPageFR() {
  const [address, setAddress]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadStep, setLoadStep]         = useState(0);
  const SCAN_STEPS = ['Analyse…', 'Marché…', 'Preuves…'];
  const [result, setResult]             = useState<NormalizedScan | null>(null);
  const [weather, setWeather]           = useState<any | null>(null);
  const [isDeep, setIsDeep]             = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm]   = useState<string | null>(null);

  const chain = useMemo(() => detectChain(address), [address]);
  const [debug] = React.useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1");

  const [selectedScenario, setSelectedScenario] = React.useState<DemoScenario | null>(() => {
    if (typeof window === "undefined") return null;
    return (new URLSearchParams(window.location.search).get("mock") as DemoScenario | null);
  });
  const mockMode = selectedScenario;
  const hasAutoRun = useRef(false);

  // ── Autoload ?addr + ?auto ──
  React.useEffect(() => {
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

  const LIVE_PRESETS_FR = [
    { id: "botify",  label: "BOTIFY",   tag: "ARNAQUE", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb" },
    { id: "pump",    label: "PUMP.FUN", tag: "SOL",     addr: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump" },
    { id: "bonk",    label: "BONK",     tag: "SOL",     addr: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
    { id: "vitalik", label: "VITALIK",  tag: "ETH",     addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    { id: "tron",    label: "TRON",     tag: "TRX",     addr: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6" },
  ] as const;
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  const [copyDone, setCopyDone] = React.useState(false);
  const [tickers, setTickers] = React.useState<{ok:boolean,btc?:{price_usd:number,change_24h_pct:number},eth?:{price_usd:number,change_24h_pct:number},sol?:{price_usd:number,change_24h_pct:number}}|null>(null);

  const DEMO_CHIPS = [
    { label: "✅ Sûr", addr: "SAFE111111111111111111111111111111111111111", mock: "green" },
    { label: "⚠️ Attention", addr: "WARN2222222222222222222222222222222222222222", mock: "orange" },
    { label: "🚨 Arnaque", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", mock: "red" },
  ];

  React.useEffect(() => {
    if (selectedScenario) {
      const preset = DEMO_PRESETS.SOL[selectedScenario];
      setAddress(preset.addr);
      setTimeout(() => runScan(preset.addr, selectedScenario), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyline = selectedScenario ? DEMO_PRESETS.SOL[selectedScenario].storyline.fr : null;

  const handleSelectScenario = (scenario: DemoScenario) => {
    const preset = DEMO_PRESETS.SOL[scenario];
    setSelectedScenario(scenario);
    setAddress(preset.addr);
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
      } catch(e) { setError("Échec du mock"); }
      setLoading(false);
      return;
    }
    if (!chain) return;
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
    <div className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans selection:bg-[#F85B05] selection:text-black antialiased p-6 md:p-12" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

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
            Vérifiez votre <span className="text-[#F85B05] not-italic">Exposition.</span>
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-base font-medium">
            Analyse forensique pour wallets Solana, Ethereum & TRON. Aucune signature requise. Intelligence pure.
          </p>
        </div>

        {/* DEMO CHIPS */}
        {/* PRÉRÉGLAGES EN DIRECT */}
        <div className="max-w-2xl mx-auto mb-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-700 shrink-0">Scan direct</span>
            {LIVE_PRESETS_FR.map((p) => (
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
                <span className={["text-[8px] px-1 py-0.5 rounded-sm font-black", p.tag === "ARNAQUE" ? "bg-red-900/40 text-red-400" : "bg-zinc-900 text-zinc-600"].join(" ")}>{p.tag}</span>
              </button>
            ))}
            <button
              onClick={() => {
                const base = window.location.pathname;
                const params = new URLSearchParams();
                if (address) params.set("addr", address);
                params.set("deep", isDeep ? "1" : "0");
                params.set("auto", "1");
                const full = window.location.origin + base + "?" + params.toString();
                navigator.clipboard.writeText(full).then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000); }).catch(() => window.prompt("Copier ce lien :", full));
              }}
              className="ml-auto text-[9px] font-black uppercase tracking-widest text-zinc-700 hover:text-[#F85B05] transition-colors"
            >{copyDone ? "✓ Copié" : "Copier le lien"}</button>
          </div>
        </div>

        <QuickDemoBar
          locale="fr"
          selectedScenario={selectedScenario}
          storyline={storyline}
          onSelectScenario={handleSelectScenario}
          shareUrl={typeof window !== "undefined" ? window.location.href : ""}
        />

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
              <span className="text-xs font-bold text-red-400">{error.length > 120 ? 'Analyse échouée — réessayez.' : error}</span>
              <button onClick={() => runScan()} className="text-[10px] font-black text-white uppercase hover:underline underline-offset-4">Réessayer</button>
            </div>
          )}
        </div>

        {/* Crossfade skeleton → contenu */}
        <div className="relative">
          <div style={{ opacity: loading ? 1 : 0, transition: "opacity 250ms ease-out", pointerEvents: loading ? "auto" : "none" }}>
            {loading && (
              <>
                <p className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-[#F85B05] mb-4 animate-pulse">{SCAN_STEPS[loadStep] ?? 'Analyse…'}</p>
                <ScanSkeleton />
              </>
            )}
          </div>

          <div id="result-anchor" />
          <div style={{ opacity: result && !loading ? 1 : 0, transition: 'opacity 300ms ease-in, transform 350ms ease-out', transform: result && !loading ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(6px)', pointerEvents: result && !loading ? 'auto' : 'none' }}>
            {result && (
              <div className="grid lg:grid-cols-12 gap-8">

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

              <AnimatedScoreRing score={result.score} tier={result.tier} color={getTierColor(result.tier)} duration={900} />

              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-1 mt-2">Voici pourquoi c&apos;est important.</p>
              <h2 className="text-4xl font-black uppercase italic mb-3 tracking-tighter">{result.verdict}</h2>
              <p className="text-zinc-500 text-sm font-medium mb-10 px-4 leading-relaxed italic">
                {result.verdict === "OK" ? "Wallet sain. Vérifiez quand même les URLs."
                : result.verdict === "Prudence" ? "Signaux suspects détectés. Procédez avec prudence."
                : "Patterns à haut risque. Évitez toute interaction."}
              </p>

              <div className="w-full space-y-3 mb-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left ml-2 mb-2">À faire maintenant ↓</p>
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-left hover:border-zinc-600 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F85B05] shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-tight">{rec}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setShowEvidence(true); setTimeout(() => document.getElementById('evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
                className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-[#F85B05] transition-colors text-center"
              >Voir les preuves →</button>

              <button
                onClick={async () => {
                  if (!result) return;
                  const res = await fetch(`/api/report/v2?mint=${encodeURIComponent(address.trim())}&lang=fr`);
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
                Générer le rapport complet (PDF)
              </button>
                <CaseFileCTA id={address.trim() || null} lang="fr" />
                <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-2" style={{color:"#F85B05"}}>Marché</p>
                  {mockMode ? (
                    <div className="flex flex-col gap-1 font-mono text-xs">
                      <span className="text-zinc-200">BTC <span className="text-zinc-400">95 000$</span> <span className="text-emerald-400">(+1,2%)</span></span>
                      <span className="text-zinc-200">ETH <span className="text-zinc-400">3 200$</span> <span className="text-emerald-400">(+0,8%)</span></span>
                      <span className="text-zinc-200">SOL <span className="text-zinc-400">180$</span> <span className="text-red-400">(-0,5%)</span></span>
                    </div>
                  ) : tickers?.ok ? (
                    <div className="flex flex-col gap-1 font-mono text-xs">
                      {[["BTC", tickers.btc],["ETH", tickers.eth],["SOL", tickers.sol]].map(([sym, c]: any) => c ? (
                        <span key={sym} className="text-zinc-200">{sym} <span className="text-zinc-400">{c.price_usd.toLocaleString("fr-FR")}$</span> <span className={c.change_24h_pct >= 0 ? "text-emerald-400" : "text-red-400"}>({c.change_24h_pct >= 0 ? "+" : ""}{c.change_24h_pct.toFixed(1).replace(".",",")}%)</span></span>
                      ) : null)}
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-zinc-600">MARCHÉ —</p>
                  )}
                </div>
            </div>

            {/* RIGHT: SIGNALS + CARDS */}
            <div className="lg:col-span-7 flex flex-col gap-6">

              {/* ── 3 signal cards in a flat grid row (no nesting) ── */}
              <MiniSignalRow
                lang="fr"
                tier={result.tier.toLowerCase() as any}
                weather={weather}
                show={true}
                rawSummary={result.rawSummary}
              />

              {/* POURQUOI CE SCORE */}
              {(() => {
                const _cabal = computeCabalScore({
                  chain: result.chain,
                  address: address.trim(),
                  off_chain: result.rawSummary?.off_chain,
                  tiger_drivers: result.rawSummary?.tiger_drivers ?? [],
                  market: result.rawSummary?.markets,
                  spenders: result.spenders,
                  unlimitedCount: result.unlimitedCount,
                });
                const _p = ["casefile_present","pump_like","wash_hype","unknown_spenders","unlimited_approvals"];
                const _top = _p.find(d => _cabal.drivers.includes(d));
                const _map: Record<string,string> = {
                  casefile_present: "Dossier d'investigation référencé",
                  pump_like: "Pattern pump + déséquilibre FDV/liquidité",
                  wash_hype: "Ratio volume/liquidité anormal",
                  unknown_spenders: "Approbations de contrats inconnus",
                  unlimited_approvals: "Approbations illimitées détectées",
                };
                const _why = _top ? _map[_top] : "Signaux limités (démo)";
                return (
                  <div className="rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-zinc-500 mb-1">Pourquoi Ce Score</p>
                    <p className="text-xs font-semibold text-zinc-300 leading-snug line-clamp-2">{_why}</p>
                  </div>
                );
              })()}

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
              <div id="evidence-section" className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl p-6">
                <button onClick={() => setShowEvidence(!showEvidence)} className="w-full flex justify-between items-center group">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors underline decoration-[#F85B05] underline-offset-8">
                    Preuves techniques
                  </span>
                  <span className="text-xl text-zinc-700 group-hover:text-[#F85B05]">{showEvidence ? "−" : "+"}</span>
                </button>

                {showEvidence && (
                  <>
                    <TechnicalEvidence lang="fr" chain={result.chain === "ETH" ? "ethereum" : "solana"} show={true} provider_used={result.provider_used} data_source={result.data_source} source_detail={result.source_detail} rpc_fallback_used={result.rpc_fallback_used} cache_hit={result.cache_hit} rpc_down={result.rpc_down} rpc_error={result.rpc_error} spenders={result.spenders} counterparties={result.counterparties} unlimitedCount={result.unlimitedCount} freezeAuthority={result.freezeAuthority} mintAuthority={result.mintAuthority} />
                    {debug && (
                    <details className="mt-6 rounded-xl border border-zinc-900 bg-black/40">
                      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-widest text-orange-400 hover:text-orange-300">
                        Avancé (debug)
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
                  BA Audit Trace : Modèle v2.6.x — preuves basées sur des faits mesurables (sans diffamation).
                </p>
              </div>

            </div>
          </div>
        )}
          </div>
        </div>

        <div className="text-center pt-10">
          <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em]">Interligens Intelligence © 2026</p>
        </div>
      </main>
    </div>
  );
}
