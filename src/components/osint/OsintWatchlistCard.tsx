"use client";
import { useState } from "react";
import { WatchlistModal } from "./WatchlistModal";
import type { WatchlistEntry } from "@/lib/osint/watchlist";

const CATEGORY_COLORS: Record<string, string> = {
  CA_promoter: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  cta_pusher: "bg-red-500/10 text-red-400 border border-red-500/20",
  domain_risk: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  narrative_actor: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  generic: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
};

interface Props { heroAccounts: WatchlistEntry[]; allAccounts: WatchlistEntry[]; totalCount: number; }

export function OsintWatchlistCard({ heroAccounts, allAccounts, totalCount }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-semibold text-zinc-100 tracking-wide">OSINT Watchlist</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 font-mono">Public X Signals</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              We monitor public signals (CA, links, CTAs, narrative spikes).{" "}
              <span className="text-zinc-400">We don&apos;t label people.</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-zinc-500">Tracking</div>
            <div className="text-sm font-semibold text-zinc-200">{totalCount} accounts</div>
            <div className="text-xs text-zinc-600 mt-0.5">Refresh: 10–30 min (demo)</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {heroAccounts.map((entry) => (
            <a key={entry.handle} href={`https://x.com/${entry.handle}`} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.generic}`}>
              <span className="opacity-60">@</span>{entry.handle}
            </a>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Demo mode — fixtures
          </div>
          <button onClick={() => setModalOpen(true)} className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors underline underline-offset-2">
            View all ({totalCount}) →
          </button>
        </div>
      </div>
      <WatchlistModal open={modalOpen} onClose={() => setModalOpen(false)} accounts={allAccounts} />
    </>
  );
}
