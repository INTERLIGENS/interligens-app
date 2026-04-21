type RegistryOpeningProps = {
  kicker: string;
  title: string;           // supports <em>…</em> for signal-orange emphasis
  titleEm?: string;         // text to emphasize; if provided, title is treated as plain
  dek: string;
};

export function RegistryOpening({ kicker, title, titleEm, dek }: RegistryOpeningProps) {
  return (
    <section className="fx-registry-opening" aria-labelledby="fx-registry-title">
      <div className="fx-registry-opening__kicker">{kicker}</div>
      <h1 id="fx-registry-title" className="fx-registry-opening__title">
        {title} {titleEm && <em>{titleEm}</em>}
      </h1>
      <p className="fx-registry-opening__dek">{dek}</p>
    </section>
  );
}
