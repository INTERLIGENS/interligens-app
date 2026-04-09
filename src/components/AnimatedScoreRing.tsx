"use client";
import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface AnimatedScoreRingProps {
  score: number;
  tier: "GREEN" | "ORANGE" | "RED";
  color: string;
  duration?: number;
}

export default function AnimatedScoreRing({ score, tier, color, duration = 900 }: AnimatedScoreRingProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prefersReduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  useEffect(() => {
    // Cancel any previous RAF
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    if (prefersReduced) {
      setAnimatedScore(clampedScore);
      return;
    }

    const startTime = performance.now();
    const animate = (ts: number) => {
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / duration, 1);
      setAnimatedScore(easeOutCubic(t) * clampedScore);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [clampedScore, duration, prefersReduced]);

  const r = 100;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * animatedScore) / 100;

  return (
    <div className="relative w-56 h-56 mb-4 mt-4 group-hover:scale-105 transition-transform duration-500">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 224 224">
        <circle cx="112" cy="112" r={r} stroke="#111" strokeWidth="12" fill="transparent" />
        <circle
          cx="112" cy="112" r={r}
          stroke={color} strokeWidth="14" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-7xl font-black italic leading-none">{Math.round(animatedScore)}</span>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mt-2">TigerScore</span>
      </div>
    </div>
  );
}
