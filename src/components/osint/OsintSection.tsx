import { OsintWatchlistCard } from "./OsintWatchlistCard";
import { OsintInsightsCard } from "./OsintInsightsCard";
import type { Insight } from "@/app/api/osint/insights/route";
import type { WatchlistEntry } from "@/lib/osint/watchlist";

async function getWatchlist() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3100";
  const res = await fetch(`${base}/api/osint/watchlist`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json() as Promise<{ count: number; hero: WatchlistEntry[]; all: WatchlistEntry[] }>;
}

async function getInsights() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3100";
  const res = await fetch(`${base}/api/osint/insights`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json() as Promise<{ count: number; insights: Insight[] }>;
}

export async function OsintSection() {
  const [watchlistData, insightsData] = await Promise.all([getWatchlist(), getInsights()]);
  if (!watchlistData || !insightsData) {
    return <div className="text-xs text-zinc-600 py-4">OSINT signals unavailable.</div>;
  }
  const topInsight =
    insightsData.insights.find((i) => i.handle === "Kermitwifhat") ??
    insightsData.insights.find((i) => i.handle === "HSIGMemeCoin") ??
    insightsData.insights[0];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OsintWatchlistCard heroAccounts={watchlistData.hero} allAccounts={watchlistData.all} totalCount={watchlistData.count} />
      {topInsight && <OsintInsightsCard insight={topInsight} />}
    </div>
  );
}
