/**
 * Founder Intel — RSS ingester.
 *
 * Fetches enabled RSS sources, dedups, scores priority/stars, extracts tags,
 * upserts items, writes a FounderIntelIngestRun. Designed to be called from
 * both the cron route and the manual POST /api/admin/intel/run route.
 */

import crypto from "crypto";
import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import type { IntelCategory, IntelPriority } from "@prisma/client";

const SOURCE_TIMEOUT_MS = 8_000;
const LOCK_WINDOW_MS = 10 * 60 * 1000; // 10 min
const EXCERPT_MAX = 500;

type RssItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  "content:encoded"?: string;
  creator?: string;
  author?: string;
};

const parser: Parser<Record<string, unknown>, RssItem> = new Parser({
  timeout: SOURCE_TIMEOUT_MS,
  headers: {
    "User-Agent": "INTERLIGENS-IntelBot/1.0 (+https://app.interligens.com)",
  },
});

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExcerpt(item: RssItem): string | null {
  const raw = item.contentSnippet ?? item.content ?? item["content:encoded"] ?? "";
  if (!raw) return null;
  const clean = stripHtml(raw);
  if (!clean) return null;
  return clean.length > EXCERPT_MAX ? clean.slice(0, EXCERPT_MAX) : clean;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

function canonicalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const keys = Array.from(u.searchParams.keys());
    for (const k of keys) {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    u.hash = "";
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

function hourBucket(d: Date): string {
  const iso = d.toISOString();
  return iso.slice(0, 13); // YYYY-MM-DDTHH
}

function buildDedupKey(opts: {
  sourceName: string;
  sourceItemId?: string | null;
  canonicalUrl: string | null;
  title: string;
  publishedAt: Date;
}): string {
  if (opts.sourceItemId && opts.sourceItemId.trim()) {
    return sha256(`${opts.sourceName}|${opts.sourceItemId.trim()}`);
  }
  if (opts.canonicalUrl) {
    return sha256(opts.canonicalUrl);
  }
  return sha256(`${opts.sourceName}|${normalizeTitle(opts.title)}|${hourBucket(opts.publishedAt)}`);
}

const HIGH_STRONG = /\b(exploit|drain|stolen|hack|rug|arrested|indicted|charges|fraud|scam)\b/i;
const HIGH_VERY_STRONG = /(million stolen|SEC charges|arrested|indicted|hack)/i;

function computePriority(trustScore: number, title: string, excerpt: string | null): IntelPriority {
  const blob = `${title} ${excerpt ?? ""}`;
  if (trustScore >= 4 && HIGH_STRONG.test(blob)) return "HIGH";
  if (trustScore < 4 && HIGH_VERY_STRONG.test(blob)) return "HIGH";
  return "NORMAL";
}

function computeStarRating(opts: {
  trustScore: number;
  priority: IntelPriority;
  category: IntelCategory;
}): number {
  let base = opts.trustScore;
  if (opts.priority === "HIGH") base += 1;
  if (opts.category === "SCAM" || opts.category === "REGULATORY") base += 0.5;
  return Math.min(5, Math.round(base));
}

const TAG_RULES: Array<{ match: RegExp; tag: string }> = [
  { match: /\b(solana|sol)\b/i, tag: "solana" },
  { match: /\b(ethereum|eth)\b/i, tag: "ethereum" },
  { match: /\bdefi\b/i, tag: "defi" },
  { match: /\b(rug|rug pull)\b/i, tag: "rug-pull" },
  { match: /\b(drain|wallet drain)\b/i, tag: "drain" },
  { match: /\bexploit\b/i, tag: "exploit" },
  { match: /\b(sec|cftc)\b/i, tag: "regulatory" },
  { match: /\b(arrest|indicted)\b/i, tag: "legal" },
  { match: /\b(ai|llm|artificial intelligence)\b/i, tag: "ai" },
  { match: /\b(chainalysis|trm|nansen)\b/i, tag: "competitor" },
];

function extractTags(title: string, excerpt: string | null): string[] {
  const blob = `${title} ${excerpt ?? ""}`;
  const tags = new Set<string>();
  for (const r of TAG_RULES) {
    if (r.match.test(blob)) tags.add(r.tag);
  }
  return Array.from(tags);
}

function parsePublishedAt(item: RssItem): Date {
  if (item.isoDate) {
    const d = new Date(item.isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(to);
        resolve(v);
      },
      (e) => {
        clearTimeout(to);
        reject(e);
      },
    );
  });
}

