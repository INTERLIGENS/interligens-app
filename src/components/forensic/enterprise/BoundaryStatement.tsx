/**
 * BoundaryStatement — the public / private boundary block.
 *
 * Two-column institutional statement: left column states the public
 * surface (what is on the record), right column states the deeper
 * surface (what is not, and why it is not exposed publicly). The
 * accent on both is signal-orange — both are the same posture, read
 * from two angles. No "private", "internal-only", "behind a paywall"
 * marketing language; the back-office is not described.
 */

import type { EnterpriseSection } from "@/lib/mocks/enterprise";

export function BoundaryStatement({
  section,
  publicLines,
  deeperLines,
}: {
  section: EnterpriseSection;
  publicLines: string[];
  deeperLines: string[];
}) {
  return (
    <section
      id={section.id}
      aria-label="Public and deeper surfaces"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            fontSize: 28,
            lineHeight: 1.2,
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
            fontSize: 14,
            lineHeight: 1.65,
            maxWidth: 760,
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          border: "1px solid var(--rule)",
          background: "var(--ink-raised)",
        }}
      >
        <BoundaryColumn
          kicker="ON THE PUBLIC RECORD"
          title="The artifact, fully exposed."
          lines={publicLines}
          divider
        />
        <BoundaryColumn
          kicker="DEEPER SURFACE"
          title="Not on this page."
          lines={deeperLines}
        />
      </div>
    </section>
  );
}

function BoundaryColumn({
  kicker,
  title,
  lines,
  divider,
}: {
  kicker: string;
  title: string;
  lines: string[];
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "28px 24px",
        borderRight: divider ? "1px solid var(--rule)" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 14,
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
        {kicker}
      </div>
      <h3
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: 22,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: "var(--bone)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {lines.map((l, i) => (
          <li
            key={i}
            style={{
              paddingLeft: 18,
              position: "relative",
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--bone-soft)",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: "0.55em",
                width: 8,
                height: 1,
                background: "var(--signal)",
              }}
            />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
