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
import { CoverageList } from "@/components/forensic/press/CoverageList";
import { TalkingPointsGrid } from "@/components/forensic/press/TalkingPointsGrid";
import { SpokespeopleBlock } from "@/components/forensic/press/SpokespeopleBlock";
import { PressContactBlock } from "@/components/forensic/press/PressContactBlock";
import { AssetsList } from "@/components/forensic/press/AssetsList";
import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import {
  PRESS_HERO,
  PRESS_OPENING,
  PRESS_ABOUT,
  PRESS_COVERAGE_INTRO,
  COVERAGE_ENTRIES,
  TALKING_POINTS_INTRO,
  TALKING_POINTS,
  SPOKESPEOPLE_INTRO,
  SPOKESPEOPLE,
  PRESS_CONTACT_INTRO,
  PRESS_CONTACT_EMAIL,
  ASSETS_INTRO,
  ASSET_LIST,
  PRESS_EDITORIAL_STANDARDS,
} from "@/lib/mocks/press";

export const metadata = {
  title: "Press — INTERLIGENS",
  description:
    "Working press address for INTERLIGENS. Posture toward the press, talking points, on-the-record spokespeople, recent media, asset release, and the editorial standards under which our claims are published.",
};

const CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "About",
    meta: ["Institutional context", "What this system is"],
    status: "Institution",
    href: "/about",
  },
  {
    num: "02",
    title: "Methodology",
    meta: ["Editorial standard", "How a claim is built"],
    status: "Standard",
    href: "/methodology",
  },
  {
    num: "03",
    title: "Cases",
    meta: ["Lead — $BOTIFY", "Published investigations"],
    status: "Published",
    href: "/cases",
  },
  {
    num: "04",
    title: "Legal notice",
    meta: ["Imprint and posture", "Mandatory notices"],
    status: "Imprint",
    href: "/legal",
  },
];

export default function PressPage() {
  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="PRESS · WORKING ADDRESS"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Press" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={PRESS_HERO.kicker}
              title={PRESS_HERO.title}
              dek={PRESS_HERO.dek}
            />
          </div>

          <SectionFrame
            id={PRESS_OPENING.id}
            kicker={PRESS_OPENING.kicker}
            title={PRESS_OPENING.title}
            body={PRESS_OPENING.body}
          />
          <SectionFrame
            id={PRESS_ABOUT.id}
            kicker={PRESS_ABOUT.kicker}
            title={PRESS_ABOUT.title}
            body={PRESS_ABOUT.body}
          />

          <SectionFrame
            id={PRESS_COVERAGE_INTRO.id}
            kicker={PRESS_COVERAGE_INTRO.kicker}
            title={PRESS_COVERAGE_INTRO.title}
            body={PRESS_COVERAGE_INTRO.body}
          >
            <div style={{ marginTop: 16 }}>
              <CoverageList entries={COVERAGE_ENTRIES} />
            </div>
          </SectionFrame>
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={TALKING_POINTS_INTRO.kicker}
            title={TALKING_POINTS_INTRO.title}
            dek={TALKING_POINTS_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <TalkingPointsGrid points={TALKING_POINTS} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={SPOKESPEOPLE_INTRO.kicker}
            title={SPOKESPEOPLE_INTRO.title}
            dek={SPOKESPEOPLE_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <SpokespeopleBlock people={SPOKESPEOPLE} />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={PRESS_CONTACT_INTRO.id}
            kicker={PRESS_CONTACT_INTRO.kicker}
            title={PRESS_CONTACT_INTRO.title}
            body={PRESS_CONTACT_INTRO.body}
          >
            <div style={{ marginTop: 16 }}>
              <PressContactBlock email={PRESS_CONTACT_EMAIL} />
            </div>
          </SectionFrame>
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={ASSETS_INTRO.kicker}
            title={ASSETS_INTRO.title}
            dek={ASSETS_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <AssetsList assets={ASSET_LIST} contactEmail={PRESS_CONTACT_EMAIL} />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={PRESS_EDITORIAL_STANDARDS.id}
            kicker={PRESS_EDITORIAL_STANDARDS.kicker}
            title={PRESS_EDITORIAL_STANDARDS.title}
            body={PRESS_EDITORIAL_STANDARDS.body}
          />
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Where to read next."
            dek="The press address sits next to the institutional surfaces. About frames what the system is; methodology frames how the work is built; the case ledger is where the work lives; the legal notice carries the publishing posture."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
