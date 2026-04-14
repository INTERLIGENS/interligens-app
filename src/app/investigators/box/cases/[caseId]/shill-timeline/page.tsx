"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.55)";
const MUTED = "rgba(255,255,255,0.35)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface Signal {
  handle: string;
  tokenCA: string;
  tokenSymbol: string;
  shillDate: string;
  exitDate: string;
  hoursToExit: number;
  amountUsd: number;
  severity: Severity;
  confidence: Confidence;
  laundryEnrichment: {
    walletAddress: string;
    chain: string;
    trailType: string;
    laundryRisk: string;
    recoveryDifficulty: string;
  } | null;
  evidence: string[];
  postUrl?: string;
  txHash: string;
  walletAddress: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: "#FF3B5C",
  HIGH: "#F59E0B",
  MEDIUM: "#FFB800",
};

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  HIGH: "#4ADE80",
  MEDIUM: "#FFB800",
  LOW: "#6B7280",
};

function fmtUsd(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function fmtHours(h: number): string {
  if (h < 24) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function shortAddr(a: string): string {
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function toCSV(signals: Signal[]): string {
  const rows = [
    [
      "handle",
      "tokenSymbol",
      "tokenCA",
      "shillDate",
      "exitDate",
      "hoursToExit",
      "amountUsd",
      "severity",
      "confidence",
      "laundryRisk",
      "walletAddress",
      "txHash",
      "postUrl",
    ],
  ];
  for (const s of signals) {
    rows.push([
      s.handle,
      s.tokenSymbol,
      s.tokenCA,
      s.shillDate,
      s.exitDate,
      String(s.hoursToExit.toFixed(2)),
      String(s.amountUsd),
      s.severity,
      s.confidence,
      s.laundryEnrichment?.laundryRisk ?? "",
      s.walletAddress,
      s.txHash,
      s.postUrl ?? "",
    ]);
  }
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const c = String(cell ?? "");
          return /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
        })
        .join(","),
    )
    .join("\n");
}

