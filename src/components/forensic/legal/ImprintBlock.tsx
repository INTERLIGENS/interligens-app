/**
 * LCEN imprint table — discipline page only.
 *
 * Renders a definition-list of regulatory imprint fields. Entries
 * flagged `pending` are styled to be VISUALLY OBVIOUS (orange signal,
 * mono caps) so a reviewer cannot ship the page to production with
 * placeholders still in place.
 */

import type { ImprintEntry } from "@/lib/mocks/legal";

export function ImprintBlock({ entries }: { entries: ImprintEntry[] }) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 280px) 1fr",
        rowGap: 0,
        columnGap: 24,
        margin: 0,
        border: "1px solid var(--rule)",
        borderBottom: "none",
        background: "var(--ink-raised)",
      }}
    >
      {entries.map((e) => (
        <ImprintRow key={e.label} entry={e} />
      ))}
    </dl>
  );
}

function ImprintRow({ entry }: { entry: ImprintEntry }) {
  return (
    <>
      <dt
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--rule)",
          fontFamily:
            "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--bone-dim)",
          background: "var(--ink-sunken)",
        }}
      >
        {entry.label}
      </dt>
      <dd
        style={{
          margin: 0,
          padding: "16px 24px",
          borderBottom: "1px solid var(--rule)",
          fontFamily: entry.pending
            ? "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace"
            : "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
          fontSize: entry.pending ? 12 : 14,
          letterSpacing: entry.pending ? "0.10em" : "normal",
          textTransform: entry.pending ? "uppercase" : "none",
          color: entry.pending ? "var(--signal)" : "var(--bone)",
          lineHeight: 1.5,
        }}
      >
        {entry.value}
      </dd>
    </>
  );
}
