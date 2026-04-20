"use client";
import React, { useState, useEffect, useCallback } from "react";

// ─── THEME ──────────────────────────────────────────────────────────────────
const BG = "#0A0C10";
const SURFACE = "#111318";
const SURFACE2 = "#161920";
const BORDER = "#1E2028";
const AMBER = "#FFB800";
const CYAN = "#FFFFFF";
const RED = "#FF3B5C";
const GREEN = "#22C55E";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const DIMMED = "#3B3F4A";

type Tab = "cases" | "kols" | "alerts" | "pdfs" | "proceeds";

const TABS: { id: Tab; label: string }[] = [
  { id: "cases", label: "Case Files" },
  { id: "kols", label: "KOL Network" },
  { id: "alerts", label: "Watcher Alerts" },
  { id: "pdfs", label: "Legal PDF" },
  { id: "proceeds", label: "Observed Proceeds" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function fmtUsd(n?: number | null) {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

function fmtDate(d?: string | null) {
  if (!d) return "\u2014";
  return d.slice(0, 10);
}

function tierColor(tier: string) {
  const u = tier.toUpperCase();
  if (u === "RED" || u === "CRITICAL") return RED;
  if (u === "HIGH" || u === "S" || u === "A") return "#F97316";
  if (u === "WATCH" || u === "MEDIUM" || u === "B") return AMBER;
  return MUTED;
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        fontFamily: "monospace",
        background: color + "15",
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {text}
    </span>
  );
}

// ─── DATA HOOK ──────────────────────────────────────────────────────────────

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/en/investigator/login";
          return null;
        }
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);
  return { data, loading };
}

