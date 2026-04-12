"use client";

import type { PublicScoreResponse } from "@/lib/publicScore/schema";

const VERDICT_COLORS: Record<string, string> = {
  RED: "#FF3B5C",
  ORANGE: "#FF6B00",
  GREEN: "#00C853",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#FF3B5C",
  HIGH: "#FF6B00",
  MEDIUM: "#FACC15",
  LOW: "#6B7280",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

type Props = {
  data: PublicScoreResponse;
  casefileHandle?: string | null;
  locale?: "en" | "fr";
};

export default function ScoreCard({ data, casefileHandle, locale = "en" }: Props) {
  const color = VERDICT_COLORS[data.verdict] ?? "#6B7280";

  return (
    <div
      style={{
        background: "#111118",
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: "24px 20px",
        maxWidth: 480,
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* Verdict + Score */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span
          style={{
            display: "inline-block",
            background: color,
            color: "#000",
            fontWeight: 700,
            fontSize: 12,
            padding: "3px 12px",
            borderRadius: 4,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {data.verdict}
        </span>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color,
            lineHeight: 1.1,
            marginTop: 8,
            fontFamily: "monospace",
          }}
        >
          {data.score}
          <span style={{ fontSize: 20, color: "#666" }}>/100</span>
        </div>
        {data.symbol && (
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {data.name ?? data.symbol} ({data.symbol})
          </div>
        )}
      </div>

      {/* Signals */}
      {data.signals.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            {locale === "fr" ? "Signaux de risque" : "Risk signals"} ({data.signals.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.signals.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#ddd",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: SEVERITY_COLORS[s.severity] ?? "#666",
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{s.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: SEVERITY_COLORS[s.severity] ?? "#666",
                    fontWeight: 600,
                  }}
                >
                  {s.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {data.sources.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {locale === "fr" ? "Sources" : "Sources"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.sources.map((src) => (
              <span
                key={src}
                style={{
                  fontSize: 11,
                  color: "#aaa",
                  background: "#1a1a24",
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid #2a2a34",
                }}
              >
                {src}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>
        {locale === "fr" ? "Analyse" : "Analysed"} {timeAgo(data.timestamp)}
      </div>

      {/* Casefile link */}
      {casefileHandle && (
        <a
          href={`/${locale === "fr" ? "fr" : "en"}/kol/${casefileHandle}`}
          style={{
            display: "block",
            textAlign: "center",
            color: "#FF6B00",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            padding: "8px 0",
            borderTop: "1px solid #222",
            marginTop: 4,
          }}
        >
          {locale === "fr"
            ? "Voir le casefile complet"
            : "View full casefile"}{" "}
          &rarr;
        </a>
      )}
    </div>
  );
}
