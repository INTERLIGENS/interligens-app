// src/hooks/useDemoScan.ts
// Single source of truth for demo scan logic — partagé EN + FR
"use client";

import { useState, useRef, useEffect } from "react";
import { getTier } from "@/lib/risk/tier";
import { getActionCopy } from "@/lib/copy/actions";
import { detectRecidivism } from "@/components/scan/RecidivismAlertBanner";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Chain = "SOL" | "ETH" | "TRON" | "BSC" | "HYPER" | "HYPER_TOKEN_ID";
export type RiskLevel = "low" | "medium" | "high";
export type Tier = "GREEN" | "ORANGE" | "RED";
export type Confidence = "HIGH" | "MED" | "LOW";

export interface TopProof {
  label: string;
  value: string;
  level: RiskLevel;
  riskDescription: string;
}

export interface NormalizedScan {
  score: number;
  tier: Tier;
  confidence: string;
  verdict: string;
  recommendations: string[];
  proofs: TopProof[];
  rawSummary: any;
  chain: Chain;
  spenders: any[];
  counterparties: any[];
  provider_used?: string;
  data_source?: string;
  source_detail?: string;
  rpc_fallback_used: boolean;
  cache_hit: boolean;
  rpc_down: boolean;
  rpc_error?: string;
  unlimitedCount: number;
  freezeAuthority: boolean;
  mintAuthority: boolean;
  recidivismDetected: boolean;
  recidivismConfidence: Confidence;
}

// ─── CHAIN DETECTION ─────────────────────────────────────────────────────────

