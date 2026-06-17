// ─────────────────────────────────────────────────────────────
// X API v2 Client — Bearer Token auth
// WatcherV2 · INTERLIGENS
// ─────────────────────────────────────────────────────────────

const X_API_BASE = 'https://api.x.com/2';

function getToken(): string | null {
  return process.env.X_BEARER_TOKEN ?? process.env.TWITTER_BEARER_TOKEN ?? null;
}

function headers(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error('X_BEARER_TOKEN not set');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── Billing spend-cap state ──────────────────────────────────
// X bills against a per-cycle SPEND CAP. Once reached, EVERY read returns
// HTTP 403 with body {"title":"SpendCapReached","reset_date":"YYYY-MM-DD",...}
// — NOT a 429, and NOT a not_found. We latch it process-wide so subsequent
// calls short-circuit instead of hammering a blocked API and masquerading as
// "not_found". Resets when the process restarts (and re-probes the live API).

const spendCap: { reached: boolean; resetDate?: string } = { reached: false };

/** True once the X API billing spend cap has been hit in this process. */
export function isSpendCapped(): boolean {
  return spendCap.reached;
}
/** Billing-cycle reset date reported by X (e.g. "2026-06-21"), if known. */
export function spendCapResetDate(): string | undefined {
  return spendCap.resetDate;
}

// ─── Rate-limit aware fetch ───────────────────────────────────

async function xFetch(url: string): Promise<Response | null> {
  // Already known spend-capped this run → skip the call (no point, and avoids
  // re-logging). Callers can disambiguate null via isSpendCapped().
  if (spendCap.reached) return null;

  let res: Response;
  try {
    res = await fetch(url, { headers: headers() });
  } catch (err) {
    console.error(`[xapi] network error: ${err}`);
    return null;
  }

  // Log rate limit state
  const remaining = res.headers.get('x-rate-limit-remaining');
  if (remaining !== null && parseInt(remaining) < 10) {
    console.warn(`[xapi] ⚠️  rate limit remaining: ${remaining}`);
  }

  // Retry once on 429 (transient per-window rate limit)
  if (res.status === 429) {
    console.warn('[xapi] 429 rate limited — waiting 15s then retrying once');
    await sleep(15_000);
    try {
      res = await fetch(url, { headers: headers() });
    } catch (err) {
      console.error(`[xapi] retry network error: ${err}`);
      return null;
    }
  }

  // 403 billing spend-cap — distinct from a normal 403/not_found. Latch + halt.
  if (res.status === 403) {
    let body = '';
    try { body = await res.text(); } catch { /* body unreadable */ }
    if (body.includes('SpendCapReached') || body.includes('/problems/credits')) {
      let resetDate: string | undefined;
      try { resetDate = JSON.parse(body).reset_date as string; } catch { /* non-JSON */ }
      spendCap.reached = true;
      spendCap.resetDate = resetDate;
      // Logged exactly once per process (top short-circuit handles the rest).
      console.error(
        `[xapi] 🛑 SPEND CAP reached — X API billing cap hit; all reads are blocked ` +
          `until ${resetDate ?? 'the next billing cycle'}. Raise the cap in the X developer ` +
          `console to resume immediately. Halting further X API calls this run.`,
      );
      return null;
    }
    console.error(`[xapi] 403 Forbidden — ${url}`);
    return null;
  }

  if (!res.ok) {
    console.error(`[xapi] ${res.status} ${res.statusText} — ${url}`);
    return null;
  }

  return res;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ────────────────────────────────────────────────────

export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

export interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  author_id?: string;
}

// ─── Endpoints ────────────────────────────────────────────────

const USER_FIELDS = 'id,name,username,description,profile_image_url,verified,created_at,public_metrics';
const TWEET_FIELDS = 'id,text,created_at,public_metrics,author_id';

/**
 * Look up a single user by @handle (without the @).
 */
export async function getUserByUsername(username: string): Promise<XUser | null> {
  const url = `${X_API_BASE}/users/by/username/${encodeURIComponent(username)}?user.fields=${USER_FIELDS}`;
  const res = await xFetch(url);
  if (!res) return null;

  const json = await res.json() as { data?: XUser; errors?: unknown[] };
  if (json.errors || !json.data) {
    console.error(`[xapi] getUserByUsername(${username}): API error`, json.errors);
    return null;
  }
  return json.data;
}

/**
 * Get recent tweets for a userId.
 */
export async function getUserTweets(
  userId: string,
  maxResults: number = 10,
): Promise<XTweet[]> {
  const url = `${X_API_BASE}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=${TWEET_FIELDS}`;
  const res = await xFetch(url);
  if (!res) return [];

  const json = await res.json() as { data?: XTweet[]; errors?: unknown[] };
  if (json.errors || !json.data) {
    console.error(`[xapi] getUserTweets(${userId}): API error`, json.errors);
    return [];
  }
  return json.data;
}

/**
 * Get a user's recent tweets across a TIME WINDOW, with pagination.
 *
 * Resume mode for the watcher: unlike getUserTweets (single page, ≤100),
 * this pages through GET /2/users/:id/tweets via pagination_token until the
 * window [startTime, now] is exhausted OR the per-handle cap is reached.
 *
 *  - startTime : ISO-8601, passed as start_time. The API only returns posts
 *                in [start_time, now]; pagination naturally terminates at the
 *                window boundary. Omit → API default (~most recent).
 *  - maxPosts  : hard cap on posts fetched for this handle this run (cost
 *                guard against a hyper-active account). Default 100.
 *  - perPage   : posts per request (X clamps to 5..100). Default 100 = fewest
 *                requests for a given window.
 *
 * Billing is per post returned, so the returned array length == billable
 * posts for this handle. Each page is 1 request (not the $ driver).
 */
export async function getUserTweetsWindow(
  userId: string,
  opts: { startTime?: string; maxPosts?: number; perPage?: number } = {},
): Promise<XTweet[]> {
  const maxPosts = Math.max(1, opts.maxPosts ?? 100);
  const perPage = Math.min(100, Math.max(5, opts.perPage ?? 100));
  const collected: XTweet[] = [];
  let pageToken: string | undefined;

  do {
    const remaining = maxPosts - collected.length;
    if (remaining <= 0) break;
    // X API requires max_results in [5,100]; request at least 5 then trim.
    const reqSize = Math.min(perPage, Math.max(5, remaining));
    const params = new URLSearchParams({
      max_results: String(reqSize),
      "tweet.fields": TWEET_FIELDS,
    });
    if (opts.startTime) params.set("start_time", opts.startTime);
    if (pageToken) params.set("pagination_token", pageToken);

    const res = await xFetch(`${X_API_BASE}/users/${userId}/tweets?${params.toString()}`);
    if (!res) break; // network/HTTP error already logged by xFetch

    const json = (await res.json()) as {
      data?: XTweet[];
      meta?: { next_token?: string };
      errors?: unknown[];
    };
    if (json.errors || !json.data) {
      if (json.errors) console.error(`[xapi] getUserTweetsWindow(${userId}): API error`, json.errors);
      break; // no data (or end of timeline) → stop
    }

    collected.push(...json.data);
    pageToken = json.meta?.next_token;
  } while (pageToken && collected.length < maxPosts);

  // Last page may overshoot the cap → trim to the exact budget.
  return collected.length > maxPosts ? collected.slice(0, maxPosts) : collected;
}

/**
 * Get a user's recent timeline (up to 100) WITH media presence resolved via
 * expansions=attachments.media_keys. Each returned tweet carries hasMedia /
 * photoCount so callers can estimate a chart/media ratio. 1 API call per page.
 */
export async function getUserTimeline(
  userId: string,
  maxResults: number = 100,
): Promise<(XTweet & { hasMedia: boolean; photoCount: number })[]> {
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "id,text,created_at,public_metrics,attachments",
    expansions: "attachments.media_keys",
    "media.fields": "type",
  });
  const url = `${X_API_BASE}/users/${userId}/tweets?${params.toString()}`;
  const res = await xFetch(url);
  if (!res) return [];
  const json = (await res.json()) as {
    data?: (XTweet & { attachments?: { media_keys?: string[] } })[];
    includes?: { media?: { media_key: string; type: string }[] };
    errors?: unknown[];
  };
  if (!json.data) return [];
  const mediaType = new Map((json.includes?.media ?? []).map((m) => [m.media_key, m.type]));
  return json.data.map((t) => {
    const keys = t.attachments?.media_keys ?? [];
    const photoCount = keys.filter((k) => mediaType.get(k) === "photo").length;
    return { ...t, hasMedia: keys.length > 0, photoCount };
  });
}

