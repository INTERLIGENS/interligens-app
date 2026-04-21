import {
  ClassificationBar,
  Masthead,
  LeadStory,
  FilterStrip,
  CohortHead,
  CaseLedgerRow,
  StandardPillars,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { CASES_INDEX } from "@/lib/mocks/cases";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";

const FILTERS = [
  { id: "all",        label: "All cases" },
  { id: "critical",   label: "Critical" },
  { id: "high",       label: "High" },
  { id: "elevated",   label: "Elevated" },
];

const PILLARS = [
  {
    label: "01 · STANDARD",
    title: "Forensic Editorial v2",
    body: "Every claim pairs with an independently retrievable source. Confidence scoring reflects corroboration across buckets, not narrative tone.",
  },
  {
    label: "02 · DISCLOSURE",
    title: "Takedown channel",
    body: "Subjects are invited to respond via a signed takedown channel before publication. Filings carry revision history and hash proof.",
  },
  {
    label: "03 · CITATION",
    title: "Neutral reference",
    body: "Casefiles cite on-chain transactions, archived captures, and third-party oracles. No anonymized sources for factual claims.",
  },
];

export const metadata = {
  title: "Cases — INTERLIGENS",
};

export default function CasesIndexPage() {
  const [lead, ...rest] = CASES_INDEX;
  return (
    <>
      <ClassificationBar ctx={MOCK_CLASSIFICATION} statusLabel="CASE LEDGER" />
      <Masthead active="/cases" />

      <main>
        <div className="fx-container">
          <LeadStory lead={lead} />
        </div>
        <FilterStrip filters={FILTERS} defaultFilter="all" />
        <CohortHead label={`COHORT · ${String(rest.length).padStart(2, "0")} PUBLISHED`} title="Published investigations." />
        <div className="fx-container">
          {rest.map((c, i) => (
            <CaseLedgerRow key={c.slug} summary={c} index={i} />
          ))}
        </div>
        <StandardPillars pillars={PILLARS} />
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
