"use client";
import { useEffect } from "react";

export default function WhyThisScore() {
  useEffect(() => {
    window.location.href = "/tigerscore-architecture.html";
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Chargement...</span>
    </div>
  );
}
