type Pillar = { label: string; title: string; body: string };

export function StandardPillars({ pillars }: { pillars: Pillar[] }) {
  return (
    <section className="fx-standard-pillars" aria-label="Editorial standard">
      {pillars.map((p) => (
        <div key={p.label} className="fx-standard-pillars__cell">
          <div className="fx-standard-pillars__label">{p.label}</div>
          <h3 className="fx-standard-pillars__title">{p.title}</h3>
          <p className="fx-standard-pillars__body">{p.body}</p>
        </div>
      ))}
    </section>
  );
}
