import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  SectionHead,
  SectionFrame,
  CrossLinksGrid,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";
import { SystemLayers } from "@/components/forensic/about/SystemLayers";
import { ReaderSplit } from "@/components/forensic/about/ReaderSplit";
import { BoundariesGrid } from "@/components/forensic/about/BoundariesGrid";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import {
  ABOUT_HERO,
  ABOUT_MISSION,
  ABOUT_WHAT_THIS_IS,
  ABOUT_DIFFERENCE,
  ABOUT_LAYERS,
  ABOUT_PUBLICATION_DISCIPLINE,
  ABOUT_RETAIL_COLUMN,
  ABOUT_INVESTIGATOR_COLUMN,
  ABOUT_READER_NOTE,
  ABOUT_BOUNDARIES_DO,
  ABOUT_BOUNDARIES_DONT,
} from "@/lib/mocks/about";

export const metadata = {
  title: "About — INTERLIGENS",
  description:
    "INTERLIGENS is a forensic intelligence publication system for crypto entities, wallets, and KOLs — built for retail readers and reproducible by investigators. This page explains what the system does, how it is structured, and where the work ends.",
};

const ORIENTATION_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Scan",
    meta: ["Run a TigerScore", "Token, wallet, or KOL"],
    status: "Open",
    href: "/scan",
  },
  {
    num: "02",
    title: "Methodology",
    meta: ["Read the standard", "How a claim is built"],
    status: "Standard",
    href: "/methodology",
  },
  {
    num: "03",
    title: "Constellation",
    meta: ["Enter the graph", "Network topology"],
    status: "Live",
    href: "/constellation",
  },
  {
    num: "04",
    title: "Cases",
    meta: ["Browse the ledger", "Published investigations"],
    status: "Published",
    href: "/cases",
  },
];

export default function AboutPage() {
  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="ABOUT · INSTITUTION"
      />
      <Masthead active="/about" />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "About" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={ABOUT_HERO.kicker}
              title={ABOUT_HERO.title}
              dek={ABOUT_HERO.dek}
            />
          </div>

          <SectionFrame
            id={ABOUT_MISSION.id}
            kicker={ABOUT_MISSION.kicker}
            title={ABOUT_MISSION.title}
            body={ABOUT_MISSION.body}
          />
          <SectionFrame
            id={ABOUT_WHAT_THIS_IS.id}
            kicker={ABOUT_WHAT_THIS_IS.kicker}
            title={ABOUT_WHAT_THIS_IS.title}
            body={ABOUT_WHAT_THIS_IS.body}
          />
          <SectionFrame
            id={ABOUT_DIFFERENCE.id}
            kicker={ABOUT_DIFFERENCE.kicker}
            title={ABOUT_DIFFERENCE.title}
            body={ABOUT_DIFFERENCE.body}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker="03 · THE SYSTEM"
            title="Five layers, one editorial standard."
            dek="The platform is not a single tool. It is a stack of layers, each documented and each governed by the same publication discipline."
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SystemLayers layers={ABOUT_LAYERS} />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={ABOUT_PUBLICATION_DISCIPLINE.id}
            kicker={ABOUT_PUBLICATION_DISCIPLINE.kicker}
            title={ABOUT_PUBLICATION_DISCIPLINE.title}
            body={ABOUT_PUBLICATION_DISCIPLINE.body}
          >
            {ABOUT_PUBLICATION_DISCIPLINE.bullets && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "16px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  color: "var(--bone-soft)",
                  fontFamily:
                    "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {ABOUT_PUBLICATION_DISCIPLINE.bullets.map((b, i) => (
                  <li
                    key={i}
                    style={{ paddingLeft: 16, position: "relative" }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "0.55em",
                        width: 6,
                        height: 1,
                        background: "var(--signal)",
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </SectionFrame>
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker="05 · TWO READINGS"
            title="Retail and investigator, same artifact."
            dek="The reading you get is the depth you bring. The system surfaces both."
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <ReaderSplit
            left={ABOUT_RETAIL_COLUMN}
            right={ABOUT_INVESTIGATOR_COLUMN}
            note={ABOUT_READER_NOTE}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker="06 · BOUNDARIES"
            title="The line of the work."
            dek="A serious system is the one that publishes its limits as carefully as its claims."
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <BoundariesGrid
            doColumn={ABOUT_BOUNDARIES_DO}
            dontColumn={ABOUT_BOUNDARIES_DONT}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 64px" }}>
          <SectionHead
            kicker="07 · ORIENTATION"
            title="Where to read next."
            dek="The platform is a system. The shortest path through it depends on what you came for."
          />
          <CrossLinksGrid links={ORIENTATION_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
