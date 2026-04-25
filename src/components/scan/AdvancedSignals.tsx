"use client";

import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Signal {
  label: string;
  severity?: string;
}

export interface AdvancedSignalsProps {
  website?: string | null;
  websiteActive?: boolean | null;
  websiteAgeLabelEn?: string | null;
  pairAgeDays?: number | null;
  liquidityUsd?: number | null;
  mintAuthority?: boolean | null;
  freezeAuthority?: boolean | null;
  topHolderPct?: number | null;
  signals?: Signal[];
  lang?: "en";
}

// ─── Color palettes ───────────────────────────────────────────────────────────

const GREEN = { bg: "#0d2a1a", border: "#1a4a2a", text: "#22c55e" };
const ORANGE = { bg: "#2a1a0d", border: "#4a2a1a", text: "#f97316" };
const RED   = { bg: "#2a0d0d", border: "#4a1a1a", text: "#ef4444" };
const GRAY  = { bg: "#1a1a1a", border: "#2a2a2a", text: "#555" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(days: number): string {
  if (days < 1)   return "< 1 day";
  if (days < 2)   return "1 day";
  if (days < 7)   return `${Math.round(days)} days`;
  if (days < 14)  return "1 week";
  if (days < 60)  return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const yrs = days / 365;
  return yrs < 2 ? "1 year" : `${Math.round(yrs)} years`;
}

function ageColors(days: number | null | undefined): typeof GREEN {
  if (days === null || days === undefined) return GRAY;
  if (days < 7)  return RED;
  if (days < 30) return ORANGE;
  return GREEN;
}

function liquidityInfo(usd: number | null | undefined): { label: string; colors: typeof GREEN } {
  if (usd === null || usd === undefined) return { label: "Unavailable", colors: GRAY };
  if (usd >= 50_000) return { label: "Present",  colors: GREEN };
  if (usd > 0)       return { label: "Low",       colors: ORANGE };
  return               { label: "Missing",         colors: RED };
}

function webAgeColors(label: string | null | undefined): typeof GREEN {
  if (!label) return GRAY;
  const t = label.toLowerCase();
  if (t.includes("hour") || t.includes("day") || t.includes("new")) return RED;
  if (t.includes("month")) return ORANGE;
  return GREEN;
}

function buildTeaser(p: AdvancedSignalsProps): string {
  const parts: string[] = [];
  if (p.pairAgeDays !== null && p.pairAgeDays !== undefined)
    parts.push(`Token: ${formatAge(p.pairAgeDays)} old`);
  if (p.liquidityUsd !== null && p.liquidityUsd !== undefined) {
    const { label } = liquidityInfo(p.liquidityUsd);
    parts.push(`Liquidity ${label.toLowerCase()}`);
  }
  if (p.mintAuthority === true)    parts.push("Can mint more tokens");
  else if (p.freezeAuthority === true) parts.push("Freeze authority active");
  if (parts.length === 0 && p.signals?.length) {
    const hi = p.signals.filter(s => s.severity === "CRITICAL" || s.severity === "HIGH");
    parts.push(hi.length > 0
      ? `${hi.length} critical signal${hi.length > 1 ? "s" : ""} detected`
      : "No major signals detected");
  }
  return parts.length === 0 ? "Signal analysis in progress" : parts.slice(0, 3).join(" • ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ text, colors }: { text: string; colors: typeof GREEN }) {
  return (
    <span style={{
      display: "inline-block",
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      color: colors.text,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: "monospace",
      borderRadius: 4,
      padding: "2px 7px",
      letterSpacing: "0.04em",
    }}>
      {text}
    </span>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#111118",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      padding: "11px 13px",
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.15em",
        color: "#666",
        marginBottom: 7,
        fontFamily: "monospace",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdvancedSignals({
  website,
  websiteActive,
  websiteAgeLabelEn,
  pairAgeDays,
  liquidityUsd,
  mintAuthority,
  freezeAuthority,
  topHolderPct,
  signals = [],
}: AdvancedSignalsProps) {
  const [open, setOpen] = useState(false);

  const teaser = buildTeaser({ website, pairAgeDays, liquidityUsd, mintAuthority, freezeAuthority, signals });

  const siteLabel = website ? website.replace(/^https?:\/\//, "").split("/")[0] : null;
  const siteHref  = website ? (website.startsWith("http") ? website : `https://${website}`) : null;
  const siteColors = siteLabel
    ? (websiteActive === false ? RED : GREEN)
    : RED;

  const keySignals = signals
    .filter(s => s.severity === "CRITICAL" || s.severity === "HIGH" || s.severity === "MEDIUM")
    .slice(0, 3);

  const { label: liqLabel, colors: liqColors } = liquidityInfo(liquidityUsd);
  const ageCols = ageColors(pairAgeDays);
  const wAgeCols = webAgeColors(websiteAgeLabelEn);

  return (
    <div style={{
      marginTop: 12,
      background: "#0a0a0f",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      overflow: "hidden",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          cursor: "pointer",
          gap: 12,
          textAlign: "left" as const,
        }}
      >
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 900,
            textTransform: "uppercase" as const,
            letterSpacing: "0.2em",
            color: "#FFFFFF",
            marginBottom: 4,
            fontFamily: "monospace",
          }}>
            ADVANCED SIGNALS{" "}
            <span style={{ color: "#FF6B00" }}>{open ? "▴" : "▾"}</span>
          </div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.05em", lineHeight: 1.4 }}>
            {teaser}
          </div>
        </div>
      </button>

      {/* Body */}
      <div style={{
        maxHeight: open ? 700 : 0,
        overflow: "hidden",
        transition: "max-height 300ms ease-in-out",
      }}>
        {/* Tailwind grid: 1 col mobile, 2 cols sm+ */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2"
          style={{ padding: "4px 14px 16px", gap: 8 }}
        >
          {/* 1 — Website */}
          <Card label="Website">
            {siteLabel && siteHref ? (
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: siteColors.text,
                  textDecoration: "none",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {siteLabel}
              </a>
            ) : (
              <Badge text="Not found" colors={RED} />
            )}
          </Card>

          {/* 2 — Website age */}
          <Card label="Website age">
            <Badge
              text={websiteAgeLabelEn ?? "Unavailable"}
              colors={websiteAgeLabelEn ? wAgeCols : GRAY}
            />
          </Card>

          {/* 3 — Token age */}
          <Card label="Token age">
            {pairAgeDays !== null && pairAgeDays !== undefined ? (
              <Badge text={formatAge(pairAgeDays)} colors={ageCols} />
            ) : (
              <Badge text="Unavailable" colors={GRAY} />
            )}
          </Card>

          {/* 4 — Liquidity */}
          <Card label="Liquidity">
            {liquidityUsd !== null && liquidityUsd !== undefined ? (
              <Badge text={liqLabel} colors={liqColors} />
            ) : (
              <Badge text="Unavailable" colors={GRAY} />
            )}
          </Card>

          {/* 5 — Mint authority */}
          <Card label="Can more tokens be created?">
            {mintAuthority === null || mintAuthority === undefined ? (
              <Badge text="Unavailable" colors={GRAY} />
            ) : mintAuthority ? (
              <Badge text="Yes — risk" colors={RED} />
            ) : (
              <Badge text="No — safe" colors={GREEN} />
            )}
          </Card>

          {/* 6 — Freeze authority */}
          <Card label="Can transfers be frozen?">
            {freezeAuthority === null || freezeAuthority === undefined ? (
              <Badge text="Unavailable" colors={GRAY} />
            ) : freezeAuthority ? (
              <Badge text="Yes — risk" colors={RED} />
            ) : (
              <Badge text="No — safe" colors={GREEN} />
            )}
          </Card>

          {/* 7 — Top holders */}
          <Card label="Held by top wallets">
            {topHolderPct !== null && topHolderPct !== undefined ? (
              <div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: topHolderPct > 50 ? "#ef4444" : topHolderPct > 30 ? "#f97316" : "#22c55e",
                }}>
                  {Math.round(topHolderPct)}%
                </span>
                <div style={{ marginTop: 4, height: 4, background: "#222", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(topHolderPct, 100)}%`,
                    height: "100%",
                    background: topHolderPct > 50 ? "#ef4444" : topHolderPct > 30 ? "#f97316" : "#22c55e",
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            ) : (
              <Badge text="Unavailable" colors={GRAY} />
            )}
          </Card>

          {/* 8 — Key signals */}
          <Card label="Key signals">
            {keySignals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {keySignals.map((s, i) => (
                  <div key={i} style={{
                    fontSize: 10,
                    color: (s.severity === "CRITICAL" || s.severity === "HIGH") ? "#ef4444" : "#f97316",
                    fontFamily: "monospace",
                    lineHeight: 1.4,
                  }}>
                    · {s.label}
                  </div>
                ))}
              </div>
            ) : signals.length > 0 ? (
              <Badge text="No major signals" colors={GREEN} />
            ) : (
              <Badge text="Unavailable" colors={GRAY} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
