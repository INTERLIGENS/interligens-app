"use client";

/**
 * Inline reaction panel — rendered on the Leads tab after the orchestrator
 * returns from a LEAD_ADDED run. Compact, non-modal, dismissable.
 *
 * Displays up to 5 intelligence cards + any suggested related entities.
 * Auto-collapses after 12 seconds unless the investigator interacts with it.
 */

import { useEffect, useRef, useState } from "react";

export type ReactionCard = {
  id?: string;
  eventType: string;
  sourceModule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  summary: string;
  confidence?: number | null;
};

export type ReactionSuggestion = {
  type: string;
  value: string;
  label?: string | null;
  reason: string;
};

export type ReactionData = {
  title: string;
  summary: string;
  cards: ReactionCard[];
  suggestions: ReactionSuggestion[];
  hasMore?: boolean;
  checkedEngines?: string[];
  failedEngines?: string[];
  noMatches?: boolean;
  engineStatuses?: Array<{
    engine: string;
    status:
      | "INTERNAL_MATCH_FOUND"
      | "EXTERNAL_THREAT_SIGNAL_FOUND"
      | "NO_INTERNAL_MATCH_YET"
      | "SOURCE_UNAVAILABLE"
      | "HIT"; // legacy
  }>;
};

type Props = {
  reaction: ReactionData | null;
  loading?: boolean;
  onDismiss: () => void;
  onRunAgain: () => void;
  onAddSuggestion?: (s: ReactionSuggestion) => Promise<void> | void;
  /** Optional callback — when provided, a "View on Overview" link appears. */
  onOpenOverview?: () => void;
};

const ACCENT = "#FF6B00";
const LINE = "rgba(255,255,255,0.08)";

