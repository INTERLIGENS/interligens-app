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

// ─── Rate-limit aware fetch ───────────────────────────────────

async function xFetch(url: string): Promise<Response | null> {
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

  // Retry once on 429
  if (res.status === 429) {
    console.warn('[xapi] 429 rate limited — waiting 15s then retrying once');
    await sleep(15_000);
    try {
      res = await fetch(url, { headers: headers() });
    } catch (err) {
      console.error(`[xapi] retry network error: ${err}`);
      return null;
    }
    if (!res.ok) {
      console.error(`[xapi] retry failed: ${res.status}`);
      return null;
    }
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

const USER_FIELDS = 'id,name,username,description,created_at,public_metrics';
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
 * Check if the bearer token is configured.
 */
export function hasToken(): boolean {
  return !!getToken();
}
