// ─── MmSourceCard ─────────────────────────────────────────────────────────
// Renders a single MmSource with its credibility tier + archival status.
// Links open in a new tab with rel=noopener.

import type {
  MmArchivalStatus,
  MmCredTier,
  MmSourceType,
} from "@prisma/client";

interface SourceLike {
  id: string;
  publisher: string;
  title: string;
  url: string;
  sourceType: MmSourceType;
  credibilityTier: MmCredTier;
  archivalStatus: MmArchivalStatus;
  archivedUrl: string | null;
  publishedAt: Date | string | null;
  author?: string | null;
}

const TIER_PALETTE: Record<MmCredTier, { bg: string; fg: string; label: string }> = {
  TIER_1: { bg: "#14532D", fg: "#D1FAE5", label: "TIER 1 · OFFICIAL" },
  TIER_2: { bg: "#713F12", fg: "#FEF3C7", label: "TIER 2 · PRESS" },
  TIER_3: { bg: "#1F2937", fg: "#9CA3AF", label: "TIER 3 · OSINT" },
};

const ARCHIVAL_COPY: Record<MmArchivalStatus, string> = {
  PENDING: "Archival pending",
  SUCCESS: "Archived",
  WAYBACK_FAIL: "Archived (Wayback failed — R2 OK)",
  R2_FAIL: "Archival failed",
  RETRY: "Archival retry scheduled",
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function MmSourceCard({ source }: { source: SourceLike }) {
  const tier = TIER_PALETTE[source.credibilityTier];
  return (
    <article
      data-testid={`mm-source-${source.id}`}
      style={{
        border: "1px solid #222222",
        background: "#0A0A0A",
        padding: 16,
        borderRadius: 2,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 900,
            background: tier.bg,
            color: tier.fg,
            borderRadius: 2,
          }}
        >
          {tier.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#888",
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {source.sourceType.replace(/_/g, " ")}
        </span>
        {source.publishedAt ? (
          <span style={{ fontSize: 11, color: "#666" }}>
            {fmtDate(source.publishedAt)}
          </span>
        ) : null}
      </div>

      <div
        style={{
          color: "#CCCCCC",
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {source.publisher}
        {source.author ? ` · ${source.author}` : ""}
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#FFFFFF",
          fontSize: 15,
          lineHeight: 1.5,
          textDecoration: "underline",
          textDecorationColor: "#FF6B00",
        }}
      >
        {source.title}
      </a>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#666",
          letterSpacing: 0.5,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span>{ARCHIVAL_COPY[source.archivalStatus]}</span>
        {source.archivedUrl ? (
          <a
            href={source.archivedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#FF6B00" }}
          >
            Wayback snapshot
          </a>
        ) : null}
      </div>
    </article>
  );
}