export function detectChain(address: string): Chain | null {
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

// ─── SCAN URL BUILDER ────────────────────────────────────────────────────────

export function buildScanUrl(address: string, chain: Chain, deep: boolean): string {
  const a = encodeURIComponent(address.trim());
  const d = String(deep);
  switch (chain) {
    case "BSC":   return `/api/scan/bsc?address=${encodeURIComponent(address.trim().replace(/^bsc:/i,""))}&deep=${d}`;
    case "HYPER": return `/api/scan/hyper?address=${encodeURIComponent(address.trim().replace(/^hyper:/i,""))}&deep=${d}`;
    case "TRON":  return `/api/scan/tron?address=${a}&deep=${d}`;
    case "ETH":   return `/api/scan/eth?address=${a}&deep=${d}`;
    case "SOL":   return `/api/scan/solana?mint=${a}`;
    default:      return `/api/scan/sol?address=${encodeURIComponent(address.trim())}&deep=${String(deep)}`;
  }
}

// ─── NORMALIZER ──────────────────────────────────────────────────────────────

export function normalizeScanData(data: any, chain: Chain, lang: "en" | "fr" = "en"): NormalizedScan {
  const baseScore  = Number(data?.score ?? data?.risk?.score ?? 0) || 0;
  const tigerScore = Number(data?.tiger_score ?? 0) || 0;
  const score      = Math.max(baseScore, tigerScore);
  const tier       = getTier(score);
  const proofs: TopProof[] = [];

  if (chain === "SOL") {
    const claims        = data?.off_chain?.claims ?? [];
    const offchainSource = data?.off_chain?.source ?? "none";
    const claimsCount   = claims.length;
    if (offchainSource === "case_db" && claimsCount > 0) {
      if (lang === "fr") {
        const statusFr = (data?.off_chain?.status ?? "Référencé").replace("Referenced","Référencé").replace("Corroborated","Corroboré").replace("Unknown","Inconnu");
        proofs.push({ label: "CaseDB",   value: `${claimsCount} Signaux`, level: "high", riskDescription: "Détective Référencé — dossier existant" });
        proofs.push({ label: "Statut",   value: statusFr,                  level: "high", riskDescription: "Résultat investigation hors-chaîne" });
        proofs.push({ label: "Dossier",  value: data?.off_chain?.case_id ?? "—", level: "high", riskDescription: "Identifiant du dossier" });
      } else {
        proofs.push({ label: "CaseDB",  value: `${claimsCount} Claims`,               level: "high", riskDescription: "Detective Referenced — case on file" });
        proofs.push({ label: "Status",  value: data?.off_chain?.status ?? "Referenced", level: "high", riskDescription: "Off-chain investigation result" });
        proofs.push({ label: "Case",    value: data?.off_chain?.case_id ?? "—",         level: "high", riskDescription: "Case identifier" });
      }
    } else {
      proofs.push({ label: lang === "fr" ? "Réseau" : "Network", value: "Solana Mainnet", level: "low", riskDescription: lang === "fr" ? "Chaîne officielle" : "Official chain" });
      proofs.push({ label: "Score",  value: `${score}/100`, level: score > 60 ? "high" : "low", riskDescription: lang === "fr" ? "Évaluation du risque" : "Risk assessment" });
      proofs.push({ label: "Source", value: offchainSource,  level: "low", riskDescription: lang === "fr" ? "Source des données" : "Data source" });
    }
  } else if (chain === "ETH") {
    const unlimited = data?.approvalsSummary?.unlimited ?? 0;
    const total     = data?.approvalsSummary?.total ?? 0;
    proofs.push({ label: "Approvals", value: `${unlimited} Unlimited`, level: unlimited > 0 ? "high" : "low", riskDescription: unlimited > 0 ? "Drain vector exposure" : "No unlimited approvals detected" });
    proofs.push({ label: "Exposure",  value: `${total} Contracts`,     level: total > 8 ? "medium" : "low",   riskDescription: total > 8 ? "Wider attack surface" : "Normal exposure" });
    proofs.push({ label: "Activity",  value: "Recent TXs Found",       level: "low", riskDescription: "Active wallet profile" });
  } else if (chain === "BSC" || chain === "HYPER") {
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.riskDescription ?? "" })
      );
    } else {
      const net = chain === "BSC" ? "BNB Smart Chain" : "HyperEVM Mainnet";
      proofs.push({ label: "Network", value: net,             level: "low",    riskDescription: `Official ${net}` });
      proofs.push({ label: "Score",   value: `${score}/100`,  level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
      proofs.push({ label: "Mode",    value: "Demo stable",   level: "medium", riskDescription: "Add API key for live data" });
    }
  } else {
    // TRON
    const apiProofs: any[] = Array.isArray(data?.proofs) ? data.proofs : [];
    if (apiProofs.length > 0) {
      apiProofs.slice(0, 3).forEach((p: any) =>
        proofs.push({ label: p.label ?? "Signal", value: p.value ?? "—", level: p.level === "red" ? "high" : p.level === "orange" ? "medium" : "low", riskDescription: p.value ?? "" })
      );
    } else {
      proofs.push({ label: "Network", value: "TRON chain",   level: "low",                       riskDescription: "Official TRON network" });
      proofs.push({ label: "Score",   value: `${score}/100`, level: score > 60 ? "high" : "low", riskDescription: "Risk assessment" });
      proofs.push({ label: "Mode",    value: "Demo stable",  level: "low",                       riskDescription: "Live data available on upgrade" });
    }
  }

  const _t  = getTier(score);
  const verdict = _t === "RED" ? (lang === "fr" ? "Éviter" : "Avoid") : _t === "ORANGE" ? (lang === "fr" ? "Prudence" : "Caution") : (lang === "fr" ? "OK" : "Proceed");
  const _ac = getActionCopy({ scan_type: "token", tier: score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN", chain: (chain as any) ?? "SOL" });
  const recommendations = lang === "fr" ? (_ac.fr ?? _ac.en) : _ac.en;

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
    recidivismConfidence: "LOW" as Confidence,
  };
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export interface UseDemoScanOptions {
  lang: "en" | "fr";
  mockApiPath?: string;
}

export function useDemoScan({ lang, mockApiPath = "/api/mock/scan" }: UseDemoScanOptions) {
  const [address, setAddress]                   = useState("");
  const [loading, setLoading]                   = useState(false);
  const [loadStep, setLoadStep]                 = useState(0);
  const [analysisStatus, setAnalysisStatus]     = useState<"idle"|"running"|"done"|"error">("idle");
  const [graphData, setGraphData]               = useState<any>(null);
  const [result, setResult]                     = useState<NormalizedScan | null>(null);
  const [weather, setWeather]                   = useState<any | null>(null);
  const [isDeep, setIsDeep]                     = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [resolvedEvm, setResolvedEvm]           = useState<string | null>(null);
  const [activePreset, setActivePreset]         = useState<string | null>(null);
  const [copyDone, setCopyDone]                 = useState(false);
  const [recidivismDetected, setRecidivismDetected]   = useState(false);
  const [recidivismConfidence, setRecidivismConfidence] = useState<Confidence>("LOW");
  const hasAutoRun = useRef(false);

  const chain: Chain | null = detectChain(address);
  const isHyperTokenId = chain === "HYPER_TOKEN_ID";

  const reset = () => {
    setResult(null);
    setGraphData(null);
    setAnalysisStatus("idle");
    setRecidivismDetected(false);
    setRecidivismConfidence("LOW");
    setError(null);
    setWeather(null);
  };

  const runScan = async (overrideAddr?: string, overrideMock?: string) => {
    const scanAddr = (overrideAddr ?? address).trim();
    const useMock  = overrideMock;

    if (useMock) {
      setLoading(true); setError(null); setResult(null);
      await new Promise(r => setTimeout(r, 800));
      try {
        const res  = await fetch(`${mockApiPath}?mode=${useMock}`, { cache: "no-store" });
        const data = await res.json();
        setResult(normalizeScanData(data, "SOL", lang));
        setWeather(null);
        setTimeout(() => document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth" }), 200);
      } catch(e: any) { setError(`Scan mock failed: ${e?.message ?? String(e)}`); }
      setLoading(false);
      setAnalysisStatus("done");
      return;
    }

    const detectedChain = detectChain(scanAddr);
    if (!detectedChain || detectedChain === "HYPER_TOKEN_ID" || loading) return;

    setLoading(true);
    setAnalysisStatus("running");
    setGraphData(null);
    setRecidivismDetected(false);
    setRecidivismConfidence("LOW");
    setError(null);
    setResult(null);

    for (let i = 0; i < 3; i++) {
      setLoadStep(i);
      await new Promise(r => setTimeout(r, 300));
    }

    try {
      const url      = buildScanUrl(scanAddr, detectedChain, isDeep);
      const graphUrl = detectedChain === "SOL"
        ? `/api/scan/solana/graph?mint=${encodeURIComponent(scanAddr)}&hops=1&days=14`
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

      const normalizedResult = normalizeScanData({ ...data, deep: isDeep }, detectedChain, lang);

      if (gData?.clusters) {
        const rv = detectRecidivism(gData);
        if (rv.detected) {
          normalizedResult.recidivismDetected  = true;
          normalizedResult.recidivismConfidence = rv.confidence;
          setRecidivismDetected(true);
          setRecidivismConfidence(rv.confidence);
        }
      }

      setGraphData(gData);
      setResult(normalizedResult);
      setAnalysisStatus("done");

      // Social heat (fire-and-forget)
      try {
        const heatRes = await fetch("/api/social/heat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: scanAddr, chain: detectedChain, deep: isDeep, rawSummary: data?.rawSummary ?? data?.summary ?? data ?? null }),
        });
        setWeather(heatRes.ok ? await heatRes.json() : null);
      } catch { setWeather(null); }

      setTimeout(() => document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth" }), 200);

    } catch(e: any) {
      setError(e?.message ?? String(e));
      setAnalysisStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return {
    // state
    address, setAddress,
    loading, loadStep,
    analysisStatus,
    graphData,
    result, setResult,
    weather,
    isDeep, setIsDeep,
    error,
    resolvedEvm, setResolvedEvm,
    activePreset, setActivePreset,
    copyDone, setCopyDone,
    recidivismDetected,
    recidivismConfidence,
    hasAutoRun,
    chain,
    isHyperTokenId,
    // actions
    runScan,
    reset,
  };
}
