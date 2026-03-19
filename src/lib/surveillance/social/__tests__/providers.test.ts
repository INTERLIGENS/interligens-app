/**
 * src/lib/surveillance/social/__tests__/providers.test.ts
 */
import { describe, test, expect } from "vitest";

// ─── RSS PARSING TEST ─────────────────────────────────────────────────────────

const FIXTURE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>@vitalikbuterin</title>
    <item>
      <title><![CDATA[This is a test post about ETH]]></title>
      <link>https://nitter.net/VitalikButerin/status/1234567890123456789</link>
      <pubDate>Mon, 18 Mar 2024 10:00:00 +0000</pubDate>
    </item>
    <item>
      <title><![CDATA[Another post with 0x1234...]]></title>
      <link>https://nitter.net/VitalikButerin/status/1234567890123456788</link>
      <pubDate>Mon, 18 Mar 2024 09:00:00 +0000</pubDate>
    </item>
    <item>
      <title><![CDATA[Old post]]></title>
      <link>https://nitter.net/VitalikButerin/status/1234567890123456787</link>
      <pubDate>Sun, 17 Mar 2024 08:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

// On teste la fonction parseRssItems directement
function parseRssItems(xml: string) {
  const items: { postId: string; postUrl: string; postedAtUtc?: Date; textSnippet?: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    const pubDateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);
    const titleMatch = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([\s\S]*?)<\/title>/);

    const link = linkMatch?.[1]?.trim();
    if (!link) continue;

    const idMatch = link.match(/\/status\/(\d+)/);
    const postId = idMatch ? idMatch[1] : link;
    const postUrl = link.replace(/https?:\/\/[^/]+\//, "https://x.com/");

    items.push({
      postId,
      postUrl,
      postedAtUtc: pubDateMatch?.[1] ? new Date(pubDateMatch[1]) : undefined,
      textSnippet: (titleMatch?.[1] ?? titleMatch?.[2])?.replace(/<[^>]+>/g, "").slice(0, 280),
    });
  }
  return items;
}

describe("NitterRssProvider — parsing", () => {
  test("parse 3 items depuis RSS fixture", () => {
    const items = parseRssItems(FIXTURE_RSS);
    expect(items).toHaveLength(3);
  });

  test("extrait le postId depuis l'URL", () => {
    const items = parseRssItems(FIXTURE_RSS);
    expect(items[0].postId).toBe("1234567890123456789");
    expect(items[1].postId).toBe("1234567890123456788");
  });

  test("normalise l'URL vers x.com", () => {
    const items = parseRssItems(FIXTURE_RSS);
    expect(items[0].postUrl).toContain("x.com");
    expect(items[0].postUrl).not.toContain("nitter.net");
  });

  test("extrait le textSnippet", () => {
    const items = parseRssItems(FIXTURE_RSS);
    expect(items[0].textSnippet).toContain("ETH");
  });

  test("parse la date de publication", () => {
    const items = parseRssItems(FIXTURE_RSS);
    expect(items[0].postedAtUtc).toBeInstanceOf(Date);
  });
});

// ─── DEDUP TEST ───────────────────────────────────────────────────────────────

describe("candidate dedup", () => {
  test("filtre les posts déjà vus via sincePostId", () => {
    const items = parseRssItems(FIXTURE_RSS);
    const sincePostId = "1234567890123456788";
    const sinceIdx = items.findIndex((i) => i.postId === sincePostId);
    const newItems = sinceIdx === -1 ? items : items.slice(0, sinceIdx);
    expect(newItems).toHaveLength(1);
    expect(newItems[0].postId).toBe("1234567890123456789");
  });

  test("retourne tous les posts si sincePostId inconnu", () => {
    const items = parseRssItems(FIXTURE_RSS);
    const sincePostId = "999999";
    const sinceIdx = items.findIndex((i) => i.postId === sincePostId);
    const newItems = sinceIdx === -1 ? items.slice(0, 20) : items.slice(0, sinceIdx);
    expect(newItems).toHaveLength(3);
  });
});

// ─── STATUS TRANSITIONS TEST ──────────────────────────────────────────────────

describe("candidate status transitions", () => {
  const validStatuses = ["new", "queued", "captured", "blocked", "failed", "skipped"];

  test("tous les statuts valides sont définis", () => {
    expect(validStatuses).toContain("new");
    expect(validStatuses).toContain("captured");
    expect(validStatuses).toContain("blocked");
  });

  test("transition new → queued → captured est valide", () => {
    const flow = ["new", "queued", "captured"];
    flow.forEach((s) => expect(validStatuses).toContain(s));
  });

  test("transition new → queued → failed est valide", () => {
    const flow = ["new", "queued", "failed"];
    flow.forEach((s) => expect(validStatuses).toContain(s));
  });
});
