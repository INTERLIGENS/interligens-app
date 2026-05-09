/**
 * GuardDifferenceTable — four side-by-side rows comparing generic
 * wallet-scanner posture (left, dim) with Phantom Guard's posture
 * (right, in line with the editorial standard).
 *
 * Not a marketing comparison table. Reads as a producer-side
 * statement of category — Guard is not in the same category as a
 * generic wallet scanner.
 */

import type { GuardDifferencePoint } from "@/lib/mocks/guard";

export function GuardDifferenceTable({
  points,
}: {
  points: GuardDifferencePoint[];
}) {
  return (
    <section
      aria-label="Why Guard is not a wallet scanner"
      style={{
        border: "1px solid var(--rule)",
        background: "var(--ink-raised)",
      }}
    >
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(56px, 88px) minmax(0, 1fr) minmax(0, 1fr)",
          columnGap: 24,
          padding: "16px 24px",
          borderBottom: "1px solid var(--rule)",
          fontFamily:
            "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bone-dim)",
        }}
      >
        <span>NUM</span>
        <span>GENERIC WALLET SCANNERS</span>
        <span style={{ color: "var(--signal)" }}>PHANTOM GUARD</span>
      </header>
      {points.map((p, i) => (
        <article
          key={p.num}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(56px, 88px) minmax(0, 1fr) minmax(0, 1fr)",
            columnGap: 24,
            padding: "20px 24px",
            borderBottom:
              i === points.length - 1 ? "none" : "1px solid var(--rule)",
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
            {p.num}
          </div>
          <p
            style={{
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--bone-dim)",
              margin: 0,
            }}
          >
            {p.generic}
          </p>
          <p
            style={{
              fontFamily:
                "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--bone)",
              margin: 0,
            }}
          >
            {p.guard}
          </p>
        </article>
      ))}
    </section>
  );
}
