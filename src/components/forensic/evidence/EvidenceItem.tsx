import type { EvidenceClaim } from "@/lib/contracts/website";
import { ConfidenceBar } from "./ConfidenceBar";

export function EvidenceItem({ claim, index }: { claim: EvidenceClaim; index: number }) {
  const n = String(index + 1).padStart(2, "0");
  return (
    <article className="fx-evidence-item">
      <div className="fx-evidence-item__idx">EVID · {n}</div>
      <div>
        <h3 className="fx-evidence-item__headline">{claim.headline}</h3>
        <p className="fx-evidence-item__statement">{claim.statement}</p>
        <div className="fx-evidence-item__sources">
          {claim.sources.map((s) => (
            <a key={s.ref} href={s.kind === "url" ? s.ref : undefined}>
              {s.kind.toUpperCase()} · {s.label}
            </a>
          ))}
        </div>
      </div>
      <ConfidenceBar level={claim.confidence} />
    </article>
  );
}
