"use client";
import { useEffect } from "react";
import type { WatchlistEntry } from "@/lib/osint/watchlist";

const CATEGORY_LABEL: Record<string, string> = { CA_promoter: "CA Promoter", cta_pusher: "CTA Pusher", domain_risk: "Domain Risk", narrative_actor: "Narrative Actor", generic: "General" };
const CATEGORY_BADGE: Record<string, string> = { CA_promoter: "bg-amber-500/10 text-amber-400", cta_pusher: "bg-red-500/10 text-red-400", domain_risk: "bg-orange-500/10 text-orange-400", narrative_actor: "bg-blue-500/10 text-blue-400", generic: "bg-zinc-500/10 text-zinc-400" };

interface Props { open: boolean; onClose: () => void; accounts: WatchlistEntry[]; }

export function WatchlistModal({ open, onClose, accounts }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">OSINT Watchlist — All Accounts</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{accounts.length} accounts tracked · Public signals only</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors text-lg leading-none" aria-label="Close">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-1/4">Handle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-1/4">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Why Tracked</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((entry, i) => (
                <tr key={entry.handle} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${i % 2 === 0 ? "" : "bg-zinc-800/10"}`}>
                  <td className="px-5 py-3">
                    <a href={`https://x.com/${entry.handle}`} target="_blank" rel="noopener noreferrer" className="text-zinc-200 hover:text-white font-mono text-xs">@{entry.handle}</a>
                    {entry.hero && <span className="ml-2 text-xs px-1 py-0.5 rounded bg-zinc-700/60 text-zinc-500">hero</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[entry.category] ?? CATEGORY_BADGE.generic}`}>
                      {CATEGORY_LABEL[entry.category] ?? entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{entry.whyTracked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-zinc-800 text-xs text-zinc-600">Observed patterns only — no labels, no defamatory claims.</div>
      </div>
    </div>
  );
}