export type IngestResult = {
  runId: string | null;
  itemsIngested: number;
  errors: string[];
  skipped?: "lock" | null;
};

/**
 * Run a single ingestion pass.
 * Skips when another run is RUNNING and was started <10min ago (lock).
 */
export async function runRssIngest(): Promise<IngestResult> {
  // Lock: skip if any RUNNING run exists within LOCK_WINDOW_MS.
  const recent = await prisma.founderIntelIngestRun.findFirst({
    where: {
      status: "RUNNING",
      startedAt: { gte: new Date(Date.now() - LOCK_WINDOW_MS) },
    },
    orderBy: { startedAt: "desc" },
  });
  if (recent) {
    return { runId: recent.id, itemsIngested: 0, errors: [], skipped: "lock" };
  }

  const sources = await prisma.founderIntelSource.findMany({
    where: { enabled: true, type: "RSS" },
  });

  const run = await prisma.founderIntelIngestRun.create({
    data: { status: "RUNNING", sourceCount: sources.length },
  });

  const errors: string[] = [];
  let itemsIngested = 0;

  const results = await Promise.allSettled(
    sources.map(async (src) => {
      if (!src.url) return { src, feed: null as Awaited<ReturnType<typeof parser.parseURL>> | null };
      const feed = await withTimeout(parser.parseURL(src.url), SOURCE_TIMEOUT_MS);
      return { src, feed };
    }),
  );

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason).slice(0, 300));
      continue;
    }
    const { src, feed } = r.value;
    if (!feed) continue;

    for (const raw of feed.items ?? []) {
      try {
        const item = raw as RssItem;
        const title = (item.title ?? "").trim();
        if (!title) continue;

        const excerpt = extractExcerpt(item);
        const canonicalUrl = canonicalizeUrl(item.link);
        const publishedAt = parsePublishedAt(item);
        const sourceItemId = item.guid?.trim() || null;

        const dedupKey = buildDedupKey({
          sourceName: src.name,
          sourceItemId,
          canonicalUrl,
          title,
          publishedAt,
        });

        const contentHash = sha256(`${src.name}|${normalizeTitle(title)}`);
        const priority = computePriority(src.trustScore, title, excerpt);
        const starRating = computeStarRating({
          trustScore: src.trustScore,
          priority,
          category: src.category,
        });
        const tags = extractTags(title, excerpt);

        const author = item.creator ?? item.author ?? null;
        const url = item.link ?? canonicalUrl ?? "";
        if (!url) continue;

        await prisma.founderIntelItem.upsert({
          where: { dedupKey },
          create: {
            dedupKey,
            title,
            excerpt,
            url,
            canonicalUrl,
            sourceItemId,
            contentHash,
            author,
            source: src.name,
            sourceId: src.id,
            category: src.category,
            priority,
            tags,
            starRating,
            publishedAt,
          },
          update: {
            // Keep rating + flags if item already exists; refresh excerpt only
            // when we didn't have one before.
            excerpt: excerpt ?? undefined,
            contentHash,
            priority,
            starRating,
          },
        });
        itemsIngested++;
      } catch (itemErr) {
        errors.push(`[${src.name}] ${String(itemErr).slice(0, 200)}`);
      }
    }
  }

  await prisma.founderIntelIngestRun.update({
    where: { id: run.id },
    data: {
      status: errors.length > 0 && itemsIngested === 0 ? "FAILED" : "DONE",
      completedAt: new Date(),
      itemsIngested,
      errors,
    },
  });

  return { runId: run.id, itemsIngested, errors, skipped: null };
}
