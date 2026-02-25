"use client";

import React, { useMemo, useState } from "react";

export default function V3Addon({ result, chain }: { result: any; chain: "SOL" | "ETH" }) {
  const [open, setOpen] = useState(false);

  // Minimal, non-mock: build a stable "report hash" placeholder from address+score
  const reportHash = useMemo(() => {
    const addr = (result?.address || result?.mint || "").toString();
    const score = (result?.score ?? result?.risk?.score ?? 0).toString();
    const s = `${chain}:${addr}:${score}`;
    // lightweight hash (not cryptographic) just for UI demo
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `uihash:${h.toString(16)}`;
  }, [result, chain]);

  const cluster = useMemo(() => {
    // ETH: show approvalsSummary
    if (chain === "ETH") {
      const a = result?.approvalsSummary || {};
      return {
        title: "Approval / Exposure Cluster",
        source: a?.topSpenders?.[0] ? `Top spender: ${a.topSpenders[0]}` : "No top spender detected",
        linked: a?.total ?? 0,
        tags: [
          a?.unlimited ? "Unlimited approvals present" : "No unlimited approvals",
          (a?.total ?? 0) > 8 ? "High exposure surface" : "Normal exposure",
        ],
      };
    }

    // SOL: show programsSummary
    const p = result?.programsSummary || {};
    return {
      title: "Program Interaction Cluster",
      source: (p?.topPrograms?.[0]?.id) ? `Top program: ${p.topPrograms[0].id}` : "No dominant program detected",
      linked: p?.unknownCount ?? (result?.unknownProgramsCount ?? 0),
      tags: [
        (p?.unknownCount ?? 0) > 0 ? "Unknown programs hit" : "Only known programs",
        (result?.summary?.txCount ?? 0) < 5 ? "Low history" : "Normal history",
      ],
    };
  }, [result, chain]);

  const exportPdf = () => {
    // UI-only for now: later we plug a real /api/report/pdf
    alert(`PDF export (demo)\n${reportHash}\nChain: ${chain}`);
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-between items-center bg-zinc-900/30 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Report Hash</span>
          <code className="text-[10px] text-[#F85B05] font-mono">{reportHash}</code>
        </div>
        <div className="flex gap-4">
          <button onClick={exportPdf} className="text-[10px] font-black uppercase text-white hover:text-[#F85B05] transition-colors">
            Export PDF
          </button>
          <button className="text-[10px] font-black uppercase text-white hover:text-[#F85B05] transition-colors">
            Share Link
          </button>
        </div>
      </div>

      <div className="bg-[#0A0A0A] border border-zinc-800 p-8 rounded-3xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[11px] font-black uppercase text-[#F85B05] tracking-[0.2em]">{cluster.title}</h3>
          <button onClick={() => setOpen(!open)} className="text-[10px] font-bold underline">
            {open ? "Hide" : "Explain"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-zinc-900/20 border border-zinc-800 rounded-2xl">
            <span className="text-[9px] font-black text-zinc-600 uppercase block mb-1">Key signal</span>
            <span className="text-xs font-bold text-white break-words">{cluster.source}</span>
          </div>
          <div className="p-5 bg-zinc-900/20 border border-zinc-800 rounded-2xl">
            <span className="text-[9px] font-black text-zinc-600 uppercase block mb-1">Linked count</span>
            <span className="text-sm font-bold text-white">{cluster.linked}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {cluster.tags.map((t: string, i: number) => (
            <span key={i} className="px-2 py-1 rounded border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-900/30">
              {t}
            </span>
          ))}
        </div>

        {open && (
          <div className="mt-6 p-4 bg-black border border-zinc-900 rounded-xl">
            <p className="text-[10px] text-zinc-500 font-medium leading-relaxed italic">
              This block is BA-friendly: it explains the strongest *measurable* signals behind the score without claims, only facts from scan summaries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
