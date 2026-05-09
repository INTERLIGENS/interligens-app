/**
 * GuardScenarioGrid — four scenes Guard intercepts before the
 * signature.
 *
 * Two-up at desktop, single column at mobile. Each cell pairs a
 * mocked verdict panel (GuardMockPanel) with a short editorial gloss.
 * The mock is the artifact, the gloss is the reading. No marketing
 * voice; this is a producer-side description of what is read and what
 * is referenced.
 */

import type { GuardScenario } from "@/lib/mocks/guard";
import { GuardMockPanel } from "./GuardMockPanel";

const VARIANT_FOR_INDEX: Array<"approval" | "honeypot" | "kol" | "signature"> = [
  "approval",
  "honeypot",
  "kol",
  "signature",
];

export function GuardScenarioGrid({
  scenarios,
}: {
  scenarios: GuardScenario[];
}) {
  return (
    <section
      aria-label="What Guard sees"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 24,
      }}
    >
      {scenarios.map((s, i) => {
        const toneColor =
          s.tone === "risk"
            ? "var(--risk)"
            : s.tone === "caution"
            ? "var(--caution)"
            : "var(--signal)";
        return (
          <article
            key={s.num}
            style={{
              border: "1px solid var(--rule)",
              background: "var(--ink-sunken)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontFamily:
                  "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: "var(--bone-dim)" }}>{s.num}</span>
              <span style={{ color: toneColor }}>{s.tag}</span>
            </header>

            <h3
              style={{
                fontFamily:
                  "var(--font-display, 'Gambarino'), 'General Sans', serif",
                fontSize: 22,
                lineHeight: 1.22,
                letterSpacing: "-0.01em",
                color: "var(--bone)",
                margin: 0,
              }}
            >
              {s.title}
            </h3>

            <p
              style={{
                fontFamily:
                  "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--bone-soft)",
                margin: 0,
              }}
            >
              {s.body}
            </p>

            <GuardMockPanel variant={VARIANT_FOR_INDEX[i] ?? "approval"} />

            <div
              style={{
                fontFamily:
                  "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--bone-dim)",
                paddingTop: 4,
                borderTop: "1px solid var(--rule)",
              }}
            >
              <span style={{ color: "var(--bone-dim)" }}>SIGNAL · </span>
              <span style={{ color: "var(--bone-soft)" }}>{s.signal}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
