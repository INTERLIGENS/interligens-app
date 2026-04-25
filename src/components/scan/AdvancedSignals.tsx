"use client";

import React, { useState } from "react";
import { computeExitDoor, type MarketInput } from "@/lib/risk/exitDoor";
import { computeCabalScore } from "@/lib/risk/cabal";

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
  lang?: "en" | "fr";
  tier?: string | null;
  manipulationLevel?: string | null;
  rawSummary?: any;
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

function chipStyle(level: string): React.CSSProperties {
  if (level === "low" || level === "open")
    return { border: "1px solid #22c55e44", background: "#22c55e18", color: "#22c55e" };
  if (level === "med" || level === "tight")
    return { border: "1px solid #f9731644", background: "#f9731618", color: "#f97316" };
  return { border: "1px solid #ef444444", background: "#ef444418", color: "#ef4444" };
}

function Chip({ text, level }: { text: string; level: string }) {
  return (
    <span style={{
      ...chipStyle(level),
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      padding: "2px 8px",
      borderRadius: 999,
      whiteSpace: "nowrap",
    }}>
      {text}
    </span>
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

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  color: "#333",
  textTransform: "uppercase",
  letterSpacing: 2,
  fontWeight: 700,
  marginBottom: 8,
};

const bCard: React.CSSProperties = {
  background: "#0a0a12",
  border: "1px solid #1a1a24",
  borderRadius: 8,
  padding: "12px 14px",
};

const bTitle: React.CSSProperties = {
  fontSize: 9,
  color: "#444",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontWeight: 700,
  marginBottom: 6,
};

const bRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const bVal: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#a1a1aa",
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function AdvancedSignals(props: AdvancedSignalsProps) {
  const [open, setOpen] = useState(false);
  const {
    website, websiteAgeLabelEn, pairAgeDays, liquidityUsd,
    mintAuthority, freezeAuthority, topHolderPct, signals,
    lang = "en", tier, manipulationLevel, rawSummary,
  } = props;

  const hasSectionB = rawSummary != null;
  const tierNorm = (tier ?? "").toLowerCase();

  // Section B — Influence (Calls)
  const kolLvl: "low" | "med" | "high" =
    manipulationLevel === "red" ? "high" : manipulationLevel === "orange" ? "med" :
    tierNorm === "red" ? "high" : tierNorm === "orange" ? "med" : "low";
  const kolBadge = kolLvl === "high" ? (lang === "fr" ? "ÉLEVÉ" : "HIGH")
    : kolLvl === "med" ? (lang === "fr" ? "MOYEN" : "MED") : (lang === "fr" ? "FAIBLE" : "LOW");
  const kolVal = lang === "fr"
    ? `Influence : ${kolLvl === "high" ? "Élevée" : kolLvl === "med" ? "Moyenne" : "Faible"}`
    : `Influence: ${kolLvl === "high" ? "High" : kolLvl === "med" ? "Med" : "Low"}`;

  // Section B — Coordination Risk + Can I Sell?
  const market: MarketInput = rawSummary?.markets ?? rawSummary?.market ?? { data_unavailable: true };
  const cabal = computeCabalScore({
    chain: rawSummary?.chain,
    address: rawSummary?.address,
    off_chain: rawSummary?.off_chain,
    tiger_drivers: rawSummary?.tiger_drivers ?? [],
    market: { volume_24h_usd: (market as any).volume_24h_usd, liquidity_usd: market.liquidity_usd },
    spenders: rawSummary?.spenders,
    unlimitedCount: rawSummary?.unlimitedCount,
  });
  const cabalLvl: "low" | "med" | "high" = cabal.tier === "HIGH" ? "high" : cabal.tier === "MED" ? "med" : "low";
  const cabalVal = lang === "fr"
    ? `${cabal.tier === "HIGH" ? "Élevé" : cabal.tier === "MED" ? "Moyen" : "Faible"} ${cabal.score}`
    : `${cabal.tier === "HIGH" ? "High" : cabal.tier === "MED" ? "Med" : "Low"} ${cabal.score}`;
  const cabalBadge = lang === "fr" ? cabal.label_fr : cabal.label_en;

  const exit = computeExitDoor(market);
  const exitLvl: "open" | "tight" | "blocked" = exit.level === "OPEN" ? "open" : exit.level === "TIGHT" ? "tight" : "blocked";
  const exitBadge = lang === "fr" ? exit.label_fr : exit.label_en;
  const exitVal = lang === "fr"
    ? (exit.level === "OPEN" ? "Vendable" : exit.level === "TIGHT" ? "Sortie difficile" : "Pas de sortie")
    : (exit.level === "OPEN" ? "Sellable" : exit.level === "TIGHT" ? "Hard to sell" : "No exit");

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

      <div style={{ maxHeight: open ? 1200 : 0, overflow: "hidden", transition: "max-height 300ms ease-in-out" }}>

        {/* Section A — Token Structure */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={sectionLabel}>
            {lang === "fr" ? "Structure du token" : "Token Structure"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>

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

            <Card title="Website age">
              {websiteAgeLabelEn
                ? <span style={{ fontSize: 12, color: "#ccc" }}>{websiteAgeLabelEn}</span>
                : <Badge label="Unavailable" palette={GRAY} />
              }
            </Card>

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

            <Card title="Liquidity">
              {liquidityUsd != null
                ? <Badge
                    label={liquidityUsd >= 100_000 ? "Present" : liquidityUsd >= 10_000 ? "Low" : "Very low"}
                    palette={liquidityUsd >= 100_000 ? GREEN : liquidityUsd >= 10_000 ? ORANGE : RED}
                  />
                : <Badge label="Missing" palette={GRAY} />
              }
            </Card>

            <Card title="Can more tokens be created?">
              {mintAuthority == null
                ? <Badge label="Unavailable" palette={GRAY} />
                : mintAuthority
                  ? <Badge label="Yes" palette={RED} />
                  : <Badge label="No" palette={GREEN} />
              }
            </Card>

            <Card title="Can transfers be frozen?">
              {freezeAuthority == null
                ? <Badge label="Unavailable" palette={GRAY} />
                : freezeAuthority
                  ? <Badge label="Yes" palette={RED} />
                  : <Badge label="No" palette={GREEN} />
              }
            </Card>

            <Card title="Held by top wallets">
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

            <Card title="Structural signals">
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

        {/* Section B — Market & Promotion Signals */}
        {hasSectionB && (
          <div style={{ padding: "12px 14px 14px", borderTop: "1px solid #1a1a24" }}>
            <div style={sectionLabel}>
              {lang === "fr" ? "Signaux marché & promotion" : "Market & Promotion Signals"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>

              <div style={bCard}>
                <div style={bTitle}>{lang === "fr" ? "INFLUENCE (CALLS)" : "INFLUENCE (CALLS)"}</div>
                <div style={bRow}>
                  <span style={bVal}>{kolVal}</span>
                  <Chip text={kolBadge} level={kolLvl} />
                </div>
              </div>

              <div style={bCard}>
                <div style={bTitle}>{lang === "fr" ? "RISQUE COORDINATION" : "COORDINATION RISK"}</div>
                <div style={bRow}>
                  <span style={bVal}>{cabalVal}</span>
                  <Chip text={cabalBadge} level={cabalLvl} />
                </div>
              </div>

              <div style={{ ...bCard, gridColumn: "1 / -1" }}>
                <div style={bTitle}>{lang === "fr" ? "PUIS-JE VENDRE ?" : "CAN I SELL?"}</div>
                <div style={bRow}>
                  <span style={bVal}>{exitVal}</span>
                  <Chip text={exitBadge} level={exitLvl} />
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
