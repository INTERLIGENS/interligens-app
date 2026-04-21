import type { Casefile } from "@/lib/contracts/website";

export function DossierHero({ file }: { file: Casefile }) {
  const { summary, filing } = file;
  return (
    <header className="fx-dossier-hero">
      <div className="fx-dossier-hero__kicker">{summary.kicker}</div>
      <h1 className="fx-dossier-hero__title">{summary.title}</h1>
      <p className="fx-dossier-hero__dek">{summary.dek}</p>
      <div className="fx-dossier-hero__meta">
        <span>FILED · <strong>{filing.authored.slice(0, 10)}</strong></span>
        <span>REVISION · <strong>{filing.revision}</strong></span>
        <span>STANDARD · <strong>{filing.editorialStandard}</strong></span>
        <span>HASH · <strong>{filing.hash.slice(0, 12)}…</strong></span>
      </div>
    </header>
  );
}
