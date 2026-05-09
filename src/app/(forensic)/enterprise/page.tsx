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
import { EnterpriseOpening } from "@/components/forensic/enterprise/EnterpriseOpening";
import { AudienceGrid } from "@/components/forensic/enterprise/AudienceGrid";
import { SystemOfferings } from "@/components/forensic/enterprise/SystemOfferings";
import { EngagementModes } from "@/components/forensic/enterprise/EngagementModes";
import { BoundaryStatement } from "@/components/forensic/enterprise/BoundaryStatement";
import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import {
  ENTERPRISE_HERO,
  ENTERPRISE_OPENING,
  AUDIENCE_INTRO,
  AUDIENCE_CATEGORIES,
  SYSTEM_OFFERINGS_INTRO,
  SYSTEM_OFFERINGS,
  ENTERPRISE_DIFFERENCE,
  ENGAGEMENT_MODES_INTRO,
  ENGAGEMENT_MODES,
  ENTERPRISE_BOUNDARY,
  ENTERPRISE_PUBLIC_LINES,
  ENTERPRISE_DEEPER_LINES,
  ENTERPRISE_CLOSING,
  PARTNERSHIPS_CONTACT_EMAIL,
} from "@/lib/mocks/enterprise";

export const metadata = {
  title: "Partners — INTERLIGENS",
  description:
    "Working entry point for organisations, desks, and partners. INTERLIGENS as a forensic intelligence surface beneath the score: casefiles, constellation, evidence buckets, publication discipline. Sober modes of engagement, one working address.",
};

const OPENING_NOTE =
  "INTERLIGENS is publicly readable. This page exists for the structured readers who already operate in the same problem space — institutions, desks, and partners — not as a sales surface, but as a working address.";

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
    title: "Constellation",
    meta: ["Enter the graph", "Network topology"],
    status: "Live",
    href: "/constellation",
  },
];

export default function EnterprisePage() {
  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="PARTNERS · WORKING ADDRESS"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Enterprise" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={ENTERPRISE_HERO.kicker}
              title={ENTERPRISE_HERO.title}
              dek={ENTERPRISE_HERO.dek}
            />
          </div>

          <EnterpriseOpening
            section={ENTERPRISE_OPENING}
            note={OPENING_NOTE}
          />
        </div>

        <div className="fx-container" style={{ padding: "32px 0 0" }}>
          <SectionHead
            kicker={AUDIENCE_INTRO.kicker}
            title={AUDIENCE_INTRO.title}
            dek={AUDIENCE_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <AudienceGrid categories={AUDIENCE_CATEGORIES} />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={SYSTEM_OFFERINGS_INTRO.kicker}
            title={SYSTEM_OFFERINGS_INTRO.title}
            dek={SYSTEM_OFFERINGS_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <SystemOfferings offerings={SYSTEM_OFFERINGS} />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={ENTERPRISE_DIFFERENCE.id}
            kicker={ENTERPRISE_DIFFERENCE.kicker}
            title={ENTERPRISE_DIFFERENCE.title}
            body={ENTERPRISE_DIFFERENCE.body}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 0" }}>
          <SectionHead
            kicker={ENGAGEMENT_MODES_INTRO.kicker}
            title={ENGAGEMENT_MODES_INTRO.title}
            dek={ENGAGEMENT_MODES_INTRO.dek}
          />
        </div>
        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <EngagementModes
            modes={ENGAGEMENT_MODES}
            contactEmail={PARTNERSHIPS_CONTACT_EMAIL}
          />
        </div>

        <div className="fx-container" style={{ padding: "16px 0 32px" }}>
          <BoundaryStatement
            section={ENTERPRISE_BOUNDARY}
            publicLines={ENTERPRISE_PUBLIC_LINES}
            deeperLines={ENTERPRISE_DEEPER_LINES}
          />
        </div>

        <div className="fx-container">
          <SectionFrame
            id={ENTERPRISE_CLOSING.id}
            kicker={ENTERPRISE_CLOSING.kicker}
            title={ENTERPRISE_CLOSING.title}
            body={ENTERPRISE_CLOSING.body}
          >
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
              <a
                href={`mailto:${PARTNERSHIPS_CONTACT_EMAIL}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  border: "1px solid var(--rule)",
                  background: "var(--ink-raised)",
                  color: "var(--bone)",
                  textDecoration: "none",
                  fontFamily:
                    "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                  fontSize: 12,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                <span>{PARTNERSHIPS_CONTACT_EMAIL}</span>
                <span aria-hidden style={{ color: "var(--signal)" }}>
                  →
                </span>
              </a>
              <span
                style={{
                  fontFamily:
                    "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--bone-dim)",
                }}
              >
                Single working address
              </span>
            </div>
          </SectionFrame>
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Where to read next."
            dek="Before writing, read the work. About frames the institution; methodology frames the standard a claim is built under; the case ledger is where the artifacts live; the constellation is where the graph is read."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
