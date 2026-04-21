import type { EvidenceBundle } from "@/lib/contracts/website";

export function EvidenceDensity({ density }: { density: EvidenceBundle["density"] }) {
  return (
    <section className="fx-evidence-density" aria-label="Evidence density">
      <div className="fx-evidence-density__cell">
        <div className="fx-evidence-density__value">{density.total}</div>
        <div className="fx-evidence-density__label">Total claims</div>
      </div>
      <div className="fx-evidence-density__cell">
        <div className="fx-evidence-density__value">{density.byConfidence.certified ?? 0}</div>
        <div className="fx-evidence-density__label">Certified</div>
      </div>
      <div className="fx-evidence-density__cell">
        <div className="fx-evidence-density__value">{density.byConfidence.high ?? 0}</div>
        <div className="fx-evidence-density__label">High</div>
      </div>
      <div className="fx-evidence-density__cell">
        <div className="fx-evidence-density__value">{density.byConfidence.medium ?? 0}</div>
        <div className="fx-evidence-density__label">Medium</div>
      </div>
    </section>
  );
}
