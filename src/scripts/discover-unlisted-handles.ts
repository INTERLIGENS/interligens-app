/**
 * src/scripts/discover-unlisted-handles.ts
 * Watcher Discovery — surface @handles frequently mentioned by the KOLs we
 * already monitor, but that are NOT yet in the KolProfile table.
 *
 * Source: SocialPostCandidate.rawText (captured tweets). Each candidate is tied
 * to a referring KOL via influencerId -> Influencer.handle.
 *
 * Ranking per mentioned handle:
 *   1. total mention count across all captured tweets
 *   2. number of distinct referring KOLs
 *   3. recency (last mention date)
 *
 * Read-only. Writes a markdown table of the top 50 to:
 *   /tmp/unlisted-handles-2026-06-12.md
 *
 * Usage:
 *   pnpm tsx -r dotenv/config src/scripts/discover-unlisted-handles.ts
 */

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const OUT = "/tmp/unlisted-handles-2026-06-12.md";
const TOP_N = 50;
const MENTION_RE = /@([A-Za-z0-9_]{1,15})/g;

type Agg = {
  display: string; // representative original casing
  mentionCount: number;
  referrers: Set<string>; // distinct referring influencerId
  lastSeen: Date | null;
};

async function main() {
  // Exclusion set: handles already tracked in KolProfile (case-insensitive).
  const kols = await prisma.kolProfile.findMany({ select: { handle: true } });
  const known = new Set(kols.map((k) => k.handle.toLowerCase()));
  console.log(`[discover] ${known.size} handles already in KolProfile (exclusion set)`);

  // influencerId -> referring KOL handle (for self-mention filtering + labelling).
  const influencers = await prisma.influencer.findMany({ select: { id: true, handle: true } });
  const infHandle = new Map(influencers.map((i) => [i.id, i.handle.toLowerCase()]));

  const candidates = await prisma.socialPostCandidate.findMany({
    where: { rawText: { not: null } },
    select: { rawText: true, influencerId: true, postedAtUtc: true, discoveredAtUtc: true },
  });
  console.log(`[discover] scanning ${candidates.length} captured posts with rawText`);

  const agg = new Map<string, Agg>();

  for (const c of candidates) {
    const text = c.rawText ?? "";
    const when = c.postedAtUtc ?? c.discoveredAtUtc ?? null;
    const referrer = c.influencerId;
    const referrerHandle = infHandle.get(referrer);

    const seenInThisPost = new Set<string>(); // de-dup repeated mentions within one tweet
    let m: RegExpExecArray | null;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(text)) !== null) {
      const raw = m[1];
      const key = raw.toLowerCase();
      if (seenInThisPost.has(key)) continue;
      seenInThisPost.add(key);

      if (known.has(key)) continue; // already tracked
      if (referrerHandle && key === referrerHandle) continue; // self-mention

      let a = agg.get(key);
      if (!a) {
        a = { display: raw, mentionCount: 0, referrers: new Set(), lastSeen: null };
        agg.set(key, a);
      }
      a.mentionCount += 1;
      a.referrers.add(referrer);
      if (when && (!a.lastSeen || when > a.lastSeen)) a.lastSeen = when;
    }
  }

  const ranked = [...agg.values()].sort((x, y) => {
    if (y.mentionCount !== x.mentionCount) return y.mentionCount - x.mentionCount;
    if (y.referrers.size !== x.referrers.size) return y.referrers.size - x.referrers.size;
    const yt = y.lastSeen?.getTime() ?? 0;
    const xt = x.lastSeen?.getTime() ?? 0;
    return yt - xt;
  });

  const top = ranked.slice(0, TOP_N);

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
  const lines: string[] = [];
  lines.push("# Unlisted but frequently-mentioned handles");
  lines.push("");
  lines.push("Source: `SocialPostCandidate.rawText` @mentions by currently-monitored KOLs.");
  lines.push(`Generated: 2026-06-12 · ${candidates.length} posts scanned · ${agg.size} distinct unlisted handles found · showing top ${top.length}.`);
  lines.push("Excludes handles already in KolProfile and self-mentions.");
  lines.push("");
  lines.push("| # | handle | mention_count | distinct_referring_kols | last_seen |");
  lines.push("|---|--------|---------------|-------------------------|-----------|");
  top.forEach((a, i) => {
    lines.push(`| ${i + 1} | @${a.display} | ${a.mentionCount} | ${a.referrers.size} | ${fmtDate(a.lastSeen)} |`);
  });
  lines.push("");

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`[discover] wrote ${OUT}`);
  console.log(`[discover] distinct unlisted handles: ${agg.size} | top ${top.length} written`);
  console.log("[discover] top 10 preview:");
  top.slice(0, 10).forEach((a, i) =>
    console.log(`  ${i + 1}. @${a.display} — ${a.mentionCount} mentions, ${a.referrers.size} KOLs, last ${fmtDate(a.lastSeen)}`),
  );
}

main()
  .catch((e) => {
    console.error("[discover] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
