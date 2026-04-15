import type { Tier } from "@/lib/simulator/scenarios";

const TIER_COLOR: Record<Tier, string> = {
  RED: "#FF3B5C",
  ORANGE: "#F85B05",
  GREEN: "#00C853",
};

type Props = {
  score: number;
  tier: Tier;
  signals: string[];
  verdict: string;
};

export function TigerScoreMock({ score, tier, signals, verdict }: Props) {
  const color = TIER_COLOR[tier];
  return (
    <div className="border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
            TigerScore
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="font-black text-5xl leading-none"
              style={{ color }}
            >
              {score}
            </span>
            <span
              className="text-[11px] font-black uppercase tracking-[0.18em]"
              style={{ color }}
            >
              {tier}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        {signals.map((s) => (
          <div
            key={s}
            className="flex items-start gap-2 text-[12px] text-white/80"
          >
            <span
              className="mt-1.5 h-[3px] w-[3px] shrink-0"
              style={{ backgroundColor: color }}
            />
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div
        className="mt-5 border-l-2 pl-3 text-[12px] uppercase tracking-wide text-white/90"
        style={{ borderColor: color }}
      >
        {verdict}
      </div>
    </div>
  );
}
