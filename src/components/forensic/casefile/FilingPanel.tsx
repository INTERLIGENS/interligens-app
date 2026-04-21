import type { Casefile } from "@/lib/contracts/website";

export function FilingPanel({ filing }: { filing: Casefile["filing"] }) {
  return (
    <dl className="fx-filing-panel" aria-label="Filing metadata">
      <div>
        <dt>Authored</dt>
        <dd>{filing.authored}</dd>
      </div>
      <div>
        <dt>Revision</dt>
        <dd>{filing.revision}</dd>
      </div>
      <div>
        <dt>Standard</dt>
        <dd>{filing.editorialStandard}</dd>
      </div>
      <div>
        <dt>Hash</dt>
        <dd>{filing.hash}</dd>
      </div>
    </dl>
  );
}
