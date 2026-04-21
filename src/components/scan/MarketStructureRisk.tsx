"use client";

import { useState } from "react";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";
import type { MmDetectorType } from "@/lib/mm/types";

type Locale = "en" | "fr";

interface Props {
  result: MmRiskAssessment | null;
  locale?: Locale;
}

// Band → outline color. Orange matches the INTERLIGENS accent.
const BAND_COLOR: Record<string, string> = {
  GREEN: "#10b981",
  YELLOW: "#f59e0b",
  ORANGE: "#FF6B00",
  RED: "#ef4444",
};

// Severity → badge border color.
const SEVERITY_BORDER: Record<string, string> = {
  HIGH: "rgba(239,68,68,0.55)",
  MEDIUM: "rgba(255,107,0,0.55)",
  LOW: "rgba(245,158,11,0.55)",
  CRITICAL: "rgba(239,68,68,0.75)",
};

const SEVERITY_TEXT: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#FF6B00",
  LOW: "#f59e0b",
  CRITICAL: "#ef4444",
};

// Copy — deliberately avoids "manipulated / fraud / confirmed" language.
const DETECTOR_LABELS: Record<MmDetectorType, { en: string; fr: string }> = {
  WASH_TRADING: {
    en: "Wash trading signals",
    fr: "Signaux de wash trading",
  },
  CLUSTER_COORDINATION: {
    en: "Coordinated wallet cluster",
    fr: "Cluster de wallets coordonnés",
  },
  CONCENTRATION_ABNORMALITY: {
    en: "Abnormal volume concentration",
    fr: "Concentration de volume anormale",
  },
  FAKE_LIQUIDITY: {
    en: "Fake liquidity detected",
    fr: "Fausse liquidité détectée",
  },
  PRICE_ASYMMETRY: {
    en: "Price asymmetry",
    fr: "Asymétrie de prix",
  },
  POST_LISTING_PUMP: {
    en: "Post-listing pump pattern",
    fr: "Pattern de pump post-listing",
  },
  KNOWN_ENTITY_FLOOR: {
    en: "Known-entity floor",
    fr: "Plancher d'entité connue",
  },
};

const BASE_DISCLAIMER = {
  en: "Behavioral signals detected on this token's market activity. This analysis describes observed on-chain patterns (volume, concentration, coordination), not an attribution to any specific entity.",
  fr: "Signaux comportementaux détectés sur l'activité de marché de ce token. Cette analyse décrit des patterns on-chain observés (volume, concentration, coordination), pas une attribution à une entité spécifique.",
};

const PARTIAL_DISCLAIMER = {
  en: "Partial analysis — limited data or history.",
  fr: "Analyse partielle — données ou historique limités.",
};

const TITLE = {
  en: "Market Structure Risk",
  fr: "Risque de Structure de Marché",
};

const DETAIL_LABELS = {
  confidence: { en: "Confidence", fr: "Confiance" },
  coverage: { en: "Coverage", fr: "Couverture" },
  freshness: { en: "Data age", fr: "Fraîcheur" },
  dominantDriver: { en: "Dominant driver", fr: "Driver dominant" },
  detectorScore: { en: "Detector scores", fr: "Scores par détecteur" },
  expandOpen: { en: "View details", fr: "Voir les détails" },
  expandClose: { en: "Hide details", fr: "Masquer les détails" },
};

function bandColor(band: string): string {
  return BAND_COLOR[band] ?? BAND_COLOR.GREEN;
}

function freshnessText(ageMinutes: number, locale: Locale): string {
  if (ageMinutes < 60) {
    return locale === "fr" ? `${ageMinutes} min` : `${ageMinutes}m ago`;
  }
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) {
    return locale === "fr" ? `${hours} h` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return locale === "fr" ? `${days} j` : `${days}d ago`;
}

/**
 * Pick up to `limit` detector badges from the breakdown, in descending score
 * order. Only detectors with a non-null, non-zero score surface.
 */
