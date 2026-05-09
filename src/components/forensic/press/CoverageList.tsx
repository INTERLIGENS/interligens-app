/**
 * CoverageList — definition-table of external coverage entries.
 *
 * Mirrors the ImprintBlock grammar: pending entries (TO_FILL) are
 * rendered with the orange signal / mono caps treatment so the page
 * cannot ship to production with placeholders still in place. When an
 * entry is real, the title links out to the publication.
 */

import type { CoverageEntry } from "@/lib/mocks/press";

export function CoverageList({ entries }: { entries: CoverageEntry[] }) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderBottom: "none",
        background: "var(--ink-raised)",
      }}
    >
      {entries.map((e, i) => (
        <CoverageRow key={i} entry={e} />
      ))}
    </div>
  );
}

function CoverageRow({ entry }: { entry: CoverageEntry }) {
  const pendingStyle = {
    fontFamily:
      "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
    fontSize: 12,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: "var(--signal)",
  };
  const realBodyStyle = {
    fontFamily:
      "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
    fontSize: 14,
    color: "var(--bone)",
    lineHeight: 1.5,
  };
  const realMetaStyle = {
    fontFamily:
      "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "var(--bone-dim)",
  };

  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, 220px) minmax(120px, 160px) 1fr",
        columnGap: 24,
        rowGap: 8,
        padding: "20px 24px",
        borderBottom: "1px solid var(--rule)",
        alignItems: "baseline",
      }}
    >
      <div style={entry.pending ? pendingStyle : realMetaStyle}>
        {entry.outlet}
      </div>
      <div style={entry.pending ? pendingStyle : realMetaStyle}>
        {entry.date}
      </div>
      <div style={entry.pending ? pendingStyle : realBodyStyle}>
        {entry.pending ? (
          entry.title
        ) : (
          <a
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--bone)", textDecoration: "underline" }}
          >
            {entry.title}
          </a>
        )}
      </div>
    </article>
  );
}
