import { notFound } from "next/navigation";
import {
  ClassificationBar,
  Masthead,
  ThreatLevelBar,
  SubjectLine,
  ScoreTheatre,
  SignalGrid,
  ActionRail,
  AnalysisBand,
  ActorList,
  AskStrip,
  SectionHead,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { RESULTS_BY_ID } from "@/lib/mocks/result-vine";

type Params = Promise<{ id: string }>;

export default async function ResultPage({ params }: { params: Params }) {
  const { id } = await params;
  const result = RESULTS_BY_ID[id];
  if (!result) return notFound();

  const threatPct = Math.min(100, result.score.value);
  const threatLabel = `${threatPct}% ${result.score.mark}`;

  return (
    <>
      <ClassificationBar
        ctx={result.classification}
        statusLabel={`THREAT ${result.score.verdict.toUpperCase()}`}
        leftTag={`TIGERSCORE · COMPUTED`}
      />
      <Masthead active="/cases" />
      <ThreatLevelBar percent={threatPct} mark={threatLabel} />
      <SubjectLine
        subject={result.subject}
        pills={[
          { label: "MINT ACTIVE", verdict: "critical" },
          { label: `${(49.7).toFixed(1)}M SUPPLY`, verdict: "high" },
        ]}
      />

      <ScoreTheatre
        score={result.score}
        verdictText={result.verdictText}
        tags={[result.score.mark, "TIGERSCORE", "HIGH CONFIDENCE"]}
      />
      <SignalGrid signals={result.signals} />
      <ActionRail actions={result.actions} />

      <div className="fx-container">
        <SectionHead
          kicker={`NETWORK INVESTIGATION · ${String(result.linkedActors.length).padStart(2, "0")} PROFILES`}
          title="Associated threat actors."
          dek="Cross-referenced via on-chain clustering, social media forensics, and wallet pattern analysis. Each profile shows documented coordination in the operation."
        />
        <ActorList actors={result.linkedActors} />
      </div>

      <AnalysisBand title={result.analysis.headline} body={result.analysis.body} />
      <div className="fx-container">
        <AskStrip context={result.id} />
      </div>

      <Colophon />
      <LegalStrip />
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(RESULTS_BY_ID).map((id) => ({ id }));
}
