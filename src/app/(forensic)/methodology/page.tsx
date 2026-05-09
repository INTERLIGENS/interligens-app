import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  SectionHead,
  SectionFrame,
  StandardPillars,
  CrossLinksGrid,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import {
  METHODOLOGY_CLASSIFICATION,
  METHODOLOGY_HERO,
  METHODOLOGY_SECTIONS,
  METHODOLOGY_PILLARS,
} from "@/lib/mocks/methodology";

export const metadata = {
  title: "Methodology — INTERLIGENS",
  description:
    "How INTERLIGENS builds a claim: editorial standard, TigerScore, open evidence, observed proceeds, constellation, casefile, publication, and the documented limits of the method.",
};

import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";

const CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Charter",
    meta: ["Reader-side discipline", "How to read a score"],
    status: "Reader guide",
    href: "/charter",
  },
  {
    num: "02",
    title: "Takedown",
    meta: ["Contesting a claim", "Editorial review channel"],
    status: "Active",
    href: "/takedown",
  },
  {
    num: "03",
    title: "Legal",
    meta: ["Imprint and posture", "Mandatory notices"],
    status: "Imprint",
    href: "/legal",
  },
  {
    num: "04",
    title: "Constellation",
    meta: ["Graph topology", "How relationships are mapped"],
    status: "Live",
    href: "/constellation",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <ClassificationBar
        ctx={METHODOLOGY_CLASSIFICATION}
        statusLabel="METHODOLOGY · FORENSIC EDITORIAL v2"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Methodology" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={METHODOLOGY_HERO.kicker}
              title={METHODOLOGY_HERO.title}
              dek={METHODOLOGY_HERO.dek}
            />
          </div>

          {METHODOLOGY_SECTIONS.map((s) => (
            <SectionFrame
              key={s.id}
              id={s.id}
              kicker={s.kicker}
              title={s.title}
              body={s.body}
            />
          ))}
        </div>

        <StandardPillars pillars={METHODOLOGY_PILLARS} />

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Adjacent discipline."
            dek="The four-page discipline block. Charter is the reader side of methodology; takedown and legal are the operational and statutory perimeters."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
