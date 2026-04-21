export function SectionHead({
  kicker,
  title,
  dek,
}: {
  kicker: string;
  title: string;
  dek?: string;
}) {
  return (
    <header className="fx-section-head">
      <div className="fx-section-head__kicker">{kicker}</div>
      <h2 className="fx-section-head__title">{title}</h2>
      {dek && <p className="fx-section-head__dek">{dek}</p>}
    </header>
  );
}
