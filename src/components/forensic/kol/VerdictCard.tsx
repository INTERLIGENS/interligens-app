import type { KOLProfile } from "@/lib/contracts/website";

export function VerdictCard({ verdict }: { verdict: KOLProfile["verdict"] }) {
  return (
    <div className="fx-verdict-card" role="region" aria-label="Verdict">
      <div className="fx-verdict-card__mark">VERDICT · {verdict.mark}</div>
      <p className="fx-verdict-card__text">{verdict.summary}</p>
    </div>
  );
}
