import {
  ClassificationBar,
  Masthead,
  Breadcrumb,
  SectionHead,
  SectionFrame,
  CrossLinksGrid,
  Colophon,
  LegalStrip,
  GuardHero,
  GuardScenarioGrid,
  GuardSystemLink,
  GuardDifferenceTable,
  GuardChainRail,
  EarlyAccessBlock,
} from "@/components/forensic";
import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";
import {
  GUARD_CLASSIFICATION,
  GUARD_HERO,
  GUARD_SCENARIOS,
  GUARD_SCENARIO_INTRO,
  GUARD_ENGINE_PILLARS,
  GUARD_ENGINE_INTRO,
  GUARD_DIFFERENCE_POINTS,
  GUARD_DIFFERENCE_INTRO,
  GUARD_CHAIN_STAGES,
  GUARD_CHAIN_INTRO,
  GUARD_EARLY_ACCESS,
  GUARD_EARLY_ACCESS_EMAIL,
  GUARD_EARLY_ACCESS_SUBJECT,
  GUARD_CLOSING,
} from "@/lib/mocks/guard";

export const metadata = {
  title: "Guard — INTERLIGENS",
  description:
    "Phantom Guard is the live distribution layer of the INTERLIGENS engine — the dossier, the casefile, the cluster, surfaced at the moment of signature. Available via early access.",
};

const PRIMARY_HREF = `mailto:${GUARD_EARLY_ACCESS_EMAIL}?subject=${encodeURIComponent(
  GUARD_EARLY_ACCESS_SUBJECT,
)}`;

const CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Scan",
    meta: ["Public-side intake", "Token, wallet, or KOL"],
    status: "Open",
    href: "/scan",
  },
  {
    num: "02",
    title: "Constellation",
    meta: ["Graph topology", "Walk the case"],
    status: "Live",
    href: "/constellation",
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
    title: "Partners",
    meta: ["Institutional surface", "Working address"],
    status: "Address",
    href: "/enterprise",
  },
];

export default function GuardPage() {
  return (
    <>
      <ClassificationBar
        ctx={GUARD_CLASSIFICATION}
        statusLabel="GUARD · POINT OF SIGNATURE"
      />
      <Masthead active="/guard" />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Guard" }]}
          />
          <GuardHero
            kicker={GUARD_HERO.kicker}
            title={GUARD_HERO.title}
            dek={GUARD_HERO.dek}
            positionLine={GUARD_HERO.positionLine}
            primaryCta={GUARD_HERO.primaryCta}
            primaryHref={PRIMARY_HREF}
            secondaryCta={GUARD_HERO.secondaryCta}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={GUARD_SCENARIO_INTRO.kicker}
            title={GUARD_SCENARIO_INTRO.title}
            dek={GUARD_SCENARIO_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <GuardScenarioGrid scenarios={GUARD_SCENARIOS} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={GUARD_ENGINE_INTRO.kicker}
            title={GUARD_ENGINE_INTRO.title}
            dek={GUARD_ENGINE_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <GuardSystemLink pillars={GUARD_ENGINE_PILLARS} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={GUARD_DIFFERENCE_INTRO.kicker}
            title={GUARD_DIFFERENCE_INTRO.title}
            dek={GUARD_DIFFERENCE_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <GuardDifferenceTable points={GUARD_DIFFERENCE_POINTS} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={GUARD_CHAIN_INTRO.kicker}
            title={GUARD_CHAIN_INTRO.title}
            dek={GUARD_CHAIN_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <GuardChainRail stages={GUARD_CHAIN_STAGES} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <EarlyAccessBlock
            kicker={GUARD_EARLY_ACCESS.kicker}
            title={GUARD_EARLY_ACCESS.title}
            body={GUARD_EARLY_ACCESS.body}
            noteLine={GUARD_EARLY_ACCESS.noteLine}
            email={GUARD_EARLY_ACCESS_EMAIL}
            subject={GUARD_EARLY_ACCESS_SUBJECT}
          />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={GUARD_CLOSING.id}
            kicker={GUARD_CLOSING.kicker}
            title={GUARD_CLOSING.title}
            body={GUARD_CLOSING.body}
          />
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Where to read next."
            dek="Guard sits at the end of the chain. Scan opens the engine, constellation walks the topology, the case ledger holds the artifacts, and partners is the institutional address."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
