/**
 * AssetsList — definition-table of press assets.
 *
 * Each asset has a label, a one-line detail, and a release status. We
 * release assets on request rather than expose static download links
 * so we can confirm context of use and revoke superseded versions.
 * The status pill ("ON REQUEST") signals to a journalist that the
 * absence of a click target is intentional, not broken.
 */

import type { PressAsset } from "@/lib/mocks/press";

export function AssetsList({
  assets,
  contactEmail,
}: {
  assets: PressAsset[];
  contactEmail: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderBottom: "none",
        background: "var(--ink-raised)",
      }}
    >
      {assets.map((a, i) => (
        <AssetRow key={i} asset={a} contactEmail={contactEmail} />
      ))}
    </div>
  );
}

function AssetRow({
  asset,
  contactEmail,
}: {
  asset: PressAsset;
  contactEmail: string;
}) {
  const statusLabel =
    asset.availability === "request" ? "ON REQUEST" : "INTERNAL";
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 240px) 1fr minmax(120px, 160px)",
        columnGap: 24,
        rowGap: 6,
        padding: "20px 24px",
        borderBottom: "1px solid var(--rule)",
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontFamily:
            "var(--font-display, 'Gambarino'), 'General Sans', serif",
          fontSize: 18,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          color: "var(--bone)",
        }}
      >
        {asset.label}
      </div>
      <div
        style={{
          fontFamily:
            "var(--font-body, 'General Sans'), var(--font-inter), system-ui, sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--bone-soft)",
        }}
      >
        {asset.detail}
      </div>
      <div
        style={{
          fontFamily:
            "var(--font-mono, 'JetBrains Mono'), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:
            asset.availability === "request"
              ? "var(--signal)"
              : "var(--bone-dim)",
          textAlign: "right",
        }}
      >
        {asset.availability === "request" ? (
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(
              `Asset request — ${asset.label}`,
            )}`}
            style={{ color: "var(--signal)", textDecoration: "none" }}
          >
            {statusLabel}
          </a>
        ) : (
          statusLabel
        )}
      </div>
    </article>
  );
}
