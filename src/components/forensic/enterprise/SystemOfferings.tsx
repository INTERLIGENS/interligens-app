/**
 * SystemOfferings — five-cell horizontal ledger of the surfaces the
 * system exposes to a structured reader.
 *
 * Differs from AudienceGrid by leaning on a wider, lower-density row
 * grammar: number on the left, kicker / title / body on the right.
 * Readable as a list rather than a grid. Same colour discipline — mono
 * caps in signal-orange for the kicker, Gambarino for the title, dim
 * sans for the body.
 */

import type { SystemOffering } from "@/lib/mocks/enterprise";

export function SystemOfferings({
  offerings,
}: {
  offerings: SystemOffering[];
}) {
  return (
    <section
      aria-label="System offerings"
      style={{
        border: "1px solid var(--rule)",
        borderBottom: "none",
        background: "var(--ink-raised)",
      }}
    >
      {offerings.map((o) => (
        <article
          key={o.num}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(56px, 88px) minmax(0, 1fr)",
            columnGap: 24,
            padding: "24px",
            borderBottom: "1px solid var(--rule)",
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontFamily:
                "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
              fontSize: 13,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--bone-dim)",
            }}
          >
            {o.num}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              {o.kicker}
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
              {o.title}
            </h3>
            <p
              style={{
                fontFamily:
                  "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--bone-soft)",
                margin: 0,
                maxWidth: 760,
              }}
            >
              {o.body}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
