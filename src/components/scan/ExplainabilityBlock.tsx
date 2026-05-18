// ─── ExplainabilityBlock ──────────────────────────────────────────────────
// The retail-facing surface for a hardened TigerScore. When a manually-set
// governed status is present and not "none" it takes precedence visually:
// rendered as a dominant alert box above the numeric score.
//
// Design rules (hardening Ticket 5):
//   • Governed alert box comes FIRST, visually bigger than the number.
//   • Score + tier + confidence stay visible but secondary.
//   • Top 3 reasons with Observed / Inferred badges.
//   • "What this means" → one sentence.
//   • "What could change" → one sentence.
//   • Engine version + disclaimer pinned at the bottom.
//   • No cyan, no pastel gradients — INTERLIGENS palette only.

import type { TigerDriver, TigerTier } from "@/lib/tigerscore/engine";
import type { ConfidenceLevel } from "@/lib/tigerscore/confidence";
import type { ProvenanceKind } from "@/lib/tigerscore/provenance";

export interface ExplainabilityBlockProps {
  score: number;
  tier: TigerTier;
  confidence: ConfidenceLevel;
  /** Up to 5. We render the first 3 in the top-reasons list. */
  topReasons: TigerDriver[];
  /**
   * Per-driver provenance badges. Missing entries are rendered as
   * "inferred" by default.
   */
  provenanceByDriver?: Record<string, ProvenanceKind>;
  /** Manual governed status, when set. */
  governedStatus?: {
    status:
      | "none"
      | "watchlisted"
      | "suspected"
      | "corroborated_high_risk"
      | "confirmed_known_bad"
      | "authority_flagged";
    reason?: string | null;
    basisLabel?: string | null;
  } | null;
  version: string;
  locale?: "fr" | "en";
  showScore?: boolean;
}

const TIER_COLOR: Record<TigerTier, string> = {
  GREEN: "#22C55E",
  ORANGE: "#F59E0B",
  RED: "#EF4444",
};

const GOVERNED_HEADLINE: Record<
  NonNullable<ExplainabilityBlockProps["governedStatus"]>["status"],
  { fr: string; en: string; severity: "maximum" | "high" | "medium" | "low" | "none" }
> = {
  none: { fr: "", en: "", severity: "none" },
  watchlisted: {
    fr: "Sous surveillance",
    en: "Watchlisted",
    severity: "low",
  },
  suspected: { fr: "Suspecté", en: "Suspected", severity: "medium" },
  corroborated_high_risk: {
    fr: "Risque élevé corroboré",
    en: "Corroborated high risk",
    severity: "high",
  },
  confirmed_known_bad: {
    fr: "Acteur malveillant confirmé",
    en: "Confirmed known bad",
    severity: "maximum",
  },
  authority_flagged: {
    fr: "Signalé par source d'autorité",
    en: "Authority-flagged",
    severity: "maximum",
  },
};

const GOV_PALETTE: Record<
  "maximum" | "high" | "medium" | "low",
  { bg: string; border: string; text: string; badge: string }
> = {
  maximum: {
    bg: "rgba(239, 68, 68, 0.12)",
    border: "#7F1D1D",
    text: "#FCA5A5",
    badge: "#991B1B",
  },
  high: {
    bg: "rgba(249, 115, 22, 0.10)",
    border: "#7C2D12",
    text: "#FED7AA",
    badge: "#9A3412",
  },
  medium: {
    bg: "rgba(234, 179, 8, 0.08)",
    border: "#713F12",
    text: "#FEF3C7",
    badge: "#854D0E",
  },
  low: {
    bg: "rgba(148, 163, 184, 0.06)",
    border: "#334155",
    text: "#E2E8F0",
    badge: "#475569",
  },
};

const COPY = {
  fr: {
    confidence: "Confiance",
    topReasons: "Raisons principales",
    observed: "Observé",
    inferred: "Inféré",
    corroborated: "Corroboré",
    whatItMeans: "Ce que cela veut dire",
    whatCouldChange: "Ce qui pourrait faire évoluer le score",
    version: "Moteur",
  },
  en: {
    confidence: "Confidence",
    topReasons: "Top reasons",
    observed: "Observed",
    inferred: "Inferred",
    corroborated: "Corroborated",
    whatItMeans: "What this means",
    whatCouldChange: "What could change",
    version: "Engine",
  },
};

