import Link from "next/link";
import type { CaseSummary } from "@/lib/contracts/website";

export function LeadStory({ lead }: { lead: CaseSummary }) {
  return (
    <Link href={`/cases/${lead.slug}`} className="fx-lead-story" aria-label={`Lead: ${lead.title}`}>
      <div className="fx-lead-story__num">{String(lead.coverScore ?? "—")}</div>
      <div>
        <div className="fx-lead-story__kicker">{lead.kicker}</div>
        <h2 className="fx-lead-story__title">{lead.title}</h2>
        <p className="fx-lead-story__dek">{lead.dek}</p>
      </div>
    </Link>
  );
}
