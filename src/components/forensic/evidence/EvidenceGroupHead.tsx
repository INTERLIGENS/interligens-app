import type { EvidenceClaim } from "@/lib/contracts/website";

const BUCKET_LABEL: Record<EvidenceClaim["bucket"], string> = {
  on_chain: "On-chain evidence",
  off_chain: "Off-chain evidence",
  communications: "Communications",
  identity: "Identity",
  timeline: "Timeline",
  corroboration: "Corroboration",
};

export function EvidenceGroupHead({
  bucket,
  count,
}: {
  bucket: EvidenceClaim["bucket"];
  count: number;
}) {
  return (
    <header className="fx-evidence-group-head">
      <h3 className="fx-evidence-group-head__title">{BUCKET_LABEL[bucket]}</h3>
      <div className="fx-evidence-group-head__count">{count} claims</div>
    </header>
  );
}
