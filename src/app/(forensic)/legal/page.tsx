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
import { ImprintBlock } from "@/components/forensic/legal/ImprintBlock";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import {
  LEGAL_HERO,
  LEGAL_SECTIONS,
  IMPRINT_ENTRIES,
} from "@/lib/mocks/legal";

export const metadata = {
  title: "Legal notice — INTERLIGENS",
  description:
    "Legal notice and publishing posture: LCEN imprint, corrections process, privacy posture, cookies, IP, beta notice, contact points, and applicable law.",
};

import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";

const CROSS_LINKS: CrossLink[] = [
  {
    num: "01",
    title: "Methodology",
    meta: ["Editorial standard", "How a claim is built"],
    status: "Standard",
    href: "/methodology",
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
    title: "Charter",
    meta: ["Reader-side discipline", "How to read a verdict"],
    status: "Reader guide",
    href: "/charter",
  },
  {
    num: "04",
    title: "Cases",
    meta: ["Published investigations", "Browse the ledger"],
    status: "Published",
    href: "/cases",
  },
];

export default function LegalPage() {
  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="LEGAL · PUBLISHING POSTURE"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Legal notice" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={LEGAL_HERO.kicker}
              title={LEGAL_HERO.title}
              dek={LEGAL_HERO.dek}
            />
          </div>

          <SectionFrame
            id="imprint"
            kicker="00 · IMPRINT"
            title="Mentions légales — LCEN."
            body="Mandatory disclosures under French Loi pour la Confiance dans l'Économie Numérique. Entries marked TO_FILL are placeholders awaiting the editorial entity record; they must be replaced before any production launch."
          >
            <div style={{ marginTop: 16 }}>
              <ImprintBlock entries={IMPRINT_ENTRIES} />
            </div>
          </SectionFrame>

          {LEGAL_SECTIONS.map((s) => (
            <SectionFrame
              key={s.id}
              id={s.id}
              kicker={s.kicker}
              title={s.title}
              body={s.body}
            >
              {s.bullets && (
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
                  {s.bullets.map((b, i) => (
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
          ))}
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Adjacent discipline."
            dek="Legal notice sits at the statutory perimeter of the editorial discipline. Methodology and charter define how claims are built and read; takedown is the operational correction path."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
