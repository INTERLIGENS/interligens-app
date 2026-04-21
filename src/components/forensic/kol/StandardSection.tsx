export function StandardSection({
  headline,
  body,
}: {
  headline: string;
  body: string;
}) {
  return (
    <section className="fx-standard-section">
      <h3>{headline}</h3>
      {body.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
    </section>
  );
}
