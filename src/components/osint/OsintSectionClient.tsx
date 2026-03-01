"use client";

import { useEffect, useState } from "react";
import { OsintWatchlistCard } from "./OsintWatchlistCard";
import { OsintInsightsCard } from "./OsintInsightsCard";
import type { Insight } from "@/app/api/osint/insights/route";
import type { WatchlistEntry } from "@/lib/osint/watchlist";

interface WatchlistData { count: number; hero: WatchlistEntry[]; all: WatchlistEntry[] }
interface InsightsData { count: number; insights: Insight[] }

export function OsintSectionClient() {
  const [watchlist, setWatchlist] = useState<WatchlistData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/osint/watchlist").then((r) => r.json()),
      fetch("/api/osint/insights").then((r) => r.json()),
    ])
      .then(([w, i]) => { setWatchlist(w); setInsights(i); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 animate-pulse">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 h-48" />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 h-48" />
      </div>
    );
  }

  if (!watchlist || !insights) return null;

  const topInsight =
    insights.insights.find((i) => i.handle === "Kermitwifhat") ??
    insights.insights.find((i) => i.handle === "HSIGMemeCoin") ??
    insights.insights[0];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OsintWatchlistCard
        heroAccounts={watchlist.hero}
        allAccounts={watchlist.all}
        totalCount={watchlist.count}
      />
      {topInsight && <OsintInsightsCard insight={topInsight} />}
    </div>
  );
}
