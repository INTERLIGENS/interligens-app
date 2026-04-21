import type { EvidenceClaim } from "@/lib/contracts/website";
import { EvidenceItem } from "./EvidenceItem";

export function EvidenceRail({ claims }: { claims: EvidenceClaim[] }) {
  return (
    <div className="fx-evidence-rail" role="list">
      {claims.map((claim, i) => (
        <div key={claim.id} role="listitem">
          <EvidenceItem claim={claim} index={i} />
        </div>
      ))}
    </div>
  );
}
