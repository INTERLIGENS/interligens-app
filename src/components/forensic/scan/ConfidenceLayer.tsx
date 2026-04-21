import type { ConfidencePillar } from "@/lib/mocks/scan";

export function ConfidenceLayer({ pillars }: { pillars: ConfidencePillar[] }) {
  return (
    <section className="fx-scan-confidence" aria-labelledby="fx-scan-confidence-title">
      <header className="fx-scan-confidence__head">
        <div className="fx-scan-confidence__kicker">WHY YOU CAN TRUST THE SCORE</div>
        <h2 id="fx-scan-confidence-title" className="fx-scan-confidence__title">
          Forensic Editorial v2.
        </h2>
      </header>
      <div className="fx-scan-confidence__grid">
        {pillars.map((p) => (
          <article key={p.tag} className="fx-scan-confidence__cell">
            <div className="fx-scan-confidence__tag">{p.tag}</div>
            <h3 className="fx-scan-confidence__cell-title">{p.title}</h3>
            <p className="fx-scan-confidence__body">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
