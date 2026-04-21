import Link from "next/link";
import type { CaseSummary } from "@/lib/contracts/website";

export function CaseLedgerRow({ summary, index }: { summary: CaseSummary; index: number }) {
  const n = String(index + 1).padStart(2, "0");
  return (
    <Link href={`/cases/${summary.slug}`} className="fx-case-ledger-row" aria-label={summary.title}>
      <div className="fx-case-ledger-row__idx">{n}</div>
      <div>
        <div className="fx-case-ledger-row__title">{summary.title}</div>
        <div className="fx-case-ledger-row__meta">
          <span>{summary.kicker}</span>
          {summary.tags.map((t) => (
            <span key={t}>· {t}</span>
          ))}
        </div>
      </div>
      <div className="fx-case-ledger-row__score">{summary.coverScore ?? "—"}</div>
      <div className="fx-actor-status" data-verdict={summary.verdict}>
        {summary.verdict.toUpperCase()}
      </div>
    </Link>
  );
}
