/**
 * src/lib/surveillance/social/providers/playwrightProfile.ts
 * Fallback si Nitter indisponible
 */

import { SocialProvider, PostRef } from "./types";

export class PlaywrightProfileProvider implements SocialProvider {
  name = "playwright_profile";

  async fetchLatest(handle: string, sincePostId?: string): Promise<PostRef[]> {
    if (process.env.SOCIAL_PROVIDER_FALLBACK_ENABLED !== "true") {
      throw new Error("PROVIDER_UNAVAILABLE: fallback disabled");
    }

    const { chromium } = await import("playwright");
    const clean = handle.replace(/^@/, "");
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      locale: "en-US",
    });
    const page = await ctx.newPage();

    try {
      await page.goto(`https://x.com/${clean}`, {
        waitUntil: "networkidle",
        timeout: 20_000,
      });

      await page.waitForTimeout(2000);

      const posts = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/status/"]'));
        const seen = new Set<string>();
        const results: { postId: string; postUrl: string; textSnippet?: string }[] = [];

        for (const a of links) {
          const href = (a as HTMLAnchorElement).href;
          const m = href.match(/\/status\/(\d+)/);
          if (!m) continue;
          const postId = m[1];
          if (seen.has(postId)) continue;
          seen.add(postId);

          const article = a.closest("article");
          const text = article?.textContent?.trim().slice(0, 280);

          results.push({
            postId,
            postUrl: `https://x.com${new URL(href).pathname}`,
            textSnippet: text,
          });

          if (results.length >= 10) break;
        }
        return results;
      });

      if (!sincePostId) return posts;
      const sinceIdx = posts.findIndex((p) => p.postId === sincePostId);
      return sinceIdx === -1 ? posts : posts.slice(0, sinceIdx);
    } finally {
      await browser.close();
    }
  }
}
