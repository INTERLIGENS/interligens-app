export function AnalysisBand({
  kicker = "ANALYSIS",
  title,
  body,
}: {
  kicker?: string;
  title: string;
  body: string;
}) {
  return (
    <section className="fx-analysis-band" aria-labelledby="fx-analysis-title">
      <div className="fx-analysis-band__kicker">{kicker}</div>
      <h2 id="fx-analysis-title" className="fx-analysis-band__title">{title}</h2>
      <div className="fx-analysis-band__body">
        {body.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}
