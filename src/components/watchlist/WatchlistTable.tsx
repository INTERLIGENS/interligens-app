"use client";
import { DEMO_WATCHLIST, type WatchCategory } from "@/lib/osint/watchlist";

const CATEGORY_LABEL: Record<WatchCategory, string> = {
  CA_promoter: "CA Promoter", cta_pusher: "CTA Promoter",
  domain_risk: "Domain Risk", narrative_actor: "Narrative", generic: "General",
};
const CATEGORY_COLOR: Record<WatchCategory, string> = {
  CA_promoter: "text-amber-400 bg-amber-500/10", cta_pusher: "text-red-400 bg-red-500/10",
  domain_risk: "text-orange-400 bg-orange-500/10", narrative_actor: "text-blue-400 bg-blue-500/10",
  generic: "text-zinc-400 bg-zinc-500/10",
};

function LockIcon() {
  return (
    <span title="Unlocks when X API ingestion is enabled."
      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800/80 border border-zinc-700/40 cursor-default select-none">
      <span className="text-zinc-600 text-[10px]">&#x1F512;</span>
    </span>
  );
}

const sorted = [...DEMO_WATCHLIST].sort((a, b) => {
  if (a.isWatched !== b.isWatched) return a.isWatched ? -1 : 1;
  if (b.sortRank !== a.sortRank) return b.sortRank - a.sortRank;
  return a.displayName.localeCompare(b.displayName);
});

export function WatchlistTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            <th className="text-left px-5 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Handle</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">TrustScore</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Signals</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Evidence</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => (
            <tr key={entry.handle}
              className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/20 ${i % 2 === 0 ? "bg-zinc-900/20" : ""}`}>
              <td className="px-5 py-3.5">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1 shrink-0 w-0.5 h-4 rounded-full ${entry.isWatched ? "bg-[#F85B05]/70" : "bg-zinc-700/40"}`} />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-100">{entry.displayName}</span>
                      {entry.isWatched && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F85B05]/10 text-[#F85B05] font-bold border border-[#F85B05]/20">watched</span>
                      )}
                    </div>
                    <a href={`https://x.com/${entry.handle}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-zinc-600 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded hover:text-zinc-400 transition-colors">
                      @{entry.handle}<span className="opacity-50 ml-0.5">&#x2197;</span>
                    </a>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLOR[entry.category]}`}>
                  {CATEGORY_LABEL[entry.category]}
                </span>
              </td>
              <td className="px-4 py-3.5"><LockIcon /></td>
              <td className="px-4 py-3.5"><LockIcon /></td>
              <td className="px-4 py-3.5"><LockIcon /></td>
              <td className="px-4 py-3.5">
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800/60 text-zinc-500 border border-zinc-700/30">Demo</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
