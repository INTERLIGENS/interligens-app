type Stat = {
  kicker: string;
  value: string;
  sublabel: string;
  tone?: "signal" | "cleared" | "risk" | "caution";
};

export function RegistryStatsBand({ stats }: { stats: Stat[] }) {
  return (
    <div className="fx-stats-band" role="list" aria-label="Registry stats">
      {stats.map((s) => (
        <div key={s.kicker} className="fx-stats-band__cell" role="listitem">
          <div className="fx-stats-band__label">{s.kicker}</div>
          <span className="fx-stats-band__value" data-tone={s.tone}>
            {s.value}
          </span>
          <div className="fx-stats-band__sub">{s.sublabel}</div>
        </div>
      ))}
    </div>
  );
}
