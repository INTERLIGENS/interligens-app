"use client";
import React, { useState, useEffect } from "react";

// ─── THEME ──────────────────────────────────────────────────────────────────
const BG = "#0A0C10";
const SURFACE = "#111318";
const BORDER = "#1E2028";
const AMBER = "#FFB800";
const CYAN = "#00E5FF";
const TEXT = "#F9FAFB";
const MUTED = "#6B7280";
const RED = "#EF4444";

type Tab = "cases" | "kols" | "alerts" | "pdfs" | "proceeds";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "cases", label: "Case Files", icon: "\u{1F4C1}" },
  { id: "kols", label: "KOL Network", icon: "\u{1F441}" },
  { id: "alerts", label: "Alertes Watcher", icon: "\u26A0\uFE0F" },
  { id: "pdfs", label: "Legal PDF", icon: "\u{1F4C4}" },
  { id: "proceeds", label: "Observed Proceeds", icon: "\u{1F4B0}" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function mono(s: string, max = 12) {
  if (s.length <= max) return s;
  return s.slice(0, 6) + "..." + s.slice(-4);
}

function fmtUsd(n?: number | null) {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

function severityColor(s: string) {
  const u = s.toUpperCase();
  if (u === "RED" || u === "CRITICAL" || u === "HIGH") return RED;
  if (u === "ORANGE" || u === "MEDIUM") return AMBER;
  return "#22C55E";
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
        background: color + "18",
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {text}
    </span>
  );
}

// ─── DATA HOOKS ─────────────────────────────────────────────────────────────

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

// ─── SECTION: CASE FILES ────────────────────────────────────────────────────

function CaseFilesSection() {
  const { data, loading } = useFetch<{
    cases: Array<{
      case_id: string;
      token_name: string;
      ticker: string;
      chain: string;
      status: string;
      severity: string;
      opened_at: string;
      investigator: string;
      summary: string;
    }>;
  }>("/api/investigator/cases");

  if (loading) return <LoadingBar />;
  const cases = data?.cases ?? [];
  if (!cases.length) return <EmptyState text="No published case files." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cases.map((c) => (
        <div
          key={c.case_id}
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
            <div>
              <span style={{ color: CYAN, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                {c.case_id}
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: TEXT }}>
                {c.token_name} <span style={{ color: MUTED, fontWeight: 400 }}>{c.ticker}</span>
              </h3>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Badge text={c.severity} color={severityColor(c.severity)} />
              <Badge text={c.chain.toUpperCase()} color={CYAN} />
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: "0 0 10px" }}>
            {c.summary}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
            <span>STATUS: <span style={{ color: TEXT }}>{c.status}</span></span>
            <span>OPENED: <span style={{ color: TEXT }}>{c.opened_at.slice(0, 10)}</span></span>
            <span>BY: <span style={{ color: TEXT }}>{c.investigator}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: KOL NETWORK ───────────────────────────────────────────────────

function KolNetworkSection() {
  const { data, loading } = useFetch<{
    kols: Array<{
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
    }>;
  }>("/api/investigator/kols");

  if (loading) return <LoadingBar />;
  const kols = data?.kols ?? [];
  if (!kols.length) return <EmptyState text="No KOL profiles published." />;

  const tierColor: Record<string, string> = {
    S: RED, A: "#F97316", B: AMBER, C: MUTED,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Handle", "Tier", "Risk", "Rugs", "Scammed", "Proceeds", "Evidence"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  color: MUTED,
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  fontFamily: "monospace",
                }}
              >
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kols.slice(0, 50).map((k) => (
            <tr key={k.handle} style={{ borderBottom: `1px solid ${BORDER}15` }}>
              <td style={{ padding: "8px 10px", color: TEXT, fontWeight: 600 }}>
                <a
                  href={`/en/kol/${k.handle}`}
                  style={{ color: CYAN, textDecoration: "none" }}
                >
                  @{k.handle}
                </a>
                {k.displayName && (
                  <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>
                    {k.displayName}
                  </span>
                )}
              </td>
              <td style={{ padding: "8px 10px" }}>
                {k.tier && (
                  <span style={{ color: tierColor[k.tier] ?? MUTED, fontWeight: 800, fontFamily: "monospace" }}>
                    {k.tier}
                  </span>
                )}
              </td>
              <td style={{ padding: "8px 10px" }}>
                {k.riskFlag && <Badge text={k.riskFlag.replace(/_/g, " ")} color={RED} />}
              </td>
              <td style={{ padding: "8px 10px", color: TEXT, fontFamily: "monospace" }}>{k.rugCount}</td>
              <td style={{ padding: "8px 10px", color: AMBER, fontFamily: "monospace" }}>{fmtUsd(k.totalScammed)}</td>
              <td style={{ padding: "8px 10px", color: RED, fontFamily: "monospace" }}>{fmtUsd(k.totalProceedsUsd)}</td>
              <td style={{ padding: "8px 10px", color: MUTED, fontFamily: "monospace" }}>{k.evidenceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SECTION: ALERTES WATCHER ───────────────────────────────────────────────

function AlertesWatcherSection() {
  const { data, loading } = useFetch<{
    alerts: Array<{
      handle: string;
      displayName: string;
      category: string;
      whyTracked: string;
      signals: { ctaDangerous: boolean; domainRisk: boolean; caDetected: boolean; narrativeSpike: boolean };
      priority: number;
      proofCount: number;
    }>;
  }>("/api/investigator/alerts");

  if (loading) return <LoadingBar />;
  const alerts = data?.alerts ?? [];
  if (!alerts.length) return <EmptyState text="No active watcher alerts." />;

  const catColor: Record<string, string> = {
    CA_promoter: RED,
    cta_pusher: "#F97316",
    narrative_actor: AMBER,
    domain_risk: CYAN,
    generic: MUTED,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a) => (
        <div
          key={a.handle}
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 4,
              height: 36,
              borderRadius: 2,
              background: catColor[a.category] ?? MUTED,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>
                @{a.handle}
              </span>
              <Badge text={a.category.replace(/_/g, " ")} color={catColor[a.category] ?? MUTED} />
            </div>
            <div style={{ color: MUTED, fontSize: 11 }}>{a.whyTracked}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {a.signals.ctaDangerous && <SignalDot label="CTA" color={RED} />}
            {a.signals.caDetected && <SignalDot label="CA" color="#F97316" />}
            {a.signals.domainRisk && <SignalDot label="DOM" color={CYAN} />}
            {a.signals.narrativeSpike && <SignalDot label="NAR" color={AMBER} />}
          </div>
          <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", flexShrink: 0 }}>
            {a.proofCount} proof{a.proofCount !== 1 ? "s" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalDot({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 20,
        borderRadius: 3,
        fontSize: 8,
        fontWeight: 800,
        fontFamily: "monospace",
        background: color + "20",
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
}

// ─── SECTION: LEGAL PDF ─────────────────────────────────────────────────────

function LegalPdfSection() {
  const { data, loading } = useFetch<{
    pdfs: Array<{
      filename: string;
      url: string;
      sizeKb: number;
      modified: string;
    }>;
  }>("/api/investigator/pdfs");

  if (loading) return <LoadingBar />;
  const pdfs = data?.pdfs ?? [];
  if (!pdfs.length) return <EmptyState text="No published legal PDFs." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {pdfs.map((p) => (
        <a
          key={p.filename}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            textDecoration: "none",
            transition: "border-color 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = AMBER + "60")}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = BORDER)}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>{"\u{1F4C4}"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: TEXT, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.filename}
            </div>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>
              {p.sizeKb} KB &middot; {p.modified.slice(0, 10)}
            </div>
          </div>
          <span style={{ color: CYAN, fontSize: 11, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
            OPEN &rarr;
          </span>
        </a>
      ))}
    </div>
  );
}

// ─── SECTION: OBSERVED PROCEEDS ─────────────────────────────────────────────

function ObservedProceedsSection() {
  const { data, loading } = useFetch<{
    proceeds: Array<{
      case_id: string;
      token: string;
      ticker: string;
      wallet: string;
      pnl_usd: number | null;
      buy_tx: string;
      sell_tx: string;
      notes: string;
    }>;
  }>("/api/investigator/proceeds");

  if (loading) return <LoadingBar />;
  const proceeds = data?.proceeds ?? [];
  if (!proceeds.length) return <EmptyState text="No observed proceeds data." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {proceeds.map((p, i) => (
        <div
          key={p.case_id + i}
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ color: CYAN, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                {p.case_id}
              </span>
              <span style={{ color: TEXT, fontSize: 14, fontWeight: 700, marginLeft: 10 }}>
                {p.token} <span style={{ color: MUTED }}>{p.ticker}</span>
              </span>
            </div>
            <div
              style={{
                color: p.pnl_usd && p.pnl_usd > 0 ? RED : "#22C55E",
                fontSize: 18,
                fontWeight: 800,
                fontFamily: "monospace",
              }}
            >
              {fmtUsd(p.pnl_usd)}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
            <div>
              <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 9 }}>WALLET</span>
              <div style={{ color: AMBER, fontFamily: "monospace", marginTop: 2 }}>
                {mono(p.wallet, 16)}
              </div>
            </div>
            <div>
              <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 9 }}>BUY TX</span>
              <div style={{ color: TEXT, fontFamily: "monospace", marginTop: 2 }}>
                {mono(p.buy_tx, 16)}
              </div>
            </div>
            <div>
              <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 9 }}>SELL TX</span>
              <div style={{ color: TEXT, fontFamily: "monospace", marginTop: 2 }}>
                {mono(p.sell_tx, 16)}
              </div>
            </div>
            {p.notes && (
              <div>
                <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 9 }}>NOTES</span>
                <div style={{ color: MUTED, marginTop: 2 }}>{p.notes}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SHARED ─────────────────────────────────────────────────────────────────

function LoadingBar() {
  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <div
        style={{
          width: 60,
          height: 3,
          background: AMBER,
          borderRadius: 2,
          margin: "0 auto",
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes pulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }`}</style>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>
      {text}
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function InvestigatorDashboard() {
  const [tab, setTab] = useState<Tab>("cases");

  async function handleLogout() {
    await fetch("/api/investigator/auth/logout", { method: "POST" });
    window.location.href = "/en/investigator/login";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
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
          <span
            style={{
              color: AMBER,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.2em",
              fontFamily: "monospace",
            }}
          >
            INTERLIGENS
          </span>
          <span style={{ color: BORDER }}>|</span>
          <span
            style={{
              color: CYAN,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
            }}
          >
            INVESTIGATOR DASHBOARD
          </span>
        </div>
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
      </header>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* TAB BAR */}
        <nav
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 28,
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
                  background: active ? AMBER + "15" : "transparent",
                  border: `1px solid ${active ? AMBER + "40" : "transparent"}`,
                  borderRadius: 6,
                  padding: "10px 16px",
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
                {t.icon}&ensp;{t.label}
              </button>
            );
          })}
        </nav>

        {/* ACTIVE SECTION */}
        {tab === "cases" && <CaseFilesSection />}
        {tab === "kols" && <KolNetworkSection />}
        {tab === "alerts" && <AlertesWatcherSection />}
        {tab === "pdfs" && <LegalPdfSection />}
        {tab === "proceeds" && <ObservedProceedsSection />}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "14px 24px",
          textAlign: "center",
          color: MUTED,
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: "0.1em",
        }}
      >
        INTERLIGENS INTELLIGENCE PLATFORM &middot; PUBLISHED DATA ONLY &middot; NOT AN ACCUSATION
      </footer>
    </div>
  );
}
