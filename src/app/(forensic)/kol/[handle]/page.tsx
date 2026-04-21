import { notFound } from "next/navigation";
import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  DossierHead,
  VerdictCard,
  StatsBand,
  BehaviouralRail,
  EvidenceDensity,
  StandardSection,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { KOL_BY_HANDLE } from "@/lib/mocks/kol-bkokoski";

type Params = Promise<{ handle: string }>;

export default async function KOLPage({ params }: { params: Params }) {
  const { handle } = await params;
  const profile = KOL_BY_HANDLE[handle];
  if (!profile) return notFound();

  return (
    <>
      <ClassificationBar ctx={profile.classification} statusLabel={`KOL · ${profile.verdict.mark}`} />
      <Masthead active="/kol" />
      <Breadcrumb
        trail={[
          { href: "/", label: "Home" },
          { href: "/kol", label: "KOL" },
          { label: profile.displayName },
        ]}
      />

      <DossierHead profile={profile} />
      <div className="fx-container">
        <VerdictCard verdict={profile.verdict} />
      </div>
      <StatsBand stats={profile.stats} />
      <BehaviouralRail signals={profile.behaviouralSignals} />
      <EvidenceDensity density={profile.evidenceDensity} />
      <StandardSection headline={profile.standardSection.headline} body={profile.standardSection.body} />

      <Colophon />
      <LegalStrip />
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(KOL_BY_HANDLE).map((handle) => ({ handle }));
}
