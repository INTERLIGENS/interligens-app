/**
 * Retail Vision — human-readable label dictionary.
 *
 * Maps technical values (tiger score, dump delay, proceeds, concentration)
 * into short sentences a retail user can understand without crypto jargon.
 * Language: French-leaning retail phrasing as per Retail Vision brief.
 */

export type RetailTier = "RED" | "ORANGE" | "YELLOW" | "GREEN";

export interface TierLabel {
  tier: RetailTier;
  label: string;
  emoji: string;
  color: string;
}

export function tigerScoreToLabel(score: number): TierLabel {
  if (score >= 75) {
    return {
      tier: "RED",
      label: "TRÈS DANGEREUX — à éviter absolument",
      emoji: "🔴",
      color: "#ef4444",
    };
  }
  if (score >= 50) {
    return {
      tier: "ORANGE",
      label: "SUSPECT — méfiance recommandée",
      emoji: "🟠",
      color: "#f97316",
    };
  }
  if (score >= 25) {
    return {
      tier: "YELLOW",
      label: "À surveiller",
      emoji: "🟡",
      color: "#eab308",
    };
  }
  return {
    tier: "GREEN",
    label: "Profil propre",
    emoji: "🟢",
    color: "#10b981",
  };
}

/**
 * Front-running aware sell-delay label.
 * - isFrontRun=true wins over any delay (KOL sold before publishing the promo)
 * - delay < 360 minutes (6h) → hours phrasing
 * - delay >= 360 minutes → days phrasing
 */
export function frontRunToLabel(
  isFrontRun: boolean,
  avgDumpDelayMinutes: number | null | undefined
): string {
  if (isFrontRun) {
    return "🚨 A vendu AVANT son tweet de promotion — front-running détecté";
  }
  if (!avgDumpDelayMinutes || avgDumpDelayMinutes <= 0) {
    return "délai de vente inconnu";
  }
  if (avgDumpDelayMinutes < 360) {
    const hours = Math.max(1, Math.round(avgDumpDelayMinutes / 60));
    return `⚠️ A vendu ${hours}h après son tweet`;
  }
  const days = Math.max(1, Math.round(avgDumpDelayMinutes / (60 * 24)));
  return `Il a vendu ${days} jours après sa promotion`;
}

export function dumpDelayToLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return "délai de vente inconnu";
  if (minutes < 60) {
    return `il vend en moyenne ${minutes} minutes après son tweet`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 48) {
    return `il vend en moyenne ${formatNumber(hours)}h après son tweet`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `il vend en moyenne ${formatNumber(days)}j après son tweet`;
}

export function proceedsToLabel(usd: number): string {
  if (!usd || usd <= 0) return "aucun gain documenté";
  return `il s'est fait ${formatUsd(usd)} sur des projets douteux`;
}

export function concentrationToLabel(
  score: number | null | undefined,
  top3Pct?: number | null
): string {
  if (score == null || Number.isNaN(score)) return "";
  if (score >= 80) {
    const pct = top3Pct != null && !Number.isNaN(top3Pct)
      ? `${Math.round(top3Pct * 10) / 10}%`
      : "la majorité";
    return `⚠️ 3 wallets contrôlaient ${pct} du token au lancement`;
  }
  if (score >= 50) {
    return "Distribution moyenne au lancement";
  }
  return "Distribution correcte au lancement";
}

/**
 * Coordination label — fires when Bubblemaps detects that KOL wallets
 * and/or linked wallets controlled a significant slice of the token at
 * launch. `linkedPct` is the aggregated top-10 supply share (0-100).
 * Under 20% we consider the signal too weak for retail display.
 */
export function coordinationToLabel(
  linkedPct: number | null | undefined
): string {
  if (linkedPct == null || Number.isNaN(linkedPct) || linkedPct < 20) return "";
  const pct = Math.round(linkedPct);
  return `⚠️ Des wallets liés contrôlaient ${pct}% du token au lancement`;
}

/**
 * RugCheck-derived label for a token's launch setup. Produces a single
 * short sentence. Priority (strongest signal wins):
 *   1. isSerialRugger  → creator has a rug history
 *   2. hasInsiders     → insider wallets detected at launch
 *   3. score >= 80     → toxic setup
 *   4. score 50..79    → suspect
 *   5. score < 50      → acceptable
 *
 * Null/undefined score with no other signal → empty string.
 */
export function rugcheckToLabel(
  score: number | null | undefined,
  hasInsiders: boolean,
  isSerialRugger: boolean
): string {
  if (isSerialRugger) {
    return "🚨 Créateur déjà impliqué dans d'autres arnaques";
  }
  if (hasInsiders) {
    return "⚠️ Wallets insiders détectés au lancement";
  }
  if (score == null || Number.isNaN(score)) return "";
  if (score >= 80) return "Token dangereux — setup de lancement toxique";
  if (score >= 50) return "Token suspect — vérification recommandée";
  return "Setup de lancement acceptable";
}

export function rollingProceedsLabel(
  window: "24h" | "7d" | "30d" | "365d",
  usd: number,
  locale: "en" | "fr" = "fr"
): string {
  const map: Record<"en" | "fr", Record<typeof window, string>> = {
    fr: { "24h": "Dernières 24h", "7d": "7 derniers jours", "30d": "30 derniers jours", "365d": "Cette année" },
    en: { "24h": "Last 24h", "7d": "Last 7 days", "30d": "Last 30 days", "365d": "This year" },
  };
  return `${map[locale][window]} : +${formatUsd(usd)}`;
}

export function lastUpdatedLabel(isoDate: string | null | undefined, locale: "en" | "fr" = "fr"): string {
  const never = locale === "en" ? "never updated" : "jamais mis à jour";
  if (!isoDate) return never;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return never;
  const mins = Math.floor(diffMs / 60_000);
  if (locale === "en") {
    if (mins < 60) return `Updated ${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `Updated ${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `Updated ${days}d ago`;
  }
  if (mins < 60) return `Mis à jour il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Mis à jour il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Mis à jour il y a ${days}j`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
