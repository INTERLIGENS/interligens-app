"use client";

import React, { useState } from "react";

export interface Signal {
  id?: string;
  label: string;
  severity?: string;
}

export interface AdvancedSignalsProps {
  website?: string | null;
  websiteAgeLabelEn?: string | null;
  pairAgeDays?: number | null;
  liquidityUsd?: number | null;
  mintAuthority?: boolean | null;
  freezeAuthority?: boolean | null;
  topHolderPct?: number | null;
  signals?: Signal[];
}

const GREEN  = { bg: "#0d2a1a", border: "#1a4a2a", text: "#22c55e" };
const ORANGE = { bg: "#2a1a0d", border: "#4a2a1a", text: "#f97316" };
const RED    = { bg: "#2a0d0d", border: "#4a1a1a", text: "#ef4444" };
const GRAY   = { bg: "#1a1a1a", border: "#2a2a2a", text: "#555" };

type Palette = typeof GREEN;

function Badge({ label, palette }: { label: string; palette: Palette }) {
  return (
    <span style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.text,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: "uppercase",
      padding: "2px 8px",
      borderRadius: 4,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0a0a12",
      border: "1px solid #1a1a24",
      borderRadius: 8,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function formatLiquidity(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatAge(days: number): string {
  if (days < 1) return "< 1 day";
  if (days < 7) return `${Math.floor(days)}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function buildTeaser(props: AdvancedSignalsProps): string {
  const parts: string[] = [];
  if (props.pairAgeDays != null) parts.push(`Pair age: ${formatAge(props.pairAgeDays)}`);
  if (props.liquidityUsd != null) parts.push(`Liq: ${formatLiquidity(props.liquidityUsd)}`);
  if (props.mintAuthority === true) parts.push("Mint active");
  if (props.freezeAuthority === true) parts.push("Freeze active");
  if (parts.length === 0 && props.signals?.length) parts.push(`${props.signals.length} signal(s)`);
  return parts.join(" · ") || "Token structure analysis";
}

export default function AdvancedSignals(props: AdvancedSignalsProps) {
  const [open, setOpen] = useState(false);
  const { website, websiteAgeLabelEn, pairAgeDays, liquidityUsd, mintAuthority, freezeAuthority, topHolderPct, signals } = props;

  return (
    <div style={{ marginTop: 16, background: "#111118", border: "1px solid #2a2a34", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            ADVANCED SIGNALS
          </span>
          <span style={{ fontSize: 11, color: "#444" }}>{buildTeaser(props)}</span>
        </div>
        <span style={{
          display: "inline-block",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 200ms ease",
          fontSize: 10,
          color: "#555",
        }}>▾</span>
      </button>

      <div style={{ maxHeight: open ? 600 : 0, overflow: "hidden", transition: "max-height 300ms ease-in-out" }}>
        <div style={{
          padding: "0 14px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}>

          {/* Website */}
          <Card title="Website">
            {website
              ? (
                <a
                  href={website.startsWith("http") ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#aaa", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {website.replace(/^https?:\/\//, "").slice(0, 28)}
                </a>
              )
              : <Badge label="Not found" palette={GRAY} />
            }
          </Card>

          {/* Website age */}
          <Card title="Website age">
            {websiteAgeLabelEn
              ? <span style={{ fontSize: 12, color: "#ccc" }}>{websiteAgeLabelEn}</span>
              : <Badge label="Unavailable" palette={GRAY} />
            }
          </Card>

          {/* Token age */}
          <Card title="Token age">
            {pairAgeDays != null
              ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: pairAgeDays < 7 ? "#ef4444" : pairAgeDays < 30 ? "#f97316" : "#22c55e" }}>
                  {formatAge(pairAgeDays)}
                </span>
              )
              : <Badge label="Unavailable" palette={GRAY} />
            }
          </Card>

          {/* Liquidity */}
          <Card title="Liquidity">
            {liquidityUsd != null
              ? <Badge
                  label={liquidityUsd >= 100_000 ? "Present" : liquidityUsd >= 10_000 ? "Low" : "Very low"}
                  palette={liquidityUsd >= 100_000 ? GREEN : liquidityUsd >= 10_000 ? ORANGE : RED}
                />
              : <Badge label="Missing" palette={GRAY} />
            }
          </Card>

          {/* Mint authority */}
          <Card title="Mint authority">
            {mintAuthority == null
              ? <Badge label="Unavailable" palette={GRAY} />
              : mintAuthority
                ? <Badge label="Active" palette={RED} />
                : <Badge label="Revoked" palette={GREEN} />
            }
          </Card>

          {/* Freeze authority */}
          <Card title="Freeze authority">
            {freezeAuthority == null
              ? <Badge label="Unavailable" palette={GRAY} />
              : freezeAuthority
                ? <Badge label="Active" palette={RED} />
                : <Badge label="Revoked" palette={GREEN} />
            }
          </Card>

          {/* Top 10 holders */}
          <Card title="Top 10 holders">
            {topHolderPct != null
              ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: topHolderPct >= 70 ? "#ef4444" : topHolderPct >= 40 ? "#f97316" : "#22c55e" }}>
                      {topHolderPct}%
                    </span>
                    <Badge
                      label={topHolderPct >= 70 ? "High risk" : topHolderPct >= 40 ? "Moderate" : "Healthy"}
                      palette={topHolderPct >= 70 ? RED : topHolderPct >= 40 ? ORANGE : GREEN}
                    />
                  </div>
                  <div style={{ height: 4, background: "#1a1a24", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(topHolderPct, 100)}%`,
                      background: topHolderPct >= 70 ? "#ef4444" : topHolderPct >= 40 ? "#f97316" : "#22c55e",
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              )
              : <Badge label="Unavailable" palette={GRAY} />
            }
          </Card>

          {/* Key signals */}
          <Card title="Key signals">
            {signals?.length
              ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {signals.slice(0, 3).map((s, i) => (
                    <div key={i} style={{
                      fontSize: 11,
                      color: s.severity === "CRITICAL" || s.severity === "HIGH"
                        ? "#ef4444"
                        : s.severity === "MEDIUM"
                          ? "#f97316"
                          : "#aaa",
                    }}>
                      {s.label}
                    </div>
                  ))}
                  {signals.length > 3 && (
                    <div style={{ fontSize: 10, color: "#444" }}>+{signals.length - 3} more</div>
                  )}
                </div>
              )
              : <Badge label="None" palette={GREEN} />
            }
          </Card>

        </div>
      </div>
    </div>
  );
}
