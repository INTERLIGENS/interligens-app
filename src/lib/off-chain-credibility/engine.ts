// src/lib/off-chain-credibility/engine.ts

export type CredBand = "VERY_LOW" | "LOW" | "MIXED" | "GOOD" | "STRONG";
export type SignalStatus = "RED" | "AMBER" | "GREEN" | "NEUTRAL";

export interface OffChainInput {
  websiteUrl?: string;
  githubUrl?: string;
  twitterHandle?: string;
  telegramUrl?: string;
  whitepaperUrl?: string;
  projectName?: string;
  tokenMint?: string;
  _fetchFn?: typeof fetch;
}

export interface CredSignal {
  id: string;
  label_en: string;
  label_fr: string;
  score: number;
  max_score: number;
  status: SignalStatus;
}

export interface OffChainResult {
  score: number;
  band: CredBand;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  tiger_modifier: number;
  signals: CredSignal[];
  summary_en: string;
  summary_fr: string;
  computed_at: Date;
  cache_until: Date;
  domainAgeDays?: number | null;
}

// ── In-memory cache (TTL 24h) ─────────────────────────────────────────────────

const CACHE = new Map<string, { result: OffChainResult; expiresAt: number }>();
const TTL_MS = 24 * 3_600_000;

function cacheKey(input: OffChainInput): string {
  return `${input.websiteUrl ?? ""}|${input.tokenMint ?? ""}|${input.projectName ?? ""}`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function statusFromRatio(score: number, max: number): SignalStatus {
  const r = score / max;
  if (r >= 0.75) return "GREEN";
  if (r >= 0.4)  return "AMBER";
  if (r > 0)     return "AMBER";
  return "RED";
}

function neutral(max: number): number {
  return Math.round(max * 0.5);
}

// ── Signal 1 — Website completeness (max 20) ──────────────────────────────────

const SITE_TERMS = [
  "whitepaper", "litepaper", "docs", "documentation", "audit",
  "team", "about", "contact", "privacy", "terms",
  "github", "twitter", "telegram", "roadmap",
];

async function scoreWebsite(url: string, fetchFn: typeof fetch): Promise<number> {
  const res = await fetchFn(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; INTERLIGENS-Bot/1.0)" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) return 0;
  const html = (await res.text()).toLowerCase();
  const hits = SITE_TERMS.filter((t) => html.includes(t)).length;
  if (hits >= 8) return 20;
  if (hits >= 6) return 16;
  if (hits >= 4) return 12;
  if (hits >= 2) return 7;
  if (hits >= 1) return 3;
  return 0;
}

// ── Signal 2 — GitHub reality (max 18) ───────────────────────────────────────

const GH_REGEX = /github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/g;

function extractGithubRepoPath(html: string, provided?: string): string | null {
  if (provided) {
    const m = provided.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    return m ? m[1] : null;
  }
  const m = html.match(GH_REGEX);
  if (!m) return null;
  const match = m[0].match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
  return match ? match[1] : null;
}

async function scoreGithub(
  homepageHtml: string,
  githubUrl: string | undefined,
  fetchFn: typeof fetch,
): Promise<number> {
  const repoPath = extractGithubRepoPath(homepageHtml, githubUrl);
  if (!repoPath) return 0;
  const res = await fetchFn(`https://api.github.com/repos/${repoPath}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "INTERLIGENS-Bot" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as {
    size?: number;
    pushed_at?: string;
    stargazers_count?: number;
    forks_count?: number;
  };
  if (!data.size || data.size === 0) return 4;
  const pushedMs = data.pushed_at ? Date.now() - new Date(data.pushed_at).getTime() : Infinity;
  const pushedDays = pushedMs / 86_400_000;
  const stars = data.stargazers_count ?? 0;
  if (pushedDays < 30 && stars > 5)  return 18;
  if (pushedDays < 90)               return 14;
  if (pushedDays < 365)              return 10;
  return 7;
}

// ── Signal 3 — Audit public (max 16) — PURE ──────────────────────────────────

const AUDIT_FIRMS = [
  "certik", "halborn", "trailofbits", "trail of bits",
  "openzeppelin", "quantstamp", "peckshield", "slowmist", "hacken",
];

function scoreAudit(html: string): number {
  const lower = html.toLowerCase();
  const found = AUDIT_FIRMS.some((firm) => lower.includes(firm));
  return found ? 16 : 0;
}

// ── Signal 4 — Domain age (max 14) — RDAP IANA ───────────────────────────────

async function scoreDomainAge(domain: string, fetchFn: typeof fetch): Promise<number> {
  const r = await fetchFn(`https://rdap.iana.org/domain/${encodeURIComponent(domain)}`, {
    headers: { Accept: "application/rdap+json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!r.ok) return neutral(14);
  const j = (await r.json()) as { events?: Array<{ eventAction: string; eventDate: string }> };
  const reg = (j.events ?? []).find(
    (e) => e.eventAction === "registration" || e.eventAction === "last changed",
  );
  if (!reg) return neutral(14);
  const regDate = new Date(reg.eventDate);
  const ageDays = (Date.now() - regDate.getTime()) / 86_400_000;
  if (ageDays < 14)  return 0;
  if (ageDays < 30)  return 3;
  if (ageDays < 90)  return 7;
  if (ageDays < 365) return 11;
  return 14;
}

// ── Signal 5 — Twitter/X age (max 10) — Wayback Machine ──────────────────────

const TW_REGEX = /(?:twitter|x)\.com\/([a-zA-Z0-9_]{1,30})(?:[^a-zA-Z0-9_]|$)/;

async function scoreTwitterAge(
  homepageHtml: string,
  twitterHandle: string | undefined,
  fetchFn: typeof fetch,
): Promise<number> {
  let handle = twitterHandle;
  if (!handle) {
    const m = homepageHtml.match(TW_REGEX);
    handle = m ? m[1] : undefined;
  }
  if (!handle || ["home", "intent", "share", "login"].includes(handle.toLowerCase())) {
    return 5; // neutral — not detectable
  }
  const res = await fetchFn(
    `https://archive.org/wayback/available?url=twitter.com/${encodeURIComponent(handle)}`,
    { signal: AbortSignal.timeout(5_000) },
  );
  if (!res.ok) return 5;
  const data = (await res.json()) as {
    archived_snapshots?: { closest?: { timestamp?: string; available?: boolean } };
  };
  const ts = data.archived_snapshots?.closest?.timestamp;
  if (!ts || !data.archived_snapshots?.closest?.available) return 3;
  // Format: YYYYMMDDHHMMSS
  const year  = parseInt(ts.slice(0, 4), 10);
  const month = parseInt(ts.slice(4, 6), 10) - 1;
  const day   = parseInt(ts.slice(6, 8), 10);
  const oldest = new Date(year, month, day);
  const ageDays = (Date.now() - oldest.getTime()) / 86_400_000;
  if (ageDays < 30)  return 0;
  if (ageDays < 90)  return 3;
  if (ageDays < 365) return 6;
  return 10;
}

// ── Signal 6 — Whitepaper presence (max 8) ───────────────────────────────────

const WP_PATTERN = /(?:whitepaper|litepaper|\.pdf|\/docs\/|\/documentation\/)/i;

async function scoreWhitepaper(
  homepageHtml: string,
  whitepaperUrl: string | undefined,
  fetchFn: typeof fetch,
): Promise<number> {
  const url = whitepaperUrl ?? (() => {
    const m = homepageHtml.match(/href=["']([^"']*(?:whitepaper|litepaper|\.pdf)[^"']*)["']/i);
    return m ? m[1] : null;
  })();
  if (!url) {
    return WP_PATTERN.test(homepageHtml) ? 3 : 0;
  }
  try {
    const res = await fetchFn(url.startsWith("http") ? url : url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok ? 8 : 1;
  } catch {
    return 1;
  }
}

// ── Signal 7 — Telegram coherence (max 8) ────────────────────────────────────

const TG_REGEX = /t\.me\/([a-zA-Z0-9_]{5,32})/;

async function scoreTelegram(
  homepageHtml: string,
  telegramUrl: string | undefined,
  fetchFn: typeof fetch,
): Promise<number> {
  const link = telegramUrl ?? (() => {
    const m = homepageHtml.match(/href=["']([^"']*t\.me\/[^"']*)["']/);
    return m ? m[1] : null;
  })();
  if (!link) return 3; // neutral — not listed
  const handleMatch = (telegramUrl ?? link).match(TG_REGEX);
  if (!handleMatch) return 3;
  try {
    const res = await fetchFn(`https://t.me/${handleMatch[1]}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return 2;
    const html = (await res.text()).toLowerCase();
    // Heuristic: presence of "members" in TG page = public channel
    return html.includes("member") ? 8 : 6;
  } catch {
    return 3; // link found but unreachable — neutral
  }
}

// ── Signal 8 — SSL sanity (max 6) ────────────────────────────────────────────

async function scoreSsl(url: string, fetchFn: typeof fetch): Promise<number> {
  if (!url.startsWith("https://")) return 0;
  try {
    const res = await fetchFn(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return 2;
    const hsts = res.headers.get("Strict-Transport-Security");
    return hsts ? 6 : 4;
  } catch {
    return 2;
  }
}

// ── Band + summary ────────────────────────────────────────────────────────────

function scoreToBand(score: number): CredBand {
  if (score <= 20) return "VERY_LOW";
  if (score <= 40) return "LOW";
  if (score <= 60) return "MIXED";
  if (score <= 80) return "GOOD";
  return "STRONG";
}

export function computeTigerModifier(score: number): number {
  if (score <= 20) return 8;
  if (score <= 40) return 4;
  if (score <= 60) return 0;
  if (score <= 80) return -3;
  return -5;
}

function summaryEn(score: number): string {
  if (score <= 20) return "This project shows no credible infrastructure.";
  if (score <= 40) return "This project has minimal online presence. Verify claims independently.";
  if (score <= 60) return "This project has a basic online presence. Some signals are missing.";
  if (score <= 80) return "This project shows credible infrastructure. A few areas could be improved.";
  return "This project shows strong credible infrastructure across all signals.";
}

function summaryFr(score: number): string {
  if (score <= 20) return "Ce projet ne présente aucune infrastructure crédible.";
  if (score <= 40) return "Ce projet a une présence en ligne minimale. Vérifiez les claims indépendamment.";
  if (score <= 60) return "Ce projet a une présence en ligne basique. Certains signaux sont absents.";
  if (score <= 80) return "Ce projet présente une infrastructure crédible. Quelques points peuvent être améliorés.";
  return "Ce projet présente une infrastructure solide sur tous les signaux.";
}

function confidence(signals: CredSignal[], websiteOk: boolean): "LOW" | "MEDIUM" | "HIGH" {
  const neutralCount = signals.filter((s) => s.status === "NEUTRAL").length;
  if (!websiteOk || neutralCount >= 4) return "LOW";
  if (neutralCount >= 2)              return "MEDIUM";
  return "HIGH";
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function computeOffChainCredibility(
  input: OffChainInput,
): Promise<OffChainResult> {
  const key = cacheKey(input);
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const fetchFn = input._fetchFn ?? fetch;
  const url     = input.websiteUrl;
  const domain  = url ? extractDomain(url) : null;

  // Fetch homepage HTML once, share across signals
  let homepageHtml = "";
  let websiteOk    = false;
  if (url) {
    try {
      const r = await fetchFn(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; INTERLIGENS-Bot/1.0)" },
        signal: AbortSignal.timeout(5_000),
      });
      if (r.ok) {
        homepageHtml = (await r.text()).toLowerCase();
        websiteOk    = true;
      }
    } catch {
      websiteOk = false;
    }
  }

  // Run all 8 signals independently — failure → neutral score
  async function run<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  const [
    siteScore, ghScore, auditScore, domainScore,
    twScore, wpScore, tgScore, sslScore,
  ] = await Promise.all([
    run(() => websiteOk ? scoreWebsite(url!, fetchFn) : Promise.resolve(neutral(20)), neutral(20)),
    run(() => scoreGithub(homepageHtml, input.githubUrl, fetchFn), neutral(18)),
    Promise.resolve(scoreAudit(homepageHtml)),
    run(() => domain ? scoreDomainAge(domain, fetchFn) : Promise.resolve(neutral(14)), neutral(14)),
    run(() => scoreTwitterAge(homepageHtml, input.twitterHandle, fetchFn), 5),
    run(() => scoreWhitepaper(homepageHtml, input.whitepaperUrl, fetchFn), neutral(8)),
    run(() => scoreTelegram(homepageHtml, input.telegramUrl, fetchFn), 3),
    run(() => url ? scoreSsl(url, fetchFn) : Promise.resolve(neutral(6)), neutral(6)),
  ]);

  function sig(
    id: string, en: string, fr: string,
    score: number, max: number,
  ): CredSignal {
    const status: SignalStatus =
      score === 0   ? "RED"
      : score === neutral(max) && !websiteOk ? "NEUTRAL"
      : statusFromRatio(score, max);
    return { id, label_en: en, label_fr: fr, score, max_score: max, status };
  }

  const ageDays: number | null = domain
    ? await run(async () => {
        const r = await fetchFn(`https://rdap.iana.org/domain/${encodeURIComponent(domain)}`, {
          headers: { Accept: "application/rdap+json" },
          signal: AbortSignal.timeout(3_000),
        });
        if (!r.ok) return null;
        const j = (await r.json()) as { events?: Array<{ eventAction: string; eventDate: string }> };
        const reg = (j.events ?? []).find((e) => e.eventAction === "registration");
        return reg ? Math.floor((Date.now() - new Date(reg.eventDate).getTime()) / 86_400_000) : null;
      }, null)
    : null;

  const domainLabel = (days: number | null): string => {
    if (days === null) return "DOMAIN · UNKNOWN";
    if (days < 14)  return `DOMAIN · ${days} DAYS OLD`;
    if (days < 30)  return `DOMAIN · ${days} DAYS OLD`;
    if (days < 365) return `DOMAIN · ${Math.floor(days / 30)}M OLD`;
    return `DOMAIN · ${Math.floor(days / 365)}Y OLD`;
  };
  const domainLabelFr = (days: number | null): string => {
    if (days === null) return "DOMAINE · INCONNU";
    if (days < 30) return `DOMAINE · ${days} JOURS`;
    if (days < 365) return `DOMAINE · ${Math.floor(days / 30)} MOIS`;
    return `DOMAINE · ${Math.floor(days / 365)} AN${Math.floor(days / 365) > 1 ? "S" : ""}`;
  };

  const domainDays = ageDays;

  const signals: CredSignal[] = [
    sig("website",    websiteOk ? "WEBSITE · REACHABLE" : "WEBSITE · UNREACHABLE", websiteOk ? "SITE · ACCESSIBLE" : "SITE · INACCESSIBLE", siteScore,  20),
    sig("github",     ghScore >= 14 ? "GITHUB · ACTIVE" : ghScore >= 4 ? "GITHUB · PRESENT" : "GITHUB · ABSENT",  ghScore >= 14 ? "GITHUB · ACTIF" : ghScore >= 4 ? "GITHUB · PRÉSENT" : "GITHUB · ABSENT",  ghScore, 18),
    sig("audit",      auditScore >= 10 ? "AUDIT · VERIFIED" : "AUDIT · NOT FOUND", auditScore >= 10 ? "AUDIT · VÉRIFIÉ" : "AUDIT · NON TROUVÉ", auditScore, 16),
    sig("domain_age", domainLabel(domainDays), domainLabelFr(domainDays), domainScore, 14),
    sig("twitter_age", twScore >= 6 ? "TWITTER · ESTABLISHED" : twScore >= 3 ? "TWITTER · RECENT" : "TWITTER · VERY NEW", twScore >= 6 ? "TWITTER · ÉTABLI" : twScore >= 3 ? "TWITTER · RÉCENT" : "TWITTER · TRÈS RÉCENT", twScore, 10),
    sig("whitepaper", wpScore >= 6 ? "WHITEPAPER · FOUND" : wpScore >= 1 ? "WHITEPAPER · LINKED" : "WHITEPAPER · ABSENT", wpScore >= 6 ? "WHITEPAPER · TROUVÉ" : wpScore >= 1 ? "WHITEPAPER · LIÉ" : "WHITEPAPER · ABSENT", wpScore, 8),
    sig("telegram",   tgScore >= 6 ? "TELEGRAM · ACTIVE" : tgScore >= 4 ? "TELEGRAM · PRESENT" : "TELEGRAM · ABSENT", tgScore >= 6 ? "TELEGRAM · ACTIF" : tgScore >= 4 ? "TELEGRAM · PRÉSENT" : "TELEGRAM · ABSENT", tgScore, 8),
    sig("ssl",        sslScore >= 5 ? "SSL · STABLE" : sslScore >= 3 ? "SSL · STANDARD" : "SSL · MISSING", sslScore >= 5 ? "SSL · STABLE" : sslScore >= 3 ? "SSL · STANDARD" : "SSL · ABSENT", sslScore, 6),
  ];

  const totalScore = Math.min(100, signals.reduce((s, sig) => s + sig.score, 0));
  const band       = scoreToBand(totalScore);
  const modifier   = computeTigerModifier(totalScore);
  const conf       = confidence(signals, websiteOk);

  const result: OffChainResult = {
    score: totalScore,
    band,
    confidence: conf,
    tiger_modifier: modifier,
    signals,
    summary_en: summaryEn(totalScore),
    summary_fr: summaryFr(totalScore),
    computed_at: new Date(),
    cache_until: new Date(Date.now() + TTL_MS),
    domainAgeDays: ageDays,
  };

  CACHE.set(key, { result, expiresAt: Date.now() + TTL_MS });
  return result;
}