// ─── SKELETON ───────────────────────────────────────────────────────────────

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 0" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            animation: "skPulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`@keyframes skPulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "48px 0",
        textAlign: "center",
        color: DIMMED,
        fontSize: 13,
        fontFamily: "monospace",
        letterSpacing: "0.05em",
      }}
    >
      {text}
    </div>
  );
}

// ─── TOP METRICS BAR ────────────────────────────────────────────────────────

function MetricsBar() {
  const { data } = useFetch<{
    publishedCases: number;
    trackedEntities: number;
    watcherSignals: number;
    publishedPdfs: number;
    totalProceeds: number;
  }>("/api/investigator/metrics");

  if (!data) return null;

  const items = [
    { label: "Published Cases", value: String(data.publishedCases) },
    { label: "Tracked Entities", value: String(data.trackedEntities) },
    { label: "Watcher Signals", value: String(data.watcherSignals) },
    { label: "Published PDFs", value: String(data.publishedPdfs) },
    { label: "Observed Proceeds", value: fmtUsd(data.totalProceeds) },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 1,
        background: BORDER,
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      {items.map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            background: SURFACE,
            padding: "14px 12px",
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              color: AMBER,
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "monospace",
              lineHeight: 1,
            }}
          >
            {m.value}
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.1em",
              marginTop: 6,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: CASE FILES ────────────────────────────────────────────────────

interface CaseData {
  id: string;
  caseCode: string;
  title: string;
  assetSymbol: string;
  summary: string;
  chain: string;
  riskTier: string;
  status: string;
  publishedAt: string;
  openedAt: string;
  updatedAt?: string;
  evidenceCount: number;
  claimCount: number;
  relatedKolHandles: string[];
  pdfs: { id: string; title: string; language: string }[];
  proceedsCount: number;
  totalProceeds: number;
}

function CaseFilesSection() {
  const { data, loading } = useFetch<{ cases: CaseData[] }>("/api/investigator/cases");

  if (loading) return <Skeleton lines={2} />;
  const cases = data?.cases ?? [];
  if (!cases.length) return <EmptyState text="NO PUBLISHED CASE FILES" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {cases.map((c) => (
        <div
          key={c.id}
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ color: CYAN, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                {c.caseCode}
              </div>
              <h3 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 700, color: TEXT }}>
                {c.title}
              </h3>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <Badge text={c.riskTier} color={tierColor(c.riskTier)} />
              <Badge text={c.chain} color={CYAN} />
              <Badge text={c.status} color={c.status === "Published" ? GREEN : AMBER} />
            </div>
          </div>

          {/* Summary */}
          <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.6, margin: "0 0 14px" }}>
            {c.summary}
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 20,
              fontSize: 10,
              color: MUTED,
              fontFamily: "monospace",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <span>OPENED <span style={{ color: TEXT }}>{fmtDate(c.openedAt)}</span></span>
            <span>PUBLISHED <span style={{ color: TEXT }}>{fmtDate(c.publishedAt)}</span></span>
            {c.updatedAt && <span>UPDATED <span style={{ color: TEXT }}>{fmtDate(c.updatedAt)}</span></span>}
            <span>EVIDENCE <span style={{ color: AMBER }}>{c.evidenceCount}</span></span>
            <span>CLAIMS <span style={{ color: AMBER }}>{c.claimCount}</span></span>
            <span>PROCEEDS <span style={{ color: RED }}>{fmtUsd(c.totalProceeds)}</span></span>
          </div>

          {/* Related PDFs */}
          {c.pdfs.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {c.pdfs.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 3,
                    fontSize: 10,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    background: SURFACE2,
                    border: `1px solid ${BORDER}`,
                    color: CYAN,
                  }}
                >
                  PDF: {p.title}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: KOL NETWORK ───────────────────────────────────────────────────

interface KolData {
  handle: string;
  displayName?: string;
  tier?: string;
  totalScammed?: number;
  totalProceedsUsd?: number;
  rugCount: number;
  followerCount?: number;
  riskFlag?: string;
  verified: boolean;
  evidenceCount: number;
  caseCount: number;
  confidence?: string;
}

function classifyRisk(k: KolData): { label: string; color: string } {
  const flag = k.riskFlag?.toLowerCase() ?? "";
  if (flag.includes("confirmed")) return { label: "CONFIRMED SCAMMER", color: RED };
  if (flag.includes("high")) return { label: "HIGH RISK", color: "#F97316" };
  if (flag.includes("medium")) return { label: "MEDIUM RISK", color: AMBER };
  if (flag.includes("victim")) return { label: "VICTIM POOL", color: CYAN };
  return { label: "UNVERIFIED", color: MUTED };
}

function KolNetworkSection() {
  const { data, loading } = useFetch<{ kols: KolData[] }>("/api/investigator/kols");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) return <Skeleton lines={5} />;
  const kols = data?.kols ?? [];
  if (!kols.length) return <EmptyState text="NO PUBLISHED KOL PROFILES" />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Handle", "Classification", "Rug Count", "Est. Scammed", "Proceeds", "Evidence", "Cases"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  color: DIMMED,
                  fontWeight: 600,
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kols.slice(0, 50).map((k) => {
            const risk = classifyRisk(k);
            return (
              <tr
                key={k.handle}
                onClick={() => setExpanded(expanded === k.handle ? null : k.handle)}
                style={{
                  borderBottom: `1px solid ${BORDER}10`,
                  cursor: "pointer",
                  background: expanded === k.handle ? SURFACE2 : "transparent",
                }}
              >
                <td style={{ padding: "10px 10px" }}>
                  <a
                    href={`/en/kol/${k.handle}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: CYAN, textDecoration: "none", fontWeight: 600 }}
                  >
                    @{k.handle}
                  </a>
                  {k.displayName && (
                    <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      {k.displayName}
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <Badge text={risk.label} color={risk.color} />
                </td>
                <td style={{ padding: "10px 10px", color: TEXT, fontFamily: "monospace", fontWeight: 600 }}>
                  {k.rugCount}
                </td>
                <td style={{ padding: "10px 10px", color: AMBER, fontFamily: "monospace", fontWeight: 600 }}>
                  {fmtUsd(k.totalScammed)}
                </td>
                <td style={{ padding: "10px 10px", color: RED, fontFamily: "monospace", fontWeight: 600 }}>
                  {fmtUsd(k.totalProceedsUsd)}
                </td>
                <td style={{ padding: "10px 10px", color: MUTED, fontFamily: "monospace" }}>
                  {k.evidenceCount}
                </td>
                <td style={{ padding: "10px 10px", color: MUTED, fontFamily: "monospace" }}>
                  {k.caseCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── SECTION: WATCHER ALERTS ────────────────────────────────────────────────

interface AlertData {
  id: string;
  entity: string;
  entityHandle: string;
  signalType: string;
  severity: string;
  proofCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  linkedCaseId: string | null;
  linkedKolHandle: string | null;
  note: string;
}

function signalColor(type: string) {
  switch (type) {
    case "CTA_DANGEROUS": return RED;
    case "CA_DETECTED": return "#F97316";
    case "DOMAIN_RISK": return CYAN;
    case "NARRATIVE_SPIKE": return AMBER;
    case "SELL_WHILE_SHILL": return RED;
    default: return MUTED;
  }
}

function severityColor(s: string) {
  switch (s) {
    case "CRITICAL": return RED;
    case "HIGH": return "#F97316";
    case "MEDIUM": return AMBER;
    default: return MUTED;
  }
}

function WatcherAlertsSection() {
  const { data, loading } = useFetch<{ alerts: AlertData[] }>("/api/investigator/alerts");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) return <Skeleton lines={4} />;
  const alerts = data?.alerts ?? [];
  if (!alerts.length) return <EmptyState text="NO ACTIVE WATCHER ALERTS" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a) => (
        <div
          key={a.id}
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
            }}
          >
            {/* Severity bar */}
            <div
              style={{
                width: 4,
                height: 36,
                borderRadius: 2,
                background: severityColor(a.severity),
                flexShrink: 0,
              }}
            />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                  @{a.entityHandle}
                </span>
                <Badge text={a.signalType.replace(/_/g, " ")} color={signalColor(a.signalType)} />
                <Badge text={a.severity} color={severityColor(a.severity)} />
              </div>
              <div style={{ color: MUTED, fontSize: 11 }}>{a.entity}</div>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              {a.linkedCaseId && (
                <span style={{ color: CYAN, fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}>
                  CASE
                </span>
              )}
              <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", textAlign: "right" }}>
                <div>{a.proofCount} proof{a.proofCount !== 1 ? "s" : ""}</div>
                <div style={{ fontSize: 9, color: DIMMED }}>Last: {fmtDate(a.lastSeenAt)}</div>
              </div>
              <span style={{ color: DIMMED, fontSize: 10 }}>
                {expandedId === a.id ? "\u25B2" : "\u25BC"}
              </span>
            </div>
          </div>

          {/* Expanded detail */}
          {expandedId === a.id && (
            <div
              style={{
                padding: "0 16px 14px 34px",
                borderTop: `1px solid ${BORDER}`,
                paddingTop: 12,
              }}
            >
              <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: "0 0 8px" }}>
                {a.note}
              </p>
              <div style={{ display: "flex", gap: 16, fontSize: 10, fontFamily: "monospace", color: DIMMED }}>
                <span>First seen: <span style={{ color: TEXT }}>{fmtDate(a.firstSeenAt)}</span></span>
                <span>Last seen: <span style={{ color: TEXT }}>{fmtDate(a.lastSeenAt)}</span></span>
                {a.linkedKolHandle && (
                  <a
                    href={`/en/kol/${a.linkedKolHandle}`}
                    style={{ color: CYAN, textDecoration: "none" }}
                  >
                    View KOL Profile →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: LEGAL PDF ─────────────────────────────────────────────────────

interface PdfData {
  id: string;
  title: string;
  language: string;
  version: string;
  publishedAt: string;
  fileSize: number;
  relatedCaseId: string | null;
  downloadUrl: string;
}

function LegalPdfSection() {
  const { data, loading } = useFetch<{ pdfs: PdfData[] }>("/api/investigator/pdfs");

  if (loading) return <Skeleton lines={3} />;
  const pdfs = data?.pdfs ?? [];
  if (!pdfs.length) return <EmptyState text="NO PUBLISHED LEGAL DOCUMENTS" />;

  // Group by case
  const grouped = new Map<string, PdfData[]>();
  for (const p of pdfs) {
    const key = p.relatedCaseId ?? "other";
    const arr = grouped.get(key) ?? [];
    arr.push(p);
    grouped.set(key, arr);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[...grouped.entries()].map(([caseId, items]) => (
        <div key={caseId}>
          {caseId !== "other" && (
            <div
              style={{
                color: DIMMED,
                fontSize: 9,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.15em",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Related Case: {caseId}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((p) => (
              <a
                key={p.id}
                href={p.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = AMBER + "50")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = BORDER)}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 4,
                    background: SURFACE2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: AMBER, fontSize: 11, fontFamily: "monospace", fontWeight: 900 }}>
                    PDF
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                    {p.title}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 10, fontFamily: "monospace", color: MUTED }}>
                    <span>{p.language}</span>
                    <span>v{p.version}</span>
                    <span>{p.fileSize} KB</span>
                    <span>Published {fmtDate(p.publishedAt)}</span>
                  </div>
                </div>

                {/* Download */}
                <span style={{ color: CYAN, fontSize: 11, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                  OPEN &rarr;
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: OBSERVED PROCEEDS ─────────────────────────────────────────────

interface ProceedData {
  id: string;
  entityId: string;
  entityType: string;
  entityLabel: string;
  caseId: string | null;
  chain: string;
  walletShort: string;
  buyTx: string;
  sellTx: string;
  amount: number;
  currency: string;
  usdValue: number;
  observedAt: string;
  note: string;
  evidenceCount: number;
}

function ObservedProceedsSection() {
  const { data, loading } = useFetch<{ proceeds: ProceedData[] }>("/api/investigator/proceeds");

  if (loading) return <Skeleton lines={4} />;
  const proceeds = data?.proceeds ?? [];
  if (!proceeds.length) return <EmptyState text="NO OBSERVED PROCEEDS DATA" />;

  const totalUsd = proceeds.reduce((s, p) => s + p.usdValue, 0);

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          padding: "12px 16px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
        }}
      >
        <span style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>
          TOTAL OBSERVED ACROSS {proceeds.length} ENTRIES
        </span>
        <span style={{ color: RED, fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
          {fmtUsd(totalUsd)}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {proceeds.map((p) => (
          <div
            key={p.id}
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: 18,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: TEXT, fontSize: 14, fontWeight: 700 }}>
                  {p.entityLabel}
                </span>
                <Badge
                  text={p.entityType.toUpperCase()}
                  color={p.entityType === "kol" ? CYAN : p.entityType === "cluster" ? "#F97316" : AMBER}
                />
                {p.caseId && (
                  <span style={{ color: DIMMED, fontSize: 9, fontFamily: "monospace" }}>
                    {p.caseId}
                  </span>
                )}
              </div>
              <div
                style={{
                  color: p.usdValue > 0 ? RED : GREEN,
                  fontSize: 20,
                  fontWeight: 800,
                  fontFamily: "monospace",
                }}
              >
                {fmtUsd(p.usdValue)}
              </div>
            </div>

            {/* Note */}
            <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: "0 0 10px" }}>
              {p.note}
            </p>

            {/* Meta row */}
            <div style={{ display: "flex", gap: 16, fontSize: 10, color: DIMMED, fontFamily: "monospace", flexWrap: "wrap" }}>
              <span>CHAIN <span style={{ color: CYAN }}>{p.chain}</span></span>
              <span>WALLET <span style={{ color: AMBER }}>{p.walletShort}</span></span>
              <span>OBSERVED <span style={{ color: TEXT }}>{fmtDate(p.observedAt)}</span></span>
              <span>EVIDENCE <span style={{ color: TEXT }}>{p.evidenceCount}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function InvestigatorDashboard() {
  const [tab, setTab] = useState<Tab>("cases");
  const [loadedAt] = useState(() => new Date());

  const getTimeSince = useCallback(() => {
    const diff = Math.round((Date.now() - loadedAt.getTime()) / 60000);
    if (diff < 1) return "just now";
    return `${diff}m ago`;
  }, [loadedAt]);

  const [timeSince, setTimeSince] = useState("just now");
  useEffect(() => {
    const t = setInterval(() => setTimeSince(getTimeSince()), 30000);
    return () => clearInterval(t);
  }, [getTimeSince]);

  async function handleLogout() {
    await fetch("/api/investigator/auth/logout", { method: "POST" });
    window.location.href = "/en/investigator/login";
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header
        style={{
          background: "#08090D",
          borderBottom: `1px solid ${BORDER}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: AMBER, fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            INTERLIGENS
          </span>
          <span style={{ color: BORDER }}>|</span>
          <span style={{ color: CYAN, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", fontFamily: "monospace" }}>
            INVESTIGATOR DASHBOARD
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: DIMMED, fontSize: 9, fontFamily: "monospace" }}>
            Last refresh: {timeSince}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              color: MUTED,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              fontFamily: "monospace",
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* METRICS BAR */}
        <MetricsBar />

        {/* TAB BAR */}
        <nav
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: active ? AMBER + "12" : "transparent",
                  border: `1px solid ${active ? AMBER + "35" : "transparent"}`,
                  borderRadius: 6,
                  padding: "10px 18px",
                  color: active ? AMBER : MUTED,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  fontFamily: "monospace",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* ACTIVE SECTION */}
        {tab === "cases" && <CaseFilesSection />}
        {tab === "kols" && <KolNetworkSection />}
        {tab === "alerts" && <WatcherAlertsSection />}
        {tab === "pdfs" && <LegalPdfSection />}
        {tab === "proceeds" && <ObservedProceedsSection />}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "14px 24px",
          textAlign: "center",
          color: DIMMED,
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
        }}
      >
        INTERLIGENS INTELLIGENCE PLATFORM &middot; PUBLISHED DATA ONLY &middot; FACTS NOT ACCUSATIONS &middot; NDA CONFIDENTIAL
      </footer>
    </div>
  );
}
