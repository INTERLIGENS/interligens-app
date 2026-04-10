/**
 * CaseSnapshot — premium 20-30s compression block for CaseFile pages.
 *
 * Pure presentational component. Receives the dossier + snapshots already
 * fetched by the parent page. No fetches, no side effects.
 *
 * Style note: uses inline styles to match the surrounding page
 * (`src/app/en/explorer/[caseId]/page.tsx`) which is 100% inline-styled.
 * Mixing Tailwind into a fully inline file would create visual incoherence.
 * See CASEFILE_SNAPSHOT.md for the rationale.
 */

import React from "react"
import { IntelligenceModeBadge } from "@/components/intelligence/IntelligenceModeBadge"
import {
  buildSubline,
  coreEvidenceFallback,
  deriveNextAction,
  deriveSolidity,
  selectCoreEvidence,
  selectFeaturedActor,
  selectKeySignals,
  solidityCopy,
  type SnapshotDossier,
  type SnapshotEvidenceItem,
  type SolidityTier,
} from "@/lib/case/snapshotSelectors"

interface Props {
  dossier: SnapshotDossier
  snapshots: SnapshotEvidenceItem[]
  caseId: string
  locale?: "en" | "fr"
}

const ACCENT = "#F85B05"
const ACCENT_DIM = "#F85B0518"
const ACCENT_BORDER = "#F85B0533"
const BG = "#0A0A0A"
const BG_RAISED = "#0d1117"
const BORDER = "#1e2330"
const TEXT = "#f9fafb"
const TEXT_DIM = "#6b7280"
const TEXT_LABEL = "#4b5563"

const MONO: React.CSSProperties = { fontFamily: "monospace" }

function tierBg(tier: SolidityTier): { bg: string; fg: string; border: string } {
  if (tier === "CONFIRMED") return { bg: "#dc262615", fg: "#ef4444", border: "#dc262640" }
  if (tier === "PROBABLE") return { bg: "#f59e0b15", fg: "#f59e0b", border: "#f59e0b40" }
  return { bg: "#3b82f615", fg: "#60a5fa", border: "#3b82f640" }
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      ...MONO,
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: "0.2em",
      color: TEXT_LABEL,
      marginBottom: 10,
    }}
  >
    {children}
  </div>
)

