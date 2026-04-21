import type { EvidenceBundle } from "@/lib/contracts/website";
import { EvidenceGroupHead } from "./EvidenceGroupHead";
import { EvidenceRail } from "./EvidenceRail";

export function BucketTable({ bundle }: { bundle: EvidenceBundle }) {
  return (
    <section className="fx-bucket-table" aria-label="Evidence by bucket">
      {bundle.groups.map((g) => (
        <div key={g.bucket}>
          <EvidenceGroupHead bucket={g.bucket} count={g.claims.length} />
          <EvidenceRail claims={g.claims} />
        </div>
      ))}
    </section>
  );
}