export default function IntelligenceReactionPanel({
  reaction,
  loading,
  onDismiss,
  onRunAgain,
  onAddSuggestion,
  onOpenOverview,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!reaction || loading) return;
    dismissedRef.current = false;
    setCollapsed(false);
    // Only auto-collapse sparse panels (no-match banners, single cards with
    // no suggestions). Content-rich panels stay open so the investigator
    // can actually read them — dismissed manually via ×.
    const cardCount = reaction.cards.length;
    const sugCount = reaction.suggestions.length;
    const isContentRich = cardCount >= 2 || sugCount >= 1;
    if (isContentRich) return;
    const t = setTimeout(() => {
      if (!dismissedRef.current) setCollapsed(true);
    }, 20_000);
    return () => clearTimeout(t);
  }, [reaction, loading]);

  if (loading) {
    return (
      <div
        role="status"
        style={{
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          padding: "12px 14px",
          background: "#0a0a0a",
          fontSize: 12,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 16,
        }}
      >
        Running intelligence checks…
      </div>
    );
  }

  if (!reaction) return null;

  const {
    title,
    summary,
    cards,
    suggestions,
    hasMore,
    checkedEngines,
    failedEngines,
    noMatches,
    engineStatuses,
  } = reaction;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        style={{
          border: `1px solid ${LINE}`,
          borderRadius: 6,
          padding: "8px 14px",
          background: "transparent",
          fontSize: 12,
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        {title} · show
      </button>
    );
  }

  const hasFailures = (failedEngines?.length ?? 0) > 0 && cards.length === 0;
  const borderColor = hasFailures
    ? "rgba(255,59,92,0.3)"
    : noMatches
      ? "rgba(255,255,255,0.12)"
      : "rgba(255,107,0,0.3)";
  const bgColor = hasFailures
    ? "rgba(255,59,92,0.04)"
    : noMatches
      ? "#0a0a0a"
      : "rgba(255,107,0,0.04)";
  const titleColor = hasFailures
    ? "#FF3B5C"
    : noMatches
      ? "rgba(255,255,255,0.6)"
      : ACCENT;

  return (
    <div
      role="region"
      aria-label="Intelligence reaction"
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        padding: 16,
        background: bgColor,
        marginBottom: 20,
      }}
      onMouseEnter={() => {
        dismissedRef.current = true;
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: titleColor,
              marginBottom: 4,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            {summary}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissedRef.current = true;
            onDismiss();
          }}
          aria-label="Dismiss intelligence reaction"
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>

      {cards.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {cards.map((c, i) => (
            <div
              key={c.id ?? `${c.eventType}-${i}`}
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: "10px 12px",
                background: "#0a0a0a",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: severityColor(c.severity),
                  }}
                >
                  {c.severity}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: ACCENT,
                  }}
                >
                  {c.sourceModule.replace("_", " ")}
                </span>
                {typeof c.confidence === "number" && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.5)",
                      marginLeft: "auto",
                    }}
                  >
                    conf {(c.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  marginBottom: 2,
                }}
              >
                {c.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.5,
                }}
              >
                {c.summary}
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
            }}
          >
            Consider adding
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.slice(0, 8).map((s, i) => {
              const key = `${s.type}:${s.value}`;
              const busy = adding === key;
              return (
                <button
                  key={key + i}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!onAddSuggestion) return;
                    setAdding(key);
                    try {
                      await onAddSuggestion(s);
                    } finally {
                      setAdding(null);
                    }
                  }}
                  title={s.reason}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    padding: "5px 10px",
                    borderRadius: 14,
                    border: `1px solid ${LINE}`,
                    background: "#0a0a0a",
                    color: "rgba(255,255,255,0.75)",
                    cursor: onAddSuggestion
                      ? busy
                        ? "wait"
                        : "pointer"
                      : "default",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      color: ACCENT,
                    }}
                  >
                    +{s.type}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                    }}
                  >
                    {s.value.length > 20
                      ? `${s.value.slice(0, 6)}…${s.value.slice(-4)}`
                      : s.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onRunAgain}
          style={{
            fontSize: 11,
            padding: "5px 12px",
            borderRadius: 4,
            border: `1px solid ${LINE}`,
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
          }}
        >
          Run checks again
        </button>
        {!noMatches && cards.length > 0 && (
          onOpenOverview ? (
            <button
              type="button"
              onClick={onOpenOverview}
              style={{
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 4,
                border: `1px solid ${LINE}`,
                background: "transparent",
                color: ACCENT,
                cursor: "pointer",
              }}
            >
              {hasMore ? "View all on Overview →" : "Pinned to Overview →"}
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              {hasMore
                ? "More on the Overview tab →"
                : "Pinned to the Overview feed"}
            </span>
          )
        )}
      </div>

      {(engineStatuses?.length ?? 0) > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${LINE}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {engineStatuses!.map(({ engine, status }) => {
            const isFailed = failedEngines?.includes(engine) ?? false;
            // Normalise legacy HIT → INTERNAL_MATCH_FOUND for display.
            const s = status === "HIT" ? "INTERNAL_MATCH_FOUND" : status;
            const fg = isFailed
              ? "#FF3B5C"
              : s === "INTERNAL_MATCH_FOUND"
                ? ACCENT
                : s === "EXTERNAL_THREAT_SIGNAL_FOUND"
                  ? "#FF3B5C"
                  : s === "SOURCE_UNAVAILABLE"
                    ? "#FFB800"
                    : "rgba(255,255,255,0.4)";
            const bg = isFailed
              ? "rgba(255,59,92,0.08)"
              : s === "INTERNAL_MATCH_FOUND"
                ? "rgba(255,107,0,0.1)"
                : s === "EXTERNAL_THREAT_SIGNAL_FOUND"
                  ? "rgba(255,59,92,0.08)"
                  : s === "SOURCE_UNAVAILABLE"
                    ? "rgba(255,184,0,0.08)"
                    : "transparent";
            const label = isFailed
              ? "failed"
              : s === "INTERNAL_MATCH_FOUND"
                ? "internal match"
                : s === "EXTERNAL_THREAT_SIGNAL_FOUND"
                  ? "threat signal"
                  : s === "SOURCE_UNAVAILABLE"
                    ? "source unavailable"
                    : "no match";
            return (
              <span
                key={engine}
                title={`${engine.replace("_", " ")} — ${label}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 10,
                  border: `1px solid ${fg}33`,
                  background: bg,
                  color: fg,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <span style={{ opacity: 0.8 }}>
                  {engine.replace("_", " ")}
                </span>
                <span style={{ opacity: 0.6 }}>·</span>
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function severityColor(s: ReactionCard["severity"]): string {
  switch (s) {
    case "CRITICAL":
    case "HIGH":
      return "#FF3B5C";
    case "MEDIUM":
      return "#FFB800";
    default:
      return "rgba(255,255,255,0.5)";
  }
}