/**
 * Search recent tweets (last 7 days) by query string.
 */
export async function searchRecentTweets(
  query: string,
  maxResults: number = 10,
): Promise<XTweet[]> {
  const url = `${X_API_BASE}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=${TWEET_FIELDS}`;
  const res = await xFetch(url);
  if (!res) return [];

  const json = await res.json() as { data?: XTweet[]; errors?: unknown[] };
  if (json.errors || !json.data) {
    console.error(`[xapi] searchRecentTweets: API error`, json.errors);
    return [];
  }
  return json.data;
}

/**
 * Search recent tweets (last 7 days) and resolve their authors in the SAME call
 * via expansions=author_id. Returns the tweets plus the deduped author XUser[]
 * (with public_metrics / created_at / verified), and a next_token for paging.
 * Costs 1 API call per page regardless of author count — used by KOL discovery.
 */
export async function searchRecentWithAuthors(
  query: string,
  maxResults: number = 100,
  nextToken?: string,
): Promise<{ tweets: XTweet[]; users: XUser[]; nextToken?: string }> {
  const params = new URLSearchParams({
    query,
    max_results: String(maxResults),
    "tweet.fields": TWEET_FIELDS,
    expansions: "author_id",
    "user.fields": USER_FIELDS,
  });
  if (nextToken) params.set("next_token", nextToken);
  const url = `${X_API_BASE}/tweets/search/recent?${params.toString()}`;
  const res = await xFetch(url);
  if (!res) return { tweets: [], users: [] };

  const json = (await res.json()) as {
    data?: XTweet[];
    includes?: { users?: XUser[] };
    meta?: { next_token?: string };
    errors?: unknown[];
  };
  return {
    tweets: json.data ?? [],
    users: json.includes?.users ?? [],
    nextToken: json.meta?.next_token,
  };
}

/**
 * Look up tweets by id (batched, up to 100 per call) via GET /2/tweets?ids=...
 * Returns the tweets that resolved; missing/deleted/protected ids are simply
 * absent from the result. Used by the Shill Correlation Engine to recover a
 * real created_at (and CA from text) for date-only ShillEvents.
 */
export async function getTweetsByIds(ids: string[]): Promise<XTweet[]> {
  const out: XTweet[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    if (batch.length === 0) continue;
    const url = `${X_API_BASE}/tweets?ids=${batch.join(",")}&tweet.fields=${TWEET_FIELDS}`;
    const res = await xFetch(url);
    if (!res) continue;
    const json = (await res.json()) as { data?: XTweet[]; errors?: unknown[] };
    if (json.data) out.push(...json.data);
  }
  return out;
}

/**
 * Check if the bearer token is configured.
 */
export function hasToken(): boolean {
  return !!getToken();
}
