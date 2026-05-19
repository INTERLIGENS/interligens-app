"use client";
import { useEffect } from "react";

export default function WhyThisScore() {
  useEffect(() => {
    // "WHY THIS SCORE?" opens the interactive TigerScore architecture graph.
    // The static asset is whitelisted by proxy.ts (isBetaExempt + matcher
    // both exempt the .html extension), so it is reachable without the beta
    // cookie. The text version stays at /en/methodology/proof-graph.
    window.location.href = "/tigerscore-architecture.html";
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Loading...</span>
    </div>
  );
}
