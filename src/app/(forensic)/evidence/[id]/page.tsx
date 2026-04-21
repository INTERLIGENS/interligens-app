import { notFound } from "next/navigation";
import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  SectionHead,
  BucketTable,
  EditorialStandard,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { EVIDENCE_BY_ID } from "@/lib/mocks/evidence-vine";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";

type Params = Promise<{ id: string }>;

export default async function EvidencePage({ params }: { params: Params }) {
  const { id } = await params;
  const bundle = EVIDENCE_BY_ID[id];
  if (!bundle) return notFound();

  return (
    <>
      <ClassificationBar ctx={MOCK_CLASSIFICATION} statusLabel="EVIDENCE" />
      <Masthead active="/cases" />
      <Breadcrumb
        trail={[
          { href: "/", label: "Home" },
          { href: "/cases", label: "Cases" },
          { label: `Evidence · ${id.toUpperCase()}` },
        ]}
      />

      <main>
        <div className="fx-container">
          <SectionHead
            kicker={`EVIDENCE · ${bundle.density.total} CLAIMS`}
            title="Claims, sources, and confidence."
            dek={`This bundle holds ${bundle.density.total} claims across ${bundle.groups.length} buckets. Each claim pairs with at least one retrievable source and is hashed at capture time.`}
          />
        </div>
        <BucketTable bundle={bundle} />
        <EditorialStandard />
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(EVIDENCE_BY_ID).map((id) => ({ id }));
}
