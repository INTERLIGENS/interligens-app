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

export function concentrationToLabel(pct: number): string {
  if (pct == null || Number.isNaN(pct)) return "";
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded}% du token dans 3 wallets au lancement`;
}

export function rollingProceedsLabel(
  window: "24h" | "7d" | "30d" | "365d",
  usd: number
): string {
  const map: Record<typeof window, string> = {
    "24h": "Dernières 24h",
    "7d": "7 derniers jours",
    "30d": "30 derniers jours",
    "365d": "Cette année",
  };
  return `💸 ${map[window]} : +${formatUsd(usd)}`;
}

export function lastUpdatedLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "jamais mis à jour";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "jamais mis à jour";
  const mins = Math.floor(diffMs / 60_000);
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
