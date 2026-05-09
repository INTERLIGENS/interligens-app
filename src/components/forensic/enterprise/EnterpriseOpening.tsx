/**
 * EnterpriseOpening — institutional opening block for /enterprise.
 *
 * Mirrors the SectionFrame grammar (mono kicker, Gambarino title, dim
 * body) but adds a quiet right-rail with a one-line context note that
 * grounds the page as institutional, not commercial. No accent
 * decoration beyond the existing rule lines and signal-orange kicker.
 */

import type { EnterpriseSection } from "@/lib/mocks/enterprise";

export function EnterpriseOpening({
  section,
  note,
}: {
  section: EnterpriseSection;
  note?: string;
}) {
  return (
    <section
      id={section.id}
      aria-label="Enterprise opening"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr)",
        gap: 32,
        padding: "32px 0",
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {section.kicker}
        </div>
        <h2
          style={{
            fontFamily:
              "var(--font-display, 'Gambarino'), 'General Sans', serif",
            fontSize: 32,
            lineHeight: 1.18,
            letterSpacing: "-0.015em",
            color: "var(--bone)",
            margin: 0,
            maxWidth: 720,
          }}
        >
          {section.title}
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            color: "var(--bone-soft)",
            fontFamily:
              "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
            fontSize: 15,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          {section.body
            .split("\n")
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} style={{ margin: 0 }}>
                {p}
              </p>
            ))}
        </div>
      </div>
      {note && (
        <aside
          aria-label="Institutional posture"
          style={{
            borderLeft: "1px solid var(--rule)",
            paddingLeft: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily:
                "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--bone-dim)",
            }}
          >
            POSTURE
          </div>
          <p
            style={{
              margin: 0,
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--bone-dim)",
            }}
          >
            {note}
          </p>
        </aside>
      )}
    </section>
  );
}