export function ExplainabilityBlock(props: ExplainabilityBlockProps) {
  const locale = props.locale ?? "fr";
  const copy = COPY[locale];
  const tierColor = TIER_COLOR[props.tier];
  const gov = props.governedStatus;
  const isDominant = gov && gov.status !== "none";
  const showScore = props.showScore !== false;

  return (
    <section
      data-testid="explainability-block"
      data-tier={props.tier}
      data-confidence={props.confidence}
      style={{
        background: "#000000",
        color: "#FFFFFF",
        borderRadius: 4,
        padding: 0,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {isDominant ? (
        <GovernedAlert gov={gov} locale={locale} />
      ) : null}

      <div
        style={{
          padding: 18,
          background: isDominant ? "#050505" : "#000000",
          border: `1px solid ${isDominant ? "#1A1A1A" : "#222"}`,
          borderRadius: 4,
          marginTop: isDominant ? 14 : 0,
        }}
      >
        {showScore && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  data-testid="tiger-score-value"
                  style={{
                    fontSize: isDominant ? 40 : 52,
                    fontWeight: 900,
                    color: tierColor,
                    letterSpacing: -1,
                    lineHeight: 1,
                  }}
                >
                  {Math.max(0, Math.min(100, Math.round(props.score)))}
                </span>
                <span
                  data-testid="tiger-score-tier"
                  style={{
                    fontSize: 13,
                    letterSpacing: 3,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: tierColor,
                  }}
                >
                  {props.tier}
                </span>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#888",
                  letterSpacing: 2,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {copy.confidence}:{" "}
                <span data-testid="confidence-level" style={{ color: "#FFFFFF" }}>
                  {props.confidence}
                </span>
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: 10,
                color: "#555",
                letterSpacing: 1,
              }}
            >
              <div>
                {copy.version}{" "}
                <code
                  data-testid="engine-version"
                  style={{ color: "#FF6B00", fontSize: 10 }}
                >
                  v{props.version}
                </code>
              </div>
            </div>
          </div>
        )}

        <TopReasons
          topReasons={props.topReasons.slice(0, 3)}
          provenanceByDriver={props.provenanceByDriver}
          locale={locale}
        />

        <MeaningAndNext
          tier={props.tier}
          confidence={props.confidence}
          locale={locale}
          copy={copy}
        />
      </div>

      <Disclaimer locale={locale} />
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function GovernedAlert({
  gov,
  locale,
}: {
  gov: NonNullable<ExplainabilityBlockProps["governedStatus"]>;
  locale: "fr" | "en";
}) {
  const head = GOVERNED_HEADLINE[gov.status];
  const severity = head.severity === "none" ? "low" : head.severity;
  const p = GOV_PALETTE[severity];

  return (
    <div
      data-testid="governed-alert"
      data-governed-status={gov.status}
      style={{
        padding: 20,
        background: p.bg,
        border: `2px solid ${p.border}`,
        borderRadius: 4,
        color: p.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          aria-hidden
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: p.text,
          }}
        >
          {head.severity === "maximum" ? "■" : "▲"}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 3,
            fontWeight: 900,
            textTransform: "uppercase",
            padding: "4px 10px",
            background: p.badge,
            borderRadius: 2,
          }}
        >
          {locale === "fr" ? "Statut gouverné" : "Governed status"}
        </span>
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: -0.3,
          color: "#FFFFFF",
        }}
      >
        {head[locale]}
      </div>
      {gov.reason ? (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: p.text,
          }}
        >
          {gov.reason}
        </p>
      ) : null}
      {gov.basisLabel ? (
        <p
          style={{
            marginTop: 6,
            marginBottom: 0,
            fontSize: 11,
            color: "#CCCCCC",
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {locale === "fr" ? "Base" : "Basis"}: {gov.basisLabel}
        </p>
      ) : null}
    </div>
  );
}

