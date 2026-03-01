"use client";
import type { Insight } from "@/app/api/osint/insights/route";

const SIGNAL_TAG: Record<string, { label: string; className: string }> = {
  ctaDangerous: { label: "CTA Dangerous", className: "bg-red-500/10 text-red-400 border border-red-500/20" },
  domainRisk: { label: "pump.fun / Domain", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
  caDetected: { label: "CA Detected", className: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  narrativeSpike: { label: "Narrative Spike", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
};

export function OsintInsightsCard({ insight }: { insight: Insight }) {
  const activeSignals = Object.entries(insight.signals).filter(([, v]) => v === true);
  const visibleProofs = insight.proofUrls.slice(0, 3);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Live Proof → Corroboration</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <a href={`https://x.com/${insight.handle}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-zinc-100 hover:text-white">
            @{insight.handle}
          </a>
          {activeSignals.map(([key]) => {
            const tag = SIGNAL_TAG[key];
            if (!tag) return null;
            return <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tag.className}`}>{tag.label}</span>;
          })}
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-prose">{insight.summary}</p>
      </div>
      {visibleProofs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Proof Links</div>
          <ul className="space-y-1">
            {visibleProofs.map((url, i) => (
              <li key={url} className="flex items-start gap-2">
                <span className="text-zinc-700 text-xs mt-0.5 shrink-0 font-mono">[{i + 1}]</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-100 break-all underline underline-offset-2 decoration-zinc-700 hover:decoration-zinc-400">
                  {url.replace("https://x.com/", "x.com/")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="pt-1 border-t border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-700">Observed patterns · no labels</span>
        <span className="text-xs text-zinc-700 font-mono">{new Date(insight.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