export default function CaseSnapshot({ dossier, snapshots, caseId, locale = "en" }: Props) {
  const tier = deriveSolidity(dossier)
  const tierColors = tierBg(tier)
  const copy = solidityCopy(tier, locale)
  const subline = buildSubline(dossier, locale)
  const signals = selectKeySignals(dossier, locale, 4)
  const evidence = selectCoreEvidence(snapshots, 3)
  const actor = selectFeaturedActor(dossier)
  const action = deriveNextAction(tier, dossier, locale)

  // Empty/partial guard — if dossier is essentially empty, render a minimal
  // shell instead of a broken-looking block.
  const hasAnything =
    signals.length > 0 ||
    evidence.length > 0 ||
    actor !== null ||
    (dossier.summary && dossier.summary.length > 0)

  return (
    <section
      aria-label="Case snapshot"
      style={{
        background: BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: "28px 28px 24px",
        marginBottom: 36,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          background: ACCENT,
        }}
      />

      {/* HEADER — verdict + tier */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.25em",
              color: ACCENT,
              marginBottom: 6,
            }}
          >
            CASE SNAPSHOT
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.015em",
              margin: 0,
              color: TEXT,
              lineHeight: 1.15,
            }}
          >
            {copy.line}
          </h2>
          {subline && (
            <p
              style={{
                ...MONO,
                fontSize: 11,
                color: TEXT_DIM,
                margin: "8px 0 0",
                letterSpacing: "0.02em",
              }}
            >
              {subline}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.18em",
              color: TEXT_LABEL,
            }}
          >
            SOLIDITY
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.15em",
              padding: "8px 14px",
              borderRadius: 4,
              background: tierColors.bg,
              color: tierColors.fg,
              border: `1px solid ${tierColors.border}`,
            }}
          >
            {copy.label}
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 9,
              color: TEXT_LABEL,
              letterSpacing: "0.1em",
            }}
          >
            {dossier.documentationStatus.toUpperCase()} · {dossier.evidenceDepth.toUpperCase()}
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div style={{ height: 1, background: BORDER, margin: "20px 0 22px" }} />

      {!hasAnything ? (
        <div
          style={{
            ...MONO,
            fontSize: 11,
            color: TEXT_LABEL,
            padding: "20px 0",
            letterSpacing: "0.1em",
          }}
        >
          {locale === "fr"
            ? "DOSSIER EN COURS DE QUALIFICATION — PEU DE DONNÉES PUBLIABLES POUR LE MOMENT."
            : "DOSSIER UNDER QUALIFICATION — LIMITED PUBLISHABLE DATA AT THIS TIME."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
          }}
        >
          {/* LEFT — KEY SIGNALS */}
          <div>
            <Label>
              {locale === "fr" ? "SIGNAUX CLÉS" : "KEY SIGNALS"}{" "}
              {signals.length > 0 ? `(${signals.length})` : ""}
            </Label>
            {signals.length === 0 ? (
              <div style={{ ...MONO, fontSize: 11, color: TEXT_LABEL }}>
                {locale === "fr" ? "Aucun signal qualifié" : "No qualified signal"}
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {signals.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 12,
                      color: TEXT,
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      style={{
                        ...MONO,
                        color: ACCENT,
                        fontWeight: 900,
                        fontSize: 10,
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* RIGHT — CORE EVIDENCE */}
          <div>
            <Label>
              {locale === "fr" ? "PREUVES CENTRALES" : "CORE EVIDENCE"}{" "}
              {evidence.length > 0 ? `(${evidence.length})` : ""}
            </Label>
            {evidence.length === 0 ? (
              <div
                style={{
                  background: BG_RAISED,
                  border: `1px dashed ${BORDER}`,
                  borderRadius: 6,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    ...MONO,
                    fontSize: 8,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    color: TEXT_LABEL,
                    marginBottom: 4,
                  }}
                >
                  {locale === "fr" ? "ENREGISTREMENTS LIÉS" : "LINKED RECORDS"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.35 }}>
                  {coreEvidenceFallback(dossier, locale)}
                </div>
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {evidence.map((e) => (
                  <li
                    key={e.id}
                    style={{
                      background: BG_RAISED,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        ...MONO,
                        fontSize: 8,
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        color: ACCENT,
                        marginBottom: 4,
                      }}
                    >
                      {e.snapshotType.replace(/_/g, " ").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
                      {e.title}
                    </div>
                    {e.caption && (
                      <div
                        style={{
                          fontSize: 11,
                          color: TEXT_DIM,
                          marginTop: 4,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {e.caption}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* LINKED INTELLIGENCE — actor block (conditional) */}
      {actor && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 20,
            borderTop: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                ...MONO,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.18em",
                color: TEXT_LABEL,
              }}
            >
              {locale === "fr" ? "ACTEUR LIÉ" : "LINKED ACTOR"}
            </div>
            <a
              href={`/${locale}/kol/${actor.handle}`}
              style={{
                background: ACCENT_DIM,
                border: `1px solid ${ACCENT_BORDER}`,
                color: ACCENT,
                ...MONO,
                fontSize: 12,
                fontWeight: 800,
                padding: "6px 14px",
                borderRadius: 5,
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              @{actor.handle}
            </a>
            {actor.tier && (
              <span
                style={{
                  ...MONO,
                  fontSize: 10,
                  fontWeight: 900,
                  color: TEXT_LABEL,
                  letterSpacing: "0.15em",
                }}
              >
                TIER {actor.tier.toUpperCase()}
              </span>
            )}
            <span
              style={{
                ...MONO,
                fontSize: 10,
                color: TEXT_LABEL,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {actor.role}
            </span>
          </div>
          {dossier.linkedActorsCount > 1 && (
            <span
              style={{
                ...MONO,
                fontSize: 10,
                color: TEXT_LABEL,
                letterSpacing: "0.1em",
              }}
            >
              +{dossier.linkedActorsCount - 1} {locale === "fr" ? "autres" : "more"}
            </span>
          )}
        </div>
      )}

      {/* RECOMMENDED NEXT ACTION */}
      <div
        style={{
          marginTop: 22,
          paddingTop: 20,
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              ...MONO,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.2em",
              color: TEXT_LABEL,
              marginBottom: 4,
            }}
          >
            {locale === "fr" ? "ACTION RECOMMANDÉE" : "RECOMMENDED ACTION"}
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 13,
              fontWeight: 900,
              color: TEXT,
              letterSpacing: "0.05em",
            }}
          >
            {action.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: TEXT_DIM,
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {action.hint}
          </div>
        </div>
        <a
          href={`/${locale}/explorer/${encodeURIComponent(caseId)}#case-detail`}
          style={{
            ...MONO,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.2em",
            color: BG,
            background: ACCENT,
            padding: "10px 18px",
            borderRadius: 4,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {locale === "fr" ? "VOIR LE DOSSIER →" : "OPEN DOSSIER →"}
        </a>
      </div>

      {/* Intelligence Mode footer — Case Snapshot is deterministic */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px dashed ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <IntelligenceModeBadge mode="deterministic" locale={locale} variant="line" />
      </div>

      {/* Hidden caseId data attribute for downstream telemetry hooks */}
      <span data-case-id={caseId} style={{ display: "none" }} aria-hidden />
    </section>
  )
}
