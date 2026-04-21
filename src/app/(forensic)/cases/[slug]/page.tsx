import { notFound } from "next/navigation";
import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  DossierHero,
  SectionNav,
  SectionFrame,
  FlowStages,
  TimelineRail,
  BucketTable,
  FilingPanel,
  AnnexGrid,
  HashStrip,
  EditorialStandard,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { CASEFILE_BY_SLUG } from "@/lib/mocks/case-botify";

type Params = Promise<{ slug: string }>;

export default async function CasefilePage({ params }: { params: Params }) {
  const { slug } = await params;
  const file = CASEFILE_BY_SLUG[slug];
  if (!file) return notFound();

  return (
    <>
      <ClassificationBar ctx={file.classification} statusLabel={`CASEFILE · ${file.filing.revision}`} />
      <Masthead active="/cases" />
      <Breadcrumb
        trail={[
          { href: "/", label: "Home" },
          { href: "/cases", label: "Cases" },
          { label: file.summary.title },
        ]}
      />

      <DossierHero file={file} />
      <SectionNav sections={file.sections} />

      <SectionFrame id="overview" kicker="OVERVIEW" title="What happened">
        <p style={{ color: "var(--bone-soft)", fontSize: 16, lineHeight: 1.6, maxWidth: "72ch" }}>
          {file.summary.dek}
        </p>
      </SectionFrame>

      <SectionFrame id="flow" kicker="FLOW" title="Five stages of the operation">
        <FlowStages stages={file.flow} />
      </SectionFrame>

      <SectionFrame id="timeline" kicker="TIMELINE" title="Key events">
        <TimelineRail events={file.timeline} />
      </SectionFrame>

      <SectionFrame id="evidence" kicker="EVIDENCE" title="Evidence by bucket">
        <BucketTable bundle={file.evidence} />
        <EditorialStandard
          standard={file.filing.editorialStandard}
          hashRef={file.filing.hash}
          updatedAt={file.filing.authored}
        />
      </SectionFrame>

      <SectionFrame id="filing" kicker="FILING" title="Document metadata">
        <FilingPanel filing={file.filing} />
      </SectionFrame>

      <SectionFrame id="annexes" kicker="ANNEXES" title="Attached material">
        <AnnexGrid annexes={file.annexes} />
      </SectionFrame>

      <HashStrip
        hash={file.filing.hash}
        authored={file.filing.authored}
        revision={file.filing.revision}
      />

      <Colophon />
      <LegalStrip />
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(CASEFILE_BY_SLUG).map((slug) => ({ slug }));
}
