"use client";

import React, { useState } from "react";

interface EvidencePanelProps {
  data: any;
  chain: "ethereum" | "solana";
}

export default function EvidencePanel({ data, chain }: EvidencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  const hasApprovals = chain === "ethereum" && Array.isArray(data.approvals) && data.approvals.length > 0;
  const hasPrograms = chain === "solana" && Array.isArray(data.programs) && data.programs.length > 0;

  if (!hasApprovals && !hasPrograms) return null;

  return (
    <div className="w-full mt-4 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200">
            {chain === "ethereum" ? "Approvals Risk Summary" : "Program Interactions Summary"}
          </span>
        </div>
        <span className={`text-slate-500 transform transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          {chain === "ethereum" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider">Top Spenders (Deep Scan)</p>
              {data.approvals.map((app: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-900 rounded-lg border border-slate-800 gap-2">
                  <div className="truncate flex-1">
                    <p className="text-xs font-mono text-slate-500 truncate">Token: {app.token}</p>
                    <p className="text-xs font-mono text-slate-500 truncate">Spender: {app.spender}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${
                    app.isUnlimited ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  }`}>
                    {app.isUnlimited ? "Unlimited" : "Standard"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {chain === "solana" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Top Programs</p>
                <span className="text-xs font-bold text-[#F85B05] bg-[#F85B05]/10 px-2 py-1 rounded">
                  {data.unknownProgramsCount || 0} Unknown
                </span>
              </div>
              {data.programs.map((prog: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="truncate w-2/3">
                    <p className="text-sm font-medium text-slate-300">{prog.name || "Program"}</p>
                    <p className="text-xs font-mono text-slate-500 truncate">{prog.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-300">{prog.count}</p>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                      prog.risk === "high" ? "bg-red-500/10 text-red-400" : prog.risk === "medium" ? "bg-[#F85B05]/10 text-[#F85B05]" : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {prog.risk || "low"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