export default function ShillTimelinePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);

  const [handle, setHandle] = useState("");
  const [querying, setQuerying] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filterHandle, setFilterHandle] = useState("");
  const [filterToken, setFilterToken] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "ALL">("ALL");

  const runQuery = useCallback(async (h: string) => {
    if (!h.trim()) return;
    setQuerying(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/investigators/shill-timeline?handle=${encodeURIComponent(h.trim())}`,
        { credentials: "include" },
      );
      const body = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/access";
        return;
      }
      if (!res.ok) {
        setError(`Query failed: ${body?.error ?? res.status}`);
        return;
      }
      setSignals((body?.signals ?? []) as Signal[]);
    } catch {
      setError("Network error.");
    } finally {
      setQuerying(false);
    }
  }, []);

  useEffect(() => {
    // No auto-run; investigator types a handle and presses Enter.
  }, []);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filterHandle && !s.handle.toLowerCase().includes(filterHandle.toLowerCase()))
        return false;
      if (filterToken) {
        const q = filterToken.toLowerCase();
        const inCa = s.tokenCA.toLowerCase().includes(q);
        const inSym = (s.tokenSymbol ?? "").toLowerCase().includes(q);
        if (!inCa && !inSym) return false;
      }
      if (filterSeverity !== "ALL" && s.severity !== filterSeverity) return false;
      return true;
    });
  }, [signals, filterHandle, filterToken, filterSeverity]);

  function handleExportCsv() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shill-timeline-${handle || "export"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 120px" }}>
        <Link
          href={`/investigators/box/cases/${caseId}`}
          style={{ fontSize: 11, fontFamily: "monospace", color: DIM, textDecoration: "none" }}
        >
          ← Back to case
        </Link>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.25em",
              fontFamily: "monospace",
              color: ACCENT,
              marginBottom: 10,
            }}
          >
            INTERLIGENS · SHILL-TO-EXIT
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              fontStyle: "italic",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              marginBottom: 24,
            }}
          >
            Shill Timeline
          </h1>
        </div>

        {/* Handle input */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="KOL handle (without @)"
            onKeyDown={(e) => {
              if (e.key === "Enter") runQuery(handle);
            }}
            style={{
              flex: 1,
              minWidth: 220,
              background: SURFACE,
              border: `1px solid ${LINE}`,
              color: TEXT,
              padding: "12px 14px",
              fontSize: 13,
              fontFamily: "monospace",
              outline: "none",
              borderRadius: 2,
            }}
          />
          <button
            onClick={() => runQuery(handle)}
            disabled={querying || !handle.trim()}
            style={{
              padding: "12px 22px",
              background: ACCENT,
              color: BG,
              border: "none",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: querying ? "wait" : "pointer",
              opacity: querying ? 0.6 : 1,
            }}
          >
            {querying ? "Querying…" : "Run detector"}
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Filter by handle"
            value={filterHandle}
            onChange={(e) => setFilterHandle(e.target.value)}
            style={filterStyle}
          />
          <input
            type="text"
            placeholder="Filter by token (CA or symbol)"
            value={filterToken}
            onChange={(e) => setFilterToken(e.target.value)}
            style={filterStyle}
          />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as Severity | "ALL")}
            style={{ ...filterStyle, appearance: "none" }}
          >
            <option value="ALL">All severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
          <button
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: `1px solid ${ACCENT}80`,
              color: ACCENT,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: filtered.length === 0 ? "not-allowed" : "pointer",
              borderRadius: 2,
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}
          >
            Export CSV
          </button>
        </div>

        {error && (
          <div
            style={{
              color: "#FF3B5C",
              fontFamily: "monospace",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            fontSize: 10,
            color: MUTED,
            fontFamily: "monospace",
            marginBottom: 16,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {filtered.length} signal{filtered.length === 1 ? "" : "s"}
          {signals.length !== filtered.length && ` (of ${signals.length} total)`}
        </div>

        {/* Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((s, i) => {
            const sevColor = SEVERITY_COLORS[s.severity];
            const confColor = CONFIDENCE_COLORS[s.confidence];
            return (
              <div
                key={`${s.txHash}-${i}`}
                style={{
                  background: SURFACE,
                  border: `1px solid ${LINE}`,
                  borderLeft: `3px solid ${sevColor}`,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <Badge color={sevColor}>{s.severity}</Badge>
                  <Badge color={confColor}>Confidence: {s.confidence}</Badge>
                  {s.laundryEnrichment && (
                    <Badge color="#8B5CF6">
                      Laundry: {s.laundryEnrichment.laundryRisk}
                    </Badge>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
                    @{s.handle} · {s.tokenSymbol}
                  </span>
                </div>

                {/* Timeline row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <TimelineNode
                    label="SHILL"
                    color={ACCENT}
                    primary={new Date(s.shillDate).toLocaleString()}
                    secondary={
                      s.postUrl ? (
                        <a
                          href={s.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: ACCENT, textDecoration: "none" }}
                        >
                          Source post ↗
                        </a>
                      ) : (
                        "No post link"
                      )
                    }
                  />
                  <DeltaBar hours={s.hoursToExit} color={sevColor} />
                  <TimelineNode
                    label="EXIT"
                    color={sevColor}
                    primary={new Date(s.exitDate).toLocaleString()}
                    secondary={`${fmtUsd(s.amountUsd)} · ${shortAddr(s.walletAddress)}`}
                    alignRight
                  />
                </div>

                {/* Evidence bullets */}
                {s.evidence.length > 0 && (
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {s.evidence.map((e, j) => (
                      <li
                        key={j}
                        style={{
                          fontSize: 11,
                          color: DIM,
                          fontFamily: "monospace",
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <span style={{ color: ACCENT, fontWeight: 900 }}>•</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !querying && signals.length === 0 && (
            <div style={{ color: DIM, fontSize: 13, fontFamily: "monospace", padding: 20 }}>
              Enter a KOL handle above and press Run detector to query the
              shill-to-exit pipeline for this case.
            </div>
          )}
          {filtered.length === 0 && signals.length > 0 && (
            <div style={{ color: DIM, fontSize: 13, fontFamily: "monospace", padding: 20 }}>
              Filters exclude all {signals.length} signals. Relax the filters to see them.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const filterStyle: React.CSSProperties = {
  background: SURFACE,
  border: `1px solid ${LINE}`,
  color: TEXT,
  padding: "10px 12px",
  fontSize: 12,
  fontFamily: "monospace",
  outline: "none",
  borderRadius: 2,
  minWidth: 180,
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: "0.1em",
        fontFamily: "monospace",
        color,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        borderRadius: 2,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function TimelineNode({
  label,
  color,
  primary,
  secondary,
  alignRight,
}: {
  label: string;
  color: string;
  primary: string;
  secondary: React.ReactNode;
  alignRight?: boolean;
}) {
  return (
    <div style={{ textAlign: alignRight ? "right" : "left" }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: "0.15em",
          fontFamily: "monospace",
          color,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace", marginBottom: 2 }}>
        {primary}
      </div>
      <div style={{ fontSize: 11, color: DIM, fontFamily: "monospace" }}>{secondary}</div>
    </div>
  );
}

function DeltaBar({ hours, color }: { hours: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: 4,
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color,
          fontWeight: 900,
          letterSpacing: "0.1em",
        }}
      >
        Δ {fmtHours(hours)}
      </div>
      <div
        style={{
          height: 2,
          background: color,
          width: "100%",
          borderRadius: 1,
        }}
      />
      <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>post → exit</div>
    </div>
  );
}
