"use client";
import React, { useEffect, useState } from "react";

export default function ScanSkeleton() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Perceived progress: fast to 85%, then slow
    const steps = [
      { target: 30, delay: 100 },
      { target: 60, delay: 400 },
      { target: 80, delay: 800 },
      { target: 88, delay: 1200 },
      { target: 93, delay: 1500 },
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach(({ target, delay }) => {
      timers.push(setTimeout(() => setProgress(target), delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full animate-in fade-in duration-300">
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-zinc-900 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-[#F85B05] transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }} />
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* LEFT: Score ring skeleton */}
        <div className="lg:col-span-5 flex flex-col items-center gap-6">
          <div className="w-56 h-56 rounded-full bg-zinc-900 animate-pulse border border-zinc-800" />
          <div className="w-32 h-8 rounded-lg bg-zinc-900 animate-pulse" />
          <div className="w-full space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="w-full h-14 rounded-xl bg-zinc-900 animate-pulse border border-zinc-800" />
            ))}
          </div>
        </div>

        {/* RIGHT: Modules skeleton */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 3 mini signal cards */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse border border-zinc-800" />
            ))}
          </div>
          {/* WhatToDoNow skeleton */}
          <div className="w-full h-32 rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
          {/* MarketWeather skeleton */}
          <div className="w-full h-48 rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
          {/* Proofs skeleton */}
          <div className="w-full h-64 rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
        </div>
      </div>
    </div>
  );
}
