/**
 * /en/news — Crypto-scam watch feed (public).
 *
 * Sources (server-side, Prisma):
 *   - Signal (correlated on-chain + social scam signals, used as "alerts")
 *   - SocialPostCandidate (high signalScore)
 *   - KolProfile (new entries this week)
 *
 * Each item is mapped to a RED/ORANGE/GREEN tier and rendered as a dark
 * INTERLIGENS card. No client JS, revalidated every 5 minutes.
 */

import { prisma } from "@/lib/prisma";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 300;

type Tier = "RED" | "ORANGE" | "GREEN";

interface NewsItem {
  id: string;
  tier: Tier;
  title: string;
  source: string;
  date: Date;
  href: string;
  kind: "signal" | "social" | "kol";
}

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.55)";
const MUTED = "rgba(255,255,255,0.35)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

const TIER_COLORS: Record<Tier, string> = {
  RED: "#FF3B5C",
  ORANGE: "#F59E0B",
  GREEN: "#4ADE80",
};

function severityToTier(severity: string | null | undefined): Tier {
  const s = (severity ?? "").toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return "RED";
  if (s === "MEDIUM" || s === "MED") return "ORANGE";
  return "GREEN";
}

function signalScoreToTier(score: number): Tier {
  if (score >= 70) return "RED";
  if (score >= 40) return "ORANGE";
  return "GREEN";
}

function riskFlagToTier(riskFlag: string | null | undefined): Tier {
  const s = (riskFlag ?? "").toLowerCase();
  if (s.includes("scam") || s.includes("confirmed")) return "RED";
  if (s.includes("suspect") || s.includes("review")) return "ORANGE";
  return "GREEN";
}

function relativeDate(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

async function loadNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const since = new Date(Date.now() - 14 * 24 * 3600_000);

  // ── Signals — correlated scam alerts ────────────────────────────────
  try {
    const signals = await prisma.signal.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        type: true,
        severity: true,
        createdAt: true,
        tokenAddress: true,
        t0PostUrl: true,
        walletAddress: true,
        influencerId: true,
      },
    });

    for (const s of signals) {
      const label =
        s.type === "shill_exit" || s.type === "shill_to_exit"
          ? "Shill-to-exit detected"
          : s.type === "rug"
            ? "Rug event"
            : s.type.replace(/_/g, " ");
      const title = s.tokenAddress
        ? `${label} · ${s.tokenAddress.slice(0, 10)}…`
        : label;
      items.push({
        id: `signal-${s.id}`,
        tier: severityToTier(s.severity),
        title,
        source: "INTERLIGENS Signals",
        date: s.createdAt,
        href: s.t0PostUrl ?? `/en/watchlist`,
        kind: "signal",
      });
    }
  } catch {
    /* swallow — page must render even with a partial data layer */
  }

  // ── SocialPostCandidate — high-signal social posts ─────────────────
  try {
    const posts = await prisma.socialPostCandidate.findMany({
      where: {
        signalScore: { gt: 50 },
        postedAtUtc: { gte: since },
      },
      orderBy: [{ signalScore: "desc" }, { postedAtUtc: "desc" }],
      take: 25,
      select: {
        id: true,
        postUrl: true,
        postedAtUtc: true,
        signalScore: true,
        influencer: { select: { handle: true } },
      },
    });

    for (const p of posts) {
      if (!p.postedAtUtc) continue;
      items.push({
        id: `social-${p.id}`,
        tier: signalScoreToTier(p.signalScore),
        title: `High-signal post · @${p.influencer?.handle ?? "unknown"} · score ${p.signalScore}`,
        source: "Social watch",
        date: p.postedAtUtc,
        href: p.postUrl,
        kind: "social",
      });
    }
  } catch {
    /* swallow */
  }

  // ── KolProfile — new entries (last 7 days) ─────────────────────────
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const kols = await prisma.kolProfile.findMany({
      where: {
        createdAt: { gte: weekAgo },
        ...PUBLIC_KOL_FILTER,
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        handle: true,
        displayName: true,
        riskFlag: true,
        createdAt: true,
      },
    });

    for (const k of kols) {
      items.push({
        id: `kol-${k.id}`,
        tier: riskFlagToTier(k.riskFlag),
        title: `New KOL entry · @${k.handle}${k.displayName ? ` (${k.displayName})` : ""}`,
        source: "KOL Registry",
        date: k.createdAt,
        href: `/en/kol/${k.handle}`,
        kind: "kol",
      });
    }
  } catch {
    /* swallow */
  }

  // Sort global, most recent first; cap at 60.
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items.slice(0, 60);
}

export default async function NewsPage() {
  const items = await loadNews();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px 120px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            color: ACCENT,
            marginBottom: 10,
          }}
        >
          INTERLIGENS · LIVE FEED
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            marginBottom: 10,
          }}
        >
          Crypto-scam Watch
        </h1>
        <p style={{ fontSize: 14, color: DIM, lineHeight: 1.6, marginBottom: 36 }}>
          Near-real-time stream of new scam signals, high-intent social posts,
          and KOL registry additions. Pulled from INTERLIGENS internal
          detection pipelines.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && (
            <div style={{ color: DIM, fontFamily: "monospace", fontSize: 13 }}>
              No signals in the last 14 days.
            </div>
          )}
          {items.map((item) => {
            const color = TIER_COLORS[item.tier];
            const external = item.href.startsWith("http");
            const linkProps = external
              ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
              : { href: item.href };
            return (
              <Link
                key={item.id}
                {...linkProps}
                style={{
                  display: "block",
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderLeft: `3px solid ${color}`,
                  padding: "16px 18px",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: "0.1em",
                      fontFamily: "monospace",
                      color,
                      background: `${color}18`,
                      border: `1px solid ${color}55`,
                      borderRadius: 2,
                    }}
                  >
                    {item.tier}
                  </span>
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
                    {item.source} · {relativeDate(item.date)}
                  </span>
                </div>
                <div style={{ fontSize: 15, color: TEXT, fontWeight: 600, lineHeight: 1.4 }}>
                  {item.title}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
