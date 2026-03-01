"use client";
import { useState } from "react";
import type { DemoScenario } from "@/lib/demo/presets";

interface QuickDemoBarProps {
  locale: "en" | "fr";
  selectedScenario: DemoScenario | null;
  storyline: string | null;
  onSelectScenario: (scenario: DemoScenario) => void;
  shareUrl: string;
}

const CHIP_LABELS = {
  en: { green: "✅ Safe", orange: "⚠️ Warning", red: "🚨 Scam", copy: "Copy link", copied: "Copied!" },
  fr: { green: "✅ Sûr", orange: "⚠️ Attention", red: "🚨 Arnaque", copy: "Copier le lien", copied: "Copié !" },
};

const CHIP_STYLES: Record<DemoScenario, string> = {
  green:  "border-emerald-500/60 text-emerald-400 hover:border-emerald-400 hover:text-white",
  orange: "border-yellow-500/60 text-yellow-400 hover:border-yellow-400 hover:text-white",
  red:    "border-[#F85B05]/60 text-[#F85B05] hover:border-[#F85B05] hover:text-white",
};

const CHIP_ACTIVE: Record<DemoScenario, string> = {
  green:  "border-emerald-400 text-white bg-emerald-500/10",
  orange: "border-yellow-400 text-white bg-yellow-500/10",
  red:    "border-[#F85B05] text-white bg-[#F85B05]/10",
};

export default function QuickDemoBar({
  locale, selectedScenario, storyline, onSelectScenario, shareUrl,
}: QuickDemoBarProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const t = CHIP_LABELS[locale];
  const scenarios: DemoScenario[] = ["green", "orange", "red"];

  const handleCopy = async () => {
    const url = typeof window !== "undefined" ? window.location.href : shareUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowFallback(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      <div className="flex justify-center gap-3 flex-wrap items-center">
        {scenarios.map((s) => {
          const isActive = selectedScenario === s;
          return (
            <button
              key={s}
              onClick={() => onSelectScenario(s)}
              className={`px-4 py-2 rounded-full border text-[11px] font-black uppercase tracking-widest transition-all ${
                isActive ? CHIP_ACTIVE[s] : `${CHIP_STYLES[s]} border-zinc-700 text-zinc-400`
              }`}
            >
              {t[s]}
            </button>
          );
        })}

        <button
          onClick={handleCopy}
          className="px-3 py-2 rounded-full border border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-zinc-400 hover:text-white transition-all"
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>

      {showFallback && (
        <input
          readOnly
          value={typeof window !== "undefined" ? window.location.href : shareUrl}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-400 font-mono"
          onFocus={e => e.target.select()}
        />
      )}

      {storyline && (
        <p className="text-[11px] text-zinc-500 italic font-medium tracking-wide text-center max-w-md transition-opacity duration-300">
          <span className="text-[#F85B05] mr-1">›</span>{storyline}
        </p>
      )}
    </div>
  );
}
