/**
 * src/lib/surveillance/social/providers/xAuthProvider.ts
 */
import { SocialProvider, PostRef } from "./types";

interface XAccount { authToken: string; ct0: string; }

function getAccounts(): XAccount[] {
  const accounts: XAccount[] = [];
  if (process.env.X_AUTH_TOKEN_1 && process.env.X_CT0_1)
    accounts.push({ authToken: process.env.X_AUTH_TOKEN_1, ct0: process.env.X_CT0_1 });
  if (process.env.X_AUTH_TOKEN_2 && process.env.X_CT0_2)
    accounts.push({ authToken: process.env.X_AUTH_TOKEN_2, ct0: process.env.X_CT0_2 });
  return accounts;
}

let idx = 0;
function getNextAccount(): XAccount | null {
  const accounts = getAccounts();
  if (!accounts.length) return null;
  return accounts[idx++ % accounts.length];
}

export class XAuthProvider implements SocialProvider {
  name = "x_auth";

  async fetchLatest(handle: string, sincePostId?: string): Promise<PostRef[]> {
    const account = getNextAccount();
    if (!account) throw new Error("PROVIDER_UNAVAILABLE: No X accounts configured");
    const clean = handle.replace(/^@/, "");
    const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${clean}?count=20`;
    const headers = {
      "cookie": `auth_token=${account.authToken}; ct0=${account.ct0}`,
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "referer": "https://x.com/",
    };
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 429) throw new Error("RATE_LIMITED");
    if (!res.ok) throw new Error(`X API error: ${res.status}`);
    const html = await res.text();
    return parseEmbedTimeline(html, sincePostId);
  }
}

function parseEmbedTimeline(html: string, sincePostId?: string): PostRef[] {
  const posts: PostRef[] = [];
  const matches = html.matchAll(/"permalink":"\/([^"]+)\/status\/(\d+)"/g);
  const seen = new Set<string>();
  for (const m of matches) {
    const postId = m[2];
    if (seen.has(postId)) continue;
    seen.add(postId);
    posts.push({
      postId,
      postUrl: `https://x.com/${m[1]}/status/${postId}`,
    });
  }
  if (!sincePostId) return posts;
  const sinceIdx = posts.findIndex(p => p.postId === sincePostId);
  return sinceIdx === -1 ? posts : posts.slice(0, sinceIdx);
}
