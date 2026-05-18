// ─── MmClaimBlock ─────────────────────────────────────────────────────────
// Renders a single claim with a type glyph, the text (FR or EN), and an
// inline attribution to its source.

import type { MmClaimType } from "@prisma/client";

interface SourceSummary {
  publisher: string;
  title: string;
  url: string;
}

interface ClaimLike {
  id: string;
  claimType: MmClaimType;
  text: string;
  textFr: string | null;
  jurisdiction: string | null;
  source: SourceSummary;
}

const GLYPH: Record<MmClaimType, { icon: string; label: string; color: string }> = {
  FACT: { icon: "✓", label: "FACT", color: "#4ADE80" },
  ALLEGATION: { icon: "!", label: "ALLEGATION", color: "#F59E0B" },
  INFERENCE: { icon: "◈", label: "INFERENCE", color: "#A78BFA" },
  RESPONSE: { icon: "↩", label: "RESPONSE", color: "#FF6B00" },
};

export function MmClaimBlock({
  claim,
  locale = "fr",
}: {
  claim: ClaimLike;
  locale?: "fr" | "en";
}) {
  const g = GLYPH[claim.claimType];
  const text = locale === "fr" && claim.textFr ? claim.textFr : claim.text;

  return (
    <div
      data-testid={`mm-claim-${claim.id}`}
      data-claim-type={claim.claimType}
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        padding: "16px 0",
        borderTop: "1px solid #1A1A1A",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 2,
          border: `1px solid ${g.color}`,
          color: g.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 900,
          background: "#0A0A0A",
        }}
        aria-label={g.label}
      >
        {g.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2.5,
            fontWeight: 900,
            textTransform: "uppercase",
            color: g.color,
            marginBottom: 6,
          }}
        >
          {g.label}
          {claim.jurisdiction ? ` · ${claim.jurisdiction}` : ""}
        </div>
        <p
          style={{
            color: "#E5E5E5",
            lineHeight: 1.65,
            fontSize: 15,
            margin: 0,
          }}
        >
          {text}
        </p>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <a
            href={claim.source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#FF6B00",
              textDecoration: "none",
              letterSpacing: 0.5,
            }}
          >
            → {claim.source.publisher}: {claim.source.title}
          </a>
        </div>
      </div>
    </div>
  );
}
