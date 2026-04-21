export function CohortHead({ label, title }: { label: string; title: string }) {
  return (
    <header className="fx-cohort-head">
      <div className="fx-cohort-head__label">{label}</div>
      <h2 className="fx-cohort-head__title">{title}</h2>
    </header>
  );
}
