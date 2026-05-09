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
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import {
  CHARTER_HERO,
  CHARTER_SECTIONS,
  CHARTER_TIER_PILLARS,
} from "@/lib/mocks/charter";

export const metadata = {
  title: "Charter — INTERLIGENS",
  description:
    "How to read what INTERLIGENS publishes. Reader-side discipline: scores, evidence buckets, constellation topology, RED/AMBER/GREEN, and what the platform does not do for you.",
};

import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";

const CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Methodology",
    meta: ["Producer-side discipline", "How a claim is built"],
    status: "Standard",
    href: "/methodology",
  },
  {
    num: "02",
    title: "Scan",
    meta: ["Try a TigerScore", "Token, wallet, or KOL"],
    status: "Open",
    href: "/scan",
  },
  {
    num: "03",
    title: "Cases",
    meta: ["Read worked examples", "Published investigations"],
    status: "Published",
    href: "/cases",
  },
  {
    num: "04",
    title: "Takedown",
    meta: ["Contesting a claim", "Editorial review channel"],
    status: "Active",
    href: "/takedown",
  },
];

export default function CharterPage() {
  // Sections are split: section 01–02 first (score + buckets), then the
  // RED/AMBER/GREEN pillars before the rest, so the reader meets the
  // colour grammar before sections 03–07 build on it.
  const [reading01, reading02, ...rest] = CHARTER_SECTIONS;

  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="CHARTER · READER GUIDE"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Charter" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={CHARTER_HERO.kicker}
              title={CHARTER_HERO.title}
              dek={CHARTER_HERO.dek}
            />
          </div>

          <SectionFrame
            id={reading01.id}
            kicker={reading01.kicker}
            title={reading01.title}
            body={reading01.body}
          />
          <SectionFrame
            id={reading02.id}
            kicker={reading02.kicker}
            title={reading02.title}
            body={reading02.body}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 16px" }}>
          <SectionHead
            kicker="03 · READING RED / AMBER / GREEN"
            title="What the colour does not say."
            dek="Three tiers, three reading postures. The colour is a stance, not a sentence."
          />
        </div>
        <StandardPillars pillars={CHARTER_TIER_PILLARS} />

        <div className="fx-container">
          {rest.map((s) => (
            <SectionFrame
              key={s.id}
              id={s.id}
              kicker={s.kicker}
              title={s.title}
              body={s.body}
            />
          ))}
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Adjacent discipline."
            dek="The charter is the reader side of the editorial pact. Methodology is the producer side; cases and scan are where the reading is actually exercised."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