function TopReasons({
  topReasons,
  provenanceByDriver,
  locale,
}: {
  topReasons: TigerDriver[];
  provenanceByDriver?: Record<string, ProvenanceKind>;
  locale: "fr" | "en";
}) {
  if (topReasons.length === 0) return null;
  const copy = COPY[locale];
  return (
    <div style={{ marginTop: 20 }} data-testid="top-reasons">
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2.5,
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#FF6B00",
          marginBottom: 10,
        }}
      >
        {copy.topReasons}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {topReasons.map((r, i) => {
          const kind = provenanceByDriver?.[r.id] ?? "inferred";
          const label =
            kind === "observed"
              ? copy.observed
              : kind === "corroborated"
                ? copy.corroborated
                : copy.inferred;
          return (
            <li
              key={`${r.id}-${i}`}
              data-testid={`reason-${r.id}`}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid #1A1A1A",
                alignItems: "flex-start",
              }}
            >
              <span
                data-testid={`prov-badge-${kind}`}
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  fontWeight: 900,
                  padding: "3px 6px",
                  background:
                    kind === "observed" ? "#14532D" : kind === "corroborated" ? "#1E3A8A" : "#3F3F46",
                  color:
                    kind === "observed"
                      ? "#D1FAE5"
                      : kind === "corroborated"
                        ? "#DBEAFE"
                        : "#E5E7EB",
                  borderRadius: 2,
                  flexShrink: 0,
                  lineHeight: 1.4,
                }}
              >
                {label}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 2, lineHeight: 1.5 }}>
                  {r.why}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MeaningAndNext({
  tier,
  confidence,
  locale,
  copy,
}: {
  tier: TigerTier;
  confidence: ConfidenceLevel;
  locale: "fr" | "en";
  copy: (typeof COPY)["fr"];
}) {
  const meaning =
    tier === "RED"
      ? locale === "fr"
        ? "Risque élevé identifié. Considérez cette interaction comme dangereuse jusqu'à nouvel ordre."
        : "Substantial risk identified. Treat this as hazardous until further review."
      : tier === "ORANGE"
        ? locale === "fr"
          ? "Signaux à surveiller. Vérifiez les contrats et limitez l'exposition."
          : "Signals to watch. Inspect approvals and cap your exposure."
        : locale === "fr"
          ? "Aucun pattern dangereux détecté à l'instant."
          : "No dangerous pattern detected at this time.";

  const change =
    confidence === "Low"
      ? locale === "fr"
        ? "Plus de transactions historiques ou de sources externes peuvent affiner ce score."
        : "More on-chain history or external sources can refine this score."
      : locale === "fr"
        ? "Un nouveau pattern on-chain ou un statut gouverné manuel peuvent faire évoluer ce score."
        : "A new on-chain pattern or a manually-set governed status could shift this score.";

  return (
    <div
      data-testid="meaning-next"
      style={{
        marginTop: 20,
        display: "grid",
        gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      <div>
        <div style={LABEL}>{copy.whatItMeans}</div>
        <p style={TEXT}>{meaning}</p>
      </div>
      <div>
        <div style={LABEL}>{copy.whatCouldChange}</div>
        <p style={TEXT}>{change}</p>
      </div>
    </div>
  );
}

function Disclaimer({ locale }: { locale: "fr" | "en" }) {
  const txt =
    locale === "fr"
      ? "Analyse éditoriale et algorithmique. Ne constitue pas un conseil juridique, financier ou fiscal. Le statut gouverné est appliqué séparément du score numérique."
      : "Editorial and algorithmic analysis. Not legal, financial or tax advice. A governed status is applied separately from the numeric score.";
  return (
    <div
      data-testid="explain-disclaimer"
      style={{
        marginTop: 14,
        padding: "10px 14px",
        color: "#666",
        fontSize: 11,
        lineHeight: 1.6,
        letterSpacing: 0.3,
      }}
    >
      {txt}
    </div>
  );
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  fontWeight: 900,
  textTransform: "uppercase",
  color: "#FF6B00",
  marginBottom: 6,
};

const TEXT: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#CCCCCC",
};
