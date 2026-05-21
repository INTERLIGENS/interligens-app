/**
 * Scam Counter — main widget.
 *
 * Server component. No state, no effects, no fetch.
 *
 * Variants:
 *   - "full"    (default) — total + trend + category breakdown + last-updated.
 *   - "compact"           — total + trend only; breakdown hidden.
 */

import CategoryBreakdown from "./_components/CategoryBreakdown";
import CounterDisplay from "./_components/CounterDisplay";
import TrendIndicator from "./_components/TrendIndicator";
import { MOCK_STATS, type ScamStats } from "./_data/mock-stats";

export interface ScamCounterProps {
  stats?: ScamStats;
  variant?: "compact" | "full";
  showTrend?: boolean;
}

export default function ScamCounter({
  stats = MOCK_STATS,
  variant = "full",
  showTrend = true,
}: ScamCounterProps) {
  return (
    <section
      className="inline-flex flex-col gap-5 rounded-xl border border-white/10 bg-black p-6 text-white"
      data-testid="scam-counter"
      data-variant={variant}
    >
      <div className="flex items-start justify-between gap-6">
        <CounterDisplay value={stats.total} label="Scams documented" />
        {showTrend ? <TrendIndicator trend={stats.trend} /> : null}
      </div>

      {variant === "full" ? (
        <>
          <div className="h-px w-full bg-white/10" />
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6B00]">
              By category
            </div>
            <CategoryBreakdown byCategory={stats.byCategory} />
          </div>
          <div className="text-[10px] font-mono text-white/40">
            Updated {stats.lastUpdated} · static mock
          </div>
        </>
      ) : null}
    </section>
  );
}
