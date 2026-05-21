/**
 * Trend badge — arrow + signed delta + period suffix.
 *
 * Colour convention (read carefully — it's inverted from the usual finance one):
 *   up   → red    (more scams = bad news)
 *   down → green  (fewer scams = good news)
 *   flat → grey
 *
 * Server-rendered. Tailwind utility classes only.
 */

import type { ScamStats } from "../_data/mock-stats";

export interface TrendIndicatorProps {
  trend: ScamStats["trend"];
}

interface RenderedTrend {
  arrow: "↑" | "↓" | "→";
  signedDelta: string;
  colorClass: string;
}

export function describeTrend(trend: ScamStats["trend"]): RenderedTrend {
  if (trend.direction === "up") {
    return {
      arrow: "↑",
      signedDelta: `+${trend.delta}`,
      colorClass: "text-[#FF3B5C] bg-[#FF3B5C]/10 border-[#FF3B5C]/30",
    };
  }
  if (trend.direction === "down") {
    return {
      arrow: "↓",
      signedDelta: `-${Math.abs(trend.delta)}`,
      colorClass: "text-[#00FF94] bg-[#00FF94]/10 border-[#00FF94]/30",
    };
  }
  return {
    arrow: "→",
    signedDelta: "0",
    colorClass: "text-white/50 bg-white/5 border-white/10",
  };
}

export default function TrendIndicator({ trend }: TrendIndicatorProps) {
  const r = describeTrend(trend);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-bold tabular-nums ${r.colorClass}`}
      data-testid="trend-indicator"
    >
      <span aria-hidden="true">{r.arrow}</span>
      <span>{r.signedDelta}</span>
      <span className="opacity-70">({trend.period})</span>
    </span>
  );
}
