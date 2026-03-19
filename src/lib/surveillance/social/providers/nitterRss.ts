/**
 * src/lib/surveillance/social/providers/nitterRss.ts
 * Récupère les derniers posts via RSS Nitter
 */

import { SocialProvider, PostRef } from "./types";

const NITTER_BASE = process.env.NITTER_BASE_URL ?? "";

export class NitterRssProvider implements SocialProvider {
  name = "nitter_rss";

  async fetchLatest(handle: string, sincePostId?: string): Promise<PostRef[]> {
    if (!NITTER_BASE) throw new Error("PROVIDER_UNAVAILABLE: NITTER_BASE_URL not set");

    const clean = handle.replace(/^@/, "");
    const url = `${NITTER_BASE}/${clean}/rss`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "INTERLIGENS-monitor/1.0" },
    });

    if (!res.ok) throw new Error(`PROVIDER_UNAVAILABLE: HTTP ${res.status}`);

    const xml = await res.text();
    const items = parseRssItems(xml);

    if (!sincePostId) return items.slice(0, 20);

    const sinceIdx = items.findIndex((i) => i.postId === sincePostId);
    return sinceIdx === -1 ? items.slice(0, 20) : items.slice(0, sinceIdx);
  }
}

function parseRssItems(xml: string): PostRef[] {
  const items: PostRef[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const link = extract(block, "link");
    const pubDate = extract(block, "pubDate");
    const title = extract(block, "title");

    if (!link) continue;

    // Extraire postId depuis l'URL
    const idMatch = link.match(/\/status\/(\d+)/);
    const postId = idMatch ? idMatch[1] : link;

    items.push({
      postId,
      postUrl: normalizeXUrl(link),
      postedAtUtc: pubDate ? new Date(pubDate) : undefined,
      textSnippet: title?.replace(/<[^>]+>/g, "").slice(0, 280),
    });
  }

  return items;
}

function extract(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] ?? m[2])?.trim() : undefined;
}

function normalizeXUrl(url: string): string {
  // Remplacer nitter.net par x.com
  return url.replace(/https?:\/\/[^/]+\//, "https://x.com/");
}
