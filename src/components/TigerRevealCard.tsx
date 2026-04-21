"use client";

import React, { useState, useRef, useEffect } from "react";

function useReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface TigerRevealProps {
  tier: "GREEN" | "ORANGE" | "RED";
  proofs: { label: string; value: string; level: string; riskDescription: string }[];
}

function StaggeredProof({ proof, index }: {
  proof: { label: string; value: string; level: string; riskDescription: string };
  index: number;
}) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = React.useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), reduced ? 0 : index * 120);
    return () => clearTimeout(t);
  }, [index, reduced]);

  return (
    <div
      className="p-5 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl flex justify-between items-center group hover:border-[#F85B05]/30"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : (reduced ? "none" : "translateY(6px)"),
        transition: reduced ? "opacity 100ms" : `opacity 260ms ease-out ${index * 120}ms, transform 260ms ease-out ${index * 120}ms`,
      }}
    >
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-[#F85B05] uppercase tracking-widest mb-1">
          {proof.label}
        </span>
        <span className="text-base font-bold uppercase tracking-tight text-white">
          {proof.value}
        </span>
        <span className="text-[10px] text-zinc-600 font-bold italic mt-1 tracking-tight">
          {proof.riskDescription}
        </span>
      </div>
      <div className={`px-2 py-1 rounded-sm text-[9px] font-black border uppercase ${
        proof.level === "high" ? "border-[#F85B05] text-[#F85B05]"
        : proof.level === "medium" ? "border-yellow-500 text-yellow-500"
        : "border-emerald-500 text-emerald-500"
      }`}>
        {proof.level}
      </div>
    </div>
  );
}

export default function TigerRevealCard({ tier, proofs }: TigerRevealProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = `/tiger/${tier.toLowerCase()}.mp4`;

  const toggleReveal = () => {
    const newState = !isFlipped;
    setIsFlipped(newState);
    if (newState && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFlipped(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div className="relative w-full h-[520px]" style={{ perspective: "1000px" }}>
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 bg-[#0A0A0A] border border-zinc-800 rounded-3xl p-8 flex flex-col shadow-2xl"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any }}
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.3em]">
              Top On-Chain Proofs
            </h3>
            <div className="px-2 py-1 bg-[#F85B05]/10 border border-[#F85B05]/30 text-[#F85B05] text-[9px] font-black rounded uppercase">
              Audit Verified
            </div>
          </div>

          <button
            onClick={toggleReveal}
            className="mb-6 w-full h-14 bg-[#F85B05] rounded-xl flex items-center justify-center gap-3 shadow-[0_0_24px_rgba(248,91,5,0.4)] hover:bg-[#ff6a1a] hover:shadow-[0_0_36px_rgba(248,91,5,0.65)] transition-all duration-200"
          >
            <img
              src="/tiger/analyst.png?v=3"
              alt="Tiger Analyst"
              width={40}
              height={40}
              loading="eager"
              decoding="async"
              className="w-10 h-10 rounded-full object-contain bg-black shrink-0 block"
            />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] leading-none text-black">Ask Tiger Analyst</span>
          </button>

          <div className="space-y-4 flex-1">
            {proofs?.length ? (
              proofs.slice(0, 3).map((proof, i) => (
                <StaggeredProof key={i} proof={proof} index={i} />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-700 font-bold uppercase text-[10px] tracking-widest border border-dashed border-zinc-800 rounded-2xl">
                No forensic data available
              </div>
            )}
          </div>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 bg-black rounded-3xl overflow-hidden border-2 border-[#F85B05]/50 shadow-[0_0_50px_rgba(248,91,5,0.2)]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden" as any,
            transform: "rotateY(180deg)",
          }}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

          <div className="absolute top-6 right-6 flex gap-3">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-xl border border-zinc-800 rounded-xl text-white hover:bg-[#F85B05] transition-all"
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={toggleReveal}
              className="px-5 py-2 bg-black/60 backdrop-blur-xl border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-white hover:bg-red-600 transition-all"
            >
              Back to Data
            </button>
          </div>

          <div className="absolute bottom-8 left-8">
            <p className="text-[10px] font-black text-[#F85B05] uppercase tracking-[0.5em] mb-2">
              Tiger Intelligence
            </p>
            <h4 className="text-3xl font-black italic uppercase text-white tracking-tighter">
              Verdict: {tier}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
