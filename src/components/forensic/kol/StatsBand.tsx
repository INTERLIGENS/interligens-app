import type { KOLProfile } from "@/lib/contracts/website";

export function StatsBand({ stats }: { stats: KOLProfile["stats"] }) {
  return (
    <div className="fx-stats-band" aria-label="Dossier stats">
      {stats.map((s) => (
        <div key={s.kicker} className="fx-stats-band__cell">
          <div className="fx-stats-band__label">{s.kicker}</div>
          <span className="fx-stats-band__value">{s.value}</span>
          <div className="fx-stats-band__sub">{s.sublabel}</div>
        </div>
      ))}
    </div>
  );
}