function topDetectors(
  result: MmRiskAssessment,
  limit: number,
): { type: MmDetectorType; score: number; severity: string }[] {
  const b = result.engine.detectorBreakdown;
  const rows: { type: MmDetectorType; score: number; severity: string }[] = [];

  const entries: Array<[MmDetectorType, { score: number } | null]> = [
    ["WASH_TRADING", b.washTrading],
    ["CLUSTER_COORDINATION", b.cluster],
    ["CONCENTRATION_ABNORMALITY", b.concentration],
    ["FAKE_LIQUIDITY", b.fakeLiquidity],
    ["PRICE_ASYMMETRY", b.priceAsymmetry],
    ["POST_LISTING_PUMP", b.postListingPump],
  ];

  for (const [type, output] of entries) {
    if (!output || output.score <= 0) continue;
    const severity =
      output.score >= 60 ? "HIGH" : output.score >= 30 ? "MEDIUM" : "LOW";
    rows.push({ type, score: output.score, severity });
  }

  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

export default function MarketStructureRisk({ result, locale = "en" }: Props) {
  const [open, setOpen] = useState(false);

  if (!result) return null;

  const { overall, engine } = result;
  const { displayScore, band, freshness } = overall;

  // Hide the block entirely when there's nothing meaningful to surface.
  // GPT-architect gate: render ONLY when displayScore >= 20 AND at least
  // one detector fired with a non-zero score. Anything quieter would
  // produce an accusatory empty state ("no manipulation detected"),
  // which is explicitly forbidden UX.
  const signals = topDetectors(result, 5);
  if (displayScore < 20 || band === "GREEN" || signals.length === 0) {
    return null;
  }

  const color = bandColor(band);
  const isPartial =
    engine.coverage === "low" || freshness.staleness === "stale";

  return (
    <section
      aria-label={TITLE[locale]}
      style={{
        background: "#000000",
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: "16px 18px",
        color: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        {/* Score circle */}
        <div
          aria-label={`${TITLE[locale]} — ${displayScore}/100`}
          style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            background: `${color}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {displayScore}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.15em",
              color: "#FF6B00",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            INTERLIGENS · MM Pattern Engine
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.3,
            }}
          >
            {TITLE[locale]}
          </h3>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {BASE_DISCLAIMER[locale]}
            {isPartial && (
              <>
                {" "}
                <span style={{ color: "#f59e0b" }}>
                  {PARTIAL_DISCLAIMER[locale]}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Signal badges */}
      {signals.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 14,
          }}
        >
          {signals.map((s) => {
            const labels = DETECTOR_LABELS[s.type];
            return (
              <span
                key={s.type}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  border: `1px solid ${SEVERITY_BORDER[s.severity] ?? SEVERITY_BORDER.MEDIUM}`,
                  background: "rgba(255,255,255,0.03)",
                  color: SEVERITY_TEXT[s.severity] ?? "#FFFFFF",
                  borderRadius: 999,
                  letterSpacing: "0.02em",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: SEVERITY_TEXT[s.severity] ?? "#FFFFFF",
                    flexShrink: 0,
                  }}
                />
                {labels[locale]}
              </span>
            );
          })}
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          marginTop: 14,
          background: "transparent",
          border: "none",
          color: "#FF6B00",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open
          ? DETAIL_LABELS.expandClose[locale]
          : DETAIL_LABELS.expandOpen[locale]}{" "}
        {open ? "▴" : "▾"}
      </button>

      {/* Expanded details */}
      {open && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            fontSize: 12,
          }}
        >
          <MetaRow
            label={DETAIL_LABELS.confidence[locale]}
            value={engine.confidence.toUpperCase()}
          />
          <MetaRow
            label={DETAIL_LABELS.coverage[locale]}
            value={engine.coverage.toUpperCase()}
          />
          <MetaRow
            label={DETAIL_LABELS.freshness[locale]}
            value={freshnessText(freshness.ageMinutes, locale)}
          />
          <MetaRow
            label={DETAIL_LABELS.dominantDriver[locale]}
            value={overall.dominantDriver}
          />
          <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 6,
              }}
            >
              {DETAIL_LABELS.detectorScore[locale]}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 6,
                fontFamily:
                  "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
              }}
            >
              {(
                [
                  ["WASH_TRADING", engine.detectorBreakdown.washTrading],
                  ["CLUSTER_COORDINATION", engine.detectorBreakdown.cluster],
                  ["CONCENTRATION_ABNORMALITY", engine.detectorBreakdown.concentration],
                  ["FAKE_LIQUIDITY", engine.detectorBreakdown.fakeLiquidity],
                  ["PRICE_ASYMMETRY", engine.detectorBreakdown.priceAsymmetry],
                  ["POST_LISTING_PUMP", engine.detectorBreakdown.postListingPump],
                ] as const
              ).map(([type, output]) => (
                <div
                  key={type}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    color: output
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.25)",
                  }}
                >
                  <span style={{ fontSize: 11 }}>
                    {DETECTOR_LABELS[type][locale]}
                  </span>
                  <span style={{ fontSize: 11 }}>{output?.score ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#FFFFFF",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
        }}
      >
        {value}
      </span>
    </div>
  );
}
