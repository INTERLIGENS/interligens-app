/**
 * EngagementModes — four sober ways to start a conversation.
 *
 * One mailto action per mode. No pricing, no "book a demo", no contract
 * implied. The action label is constrained at the type level
 * (request access / open a conversation / introduce your team /
 * share your context). Each mode renders a single mailto chip with a
 * pre-filled subject hint so the address handler can route quickly.
 *
 * Visually: bordered cells like AudienceGrid, but each cell carries
 * its own action — mailto link styled as a sober chip, not a button.
 */

import type { EngagementMode } from "@/lib/mocks/enterprise";

export function EngagementModes({
  modes,
  contactEmail,
}: {
  modes: EngagementMode[];
  contactEmail: string;
}) {
  return (
    <section
      aria-label="Modes of engagement"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        borderTop: "1px solid var(--rule)",
        borderLeft: "1px solid var(--rule)",
        background: "var(--ink)",
      }}
    >
      {modes.map((m) => (
        <article
          key={m.num}
          style={{
            borderRight: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "space-between",
            minHeight: 280,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              <span style={{ color: "var(--bone-dim)" }}>{m.num} ·</span>{" "}
              {m.kicker}
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
              {m.title}
            </h3>
            <p
              style={{
                fontFamily:
                  "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--bone-soft)",
                margin: 0,
              }}
            >
              {m.body}
            </p>
          </div>
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(m.subjectHint)}`}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              border: "1px solid var(--rule)",
              color: "var(--bone)",
              textDecoration: "none",
              fontFamily:
                "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "var(--ink-raised)",
            }}
          >
            <span>{m.actionLabel}</span>
            <span aria-hidden style={{ color: "var(--signal)" }}>
              →
            </span>
          </a>
        </article>
      ))}
    </section>
  );
}
