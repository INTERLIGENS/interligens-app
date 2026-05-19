"use client";
import { useEffect } from "react";

export default function WhyThisScore() {
  useEffect(() => {
    // The legacy /tigerscore-architecture.html static asset returns 403 in
    // prod, which left this page stuck on "Loading…". Redirect to the live
    // Proof Graph route instead.
    window.location.href = "/en/methodology/proof-graph";
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Loading...</span>
    </div>
  );
}
