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
  TAKEDOWN_HERO,
  TAKEDOWN_SECTIONS,
  TAKEDOWN_SLA,
  TAKEDOWN_CONTACT,
} from "@/lib/mocks/takedown";

export const metadata = {
  title: "Takedown — INTERLIGENS",
  description:
    "How to contest a published claim. Editorial review channel, eligibility, required evidence, outcomes, and the SLA INTERLIGENS holds itself to.",
};

const SLA_PILLARS = TAKEDOWN_SLA.map((s) => ({
  label: s.label,
  title: s.metric,
  body: s.detail,
}));

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
    title: "Charter",
    meta: ["Reader-side discipline", "How to read a verdict"],
    status: "Reader guide",
    href: "/charter",
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
    title: "Cases",
    meta: ["Published investigations", "Browse the ledger"],
    status: "Published",
    href: "/cases",
  },
];

export default function TakedownPage() {
  return (
    <>
      <ClassificationBar
        ctx={MOCK_CLASSIFICATION}
        statusLabel="TAKEDOWN · CHANNEL ACTIVE"
      />
      <Masthead />

      <main>
        <div className="fx-container">
          <Breadcrumb
            trail={[{ href: "/", label: "Home" }, { label: "Takedown" }]}
          />
          <div style={{ padding: "48px 0 32px" }}>
            <SectionHead
              kicker={TAKEDOWN_HERO.kicker}
              title={TAKEDOWN_HERO.title}
              dek={TAKEDOWN_HERO.dek}
            />
          </div>

          {TAKEDOWN_SECTIONS.map((s) => (
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
                      style={{
                        paddingLeft: 16,
                        position: "relative",
                      }}
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

        <StandardPillars pillars={SLA_PILLARS} />

        {/*
          Future filing form lands here. Keep this comment as the
          placement marker — no live <form> until the backend route
          (/api/takedown) is wired and queue + audit are in place.
          Today the takedown@ address is the single channel.
        */}
        <div
          className="fx-container"
          style={{ padding: "32px 0 0" }}
          aria-label="Filing channel"
        >
          <div
            style={{
              border: "1px solid var(--rule)",
              padding: "24px",
              background: "var(--ink-raised)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily:
                  "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--signal)",
              }}
            >
              Filing address
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-display, 'Gambarino'), 'General Sans', serif",
                fontSize: 28,
                lineHeight: 1.2,
                color: "var(--bone)",
                wordBreak: "break-word",
              }}
            >
              <a
                href={`mailto:${TAKEDOWN_CONTACT}`}
                style={{ color: "var(--bone)", textDecoration: "none" }}
              >
                {TAKEDOWN_CONTACT}
              </a>
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
                fontSize: 13,
                color: "var(--bone-dim)",
                lineHeight: 1.5,
              }}
            >
              From a verifiable address. Include the artifacts described
              under section 02. Acknowledged within 72 hours.
            </div>
          </div>
        </div>

        <div className="fx-container" style={{ padding: "32px 0 64px" }}>
          <SectionHead
            kicker="CROSS-LINKS"
            title="Adjacent discipline."
            dek="The takedown channel sits inside the broader editorial discipline. The methodology defines the standard a filing tests; the charter governs how a reader interprets the outcome."
          />
          <CrossLinksGrid links={CROSS_LINKS} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
