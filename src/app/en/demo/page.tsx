"use client";

import React, { useState, useEffect, useMemo } from "react";

// --- TYPES & INTERFACES ---
interface StandardizedScan {
  score: number;
  tier: string;
  verdict: string;
  recommendation: string;
  evidence: { label: string; value: string; level: "low" | "medium" | "high" }[];
  details: any;
}

// --- HELPERS ---
const getChain = (address: string) => {
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())) return "SOL";
  if (/^0x[a-fA-F0-9]{40}$/.test(address.trim())) return "ETH";
  return null;
};

const normalizeData = (data: any, chain: string): StandardizedScan => {
  const isSol = chain === "SOL";
  const score = isSol ? (data.risk?.score ?? 0) : (data.score ?? 0);
  const tier = isSol ? (data.risk?.tier || "UNKNOWN") : (data.tier || "UNKNOWN");
  
  const isHighRisk = score > 60;
  
  return {
    score,
    tier,
    verdict: isHighRisk ? "Critical Exposure" : "Secure Wallet",
    recommendation: isHighRisk ? "Revoke permissions immediately." : "No immediate threat detected.",
    evidence: isSol ? [
      { label: "Risk Tier", value: tier, level: isHighRisk ? "high" : "low" },
      { label: "Programs", value: `${data.programsSummary?.unknownCount ?? data.unknownProgramsCount ?? 0} unknown`, level: "medium" },
    ] : [
      { label: "Threat Level", value: tier, level: isHighRisk ? "high" : "low" },
      { label: "Approvals", value: `${data.approvalsSummary?.unlimited ?? 0}/${data.approvalsSummary?.total ?? 0}`, level: "medium" },
    ],
    details: data,
  };
};

// --- SUB-COMPONENTS ---
const TigerBadge = ({ children, level }: { children: React.ReactNode; level: string }) => {
  const styles = {
    high: "bg-[#F85B05]/20 text-[#F85B05] border-[#F85B05]/40",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  }[level as "high" | "medium" | "low"] || "bg-zinc-800 text-zinc-400 border-zinc-700";

  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${styles}`}>
      {children}
    </span>
  );
};

export default function FinalDemoPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StandardizedScan | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const chain = useMemo(() => getChain(address), [address]);

  const handleScan = async () => {
    if (!chain) return;
    setLoading(true);
    setResult(null);
    try {
      const endpoint = chain === "SOL" 
        ? `/api/wallet/scan?address=${encodeURIComponent(address.trim())}&deep=true`
        : `/api/scan/eth?address=${encodeURIComponent(address.trim())}&deep=true`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setResult(normalizeData(data, chain));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans selection:bg-[#F85B05] selection:text-black antialiased overflow-x-hidden">
      {/* Background Effect */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,#151515_0%,#050505_100%)] pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F85B05] rounded shadow-[0_0_20px_rgba(248,91,5,0.3)] flex items-center justify-center font-black text-black">I</div>
          <span className="font-bold tracking-tighter text-lg uppercase italic">Interligens <span className="text-[#F85B05]">.</span></span>
        </div>
        <div className="flex gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <span>Security Protocol</span>
          <span className="text-zinc-700">|</span>
          <span>V2.6-Beta</span>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 italic">
            CHECK YOUR <span className="text-[#F85B05] not-italic">EXPOSURE.</span>
          </h1>
          <p className="text-zinc-500 max-w-md mx-auto text-sm">
            Advanced forensic analysis for Solana & Ethereum. <br/>
            Real-time threat detection for the 2026 meta.
          </p>
        </div>

        {/* Search Bar - Fixed Overlap */}
        <div className="max-w-2xl mx-auto mb-20 relative">
          <div className="bg-[#0A0A0A] border border-zinc-800/50 p-2 rounded-2xl flex flex-col md:flex-row gap-2 shadow-2xl backdrop-blur-xl">
            <div className="flex-1 relative group">
              <input
                type="text"
                placeholder="Paste wallet address..." 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-transparent px-4 py-4 text-sm font-mono focus:outline-none placeholder:text-zinc-800"
                onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
              />
              {chain && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2 pointer-events-none">
                   <span className="bg-[#F85B05] text-black text-[9px] font-black px-2 py-1 rounded shadow-lg animate-pulse">
                     {chain} DETECTED
                   </span>
                </div>
              )}
            </div>
            <button 
              onClick={handleScan}
              disabled={!chain || loading}
              className="bg-[#F85B05] hover:bg-[#ff6b1a] disabled:opacity-30 text-black font-black uppercase text-xs px-8 py-4 rounded-xl transition-all active:scale-95"
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="grid md:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Verdict Card */}
            <div className="md:col-span-5 bg-[#0A0A0A] border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-6 right-6">
                <TigerBadge level={result.score > 60 ? "high" : "low"}>{result.tier}</TigerBadge>
              </div>

              {/* Score Ring Dynamic */}
              <div className="relative w-56 h-56 mb-8 mt-4">
                <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                  <circle cx="112" cy="112" r="95" stroke="#111" strokeWidth="12" fill="transparent" />
                  <circle 
                    cx="112" cy="112" r="95" 
                    stroke={result.score > 60 ? "#F85B05" : "#10b981"} 
                    strokeWidth="12" 
                    fill="transparent" 
                    strokeDasharray={596}
                    strokeDashoffset={596 - (596 * result.score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-[1.5s] ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-black italic">{result.score}</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Risk Score</span>
                </div>
              </div>

              <h2 className="text-3xl font-black uppercase tracking-tight mb-2">{result.verdict}</h2>
              <p className="text-zinc-500 text-sm mb-8">{result.recommendation}</p>
              
              <button className="w-full py-4 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                Generate Full Report (PDF)
              </button>
            </div>

            {/* Evidence List */}
            <div className="md:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0A0A0A] border border-zinc-800 rounded-3xl p-8 flex-1">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">On-Chain Evidence</h3>
                  <button onClick={() => setShowRaw(!showRaw)} className="text-[10px] font-bold text-[#F85B05] hover:opacity-70 transition-opacity">
                    {showRaw ? "[ CLOSE RAW ]" : "[ EXPLAIN WHY ]"}
                  </button>
                </div>

                <div className="space-y-4">
                  {result.evidence.map((ev, i) => (
                    <div key={i} className="flex justify-between items-center p-5 bg-[#0D0D0D] border border-zinc-800/50 rounded-2xl hover:border-[#F85B05]/30 transition-colors group">
                      <div>
                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1 tracking-wider">{ev.label}</p>
                        <p className="text-sm font-bold font-mono group-hover:text-white transition-colors">{ev.value}</p>
                      </div>
                      <TigerBadge level={ev.level}>{ev.level}</TigerBadge>
                    </div>
                  ))}
                </div>

                {showRaw && (
                  <div className="mt-8 p-4 bg-black border border-zinc-900 rounded-xl animate-in slide-in-from-top-4">
                    <pre className="text-[10px] font-mono text-zinc-600 overflow-x-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              
              <div className="p-6 border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-[10px] text-zinc-600 uppercase font-bold leading-relaxed tracking-wide">
                  Intelligence Notice: Analysis is based on current block state. Malicious signatures or private pool movements can occur post-scan.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-6 left-0 right-0 text-center z-0 opacity-30">
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600">
          Interligens © 2026 — Distributed Intelligence
        </span>
      </footer>

      <style jsx global>{`
        body { background-color: #050505; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}
