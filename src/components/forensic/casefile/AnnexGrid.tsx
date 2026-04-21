import type { Casefile } from "@/lib/contracts/website";

export function AnnexGrid({ annexes }: { annexes: Casefile["annexes"] }) {
  return (
    <section className="fx-annex-grid" aria-label="Annexes">
      {annexes.map((a) => (
        <a key={a.id} href={a.href} className="fx-annex-grid__item">
          <div className="fx-annex-grid__label">ANNEX · {a.id.toUpperCase()}</div>
          <h3 className="fx-annex-grid__title">{a.label}</h3>
          <div className="fx-annex-grid__hash">HASH · {a.hash.slice(0, 14)}…</div>
        </a>
      ))}
    </section>
  );
}
