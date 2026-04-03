"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Database,
  Activity,
  FolderOpen,
  ScrollText,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "entities" | "sources" | "ingestion" | "cases" | "audit";

interface DashboardStats {
  entities: { total: number; sanction: number; high: number };
  observations: number;
  cases: number;
  batches: number;
  sources: SourceStatus[];
  recentBatches: any[];
}

interface SourceStatus {
  slug: string;
  name: string;
  tier: number;
  jurisdiction: string | null;
  schedule: string;
  entityTypes: readonly string[];
  entityCount: number;
  lastBatch: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    recordsFetched: number | null;
    recordsNew: number | null;
  } | null;
}

// ── Color maps ───────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  SANCTION: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
  UNKNOWN: "#6b7280",
};

const STATUS_COLOR: Record<string, string> = {
  success: "#22c55e",
  partial: "#eab308",
  failed: "#ef4444",
  running: "#3b82f6",
  ACTIVE: "#22c55e",
  MONITORING: "#3b82f6",
  CLOSED: "#6b7280",
  DISPUTED: "#f97316",
};

const CASE_TYPE_COLOR: Record<string, string> = {
  SCAM: "#ef4444",
  SANCTION: "#dc2626",
  ENFORCEMENT: "#f97316",
  WARNING: "#eab308",
  INVESTIGATION: "#3b82f6",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  label,
  icon: Icon,
  onClick,
  count,
}: {
  active: boolean;
  label: string;
  icon: any;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#4f46e5" : "#1e293b",
        color: active ? "#fff" : "#94a3b8",
        border: "1px solid " + (active ? "#4f46e5" : "#334155"),
        borderRadius: 8,
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s ease",
      }}
    >
      <Icon size={14} />
      {label}
      {count !== undefined && (
        <span
          style={{
            background: active ? "rgba(255,255,255,0.2)" : "#334155",
            borderRadius: 10,
            padding: "1px 6px",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1e293b",
        borderRadius: 10,
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 700,
          letterSpacing: "0.1em",
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: color ?? "#f1f5f9",
          fontFamily: "monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginTop: 16,
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{
          background: "#1e293b",
          color: "#94a3b8",
          border: "1px solid #334155",
          borderRadius: 6,
          padding: "6px 14px",
          cursor: page === 1 ? "not-allowed" : "pointer",
          opacity: page === 1 ? 0.4 : 1,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ← Prev
      </button>
      <span style={{ color: "#6b7280", fontSize: 12 }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        style={{
          background: "#1e293b",
          color: "#94a3b8",
          border: "1px solid #334155",
          borderRadius: 6,
          padding: "6px 14px",
          cursor: page >= totalPages ? "not-allowed" : "pointer",
          opacity: page >= totalPages ? 0.4 : 1,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Next →
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTITIES TAB
// ═════════════════════════════════════════════════════════════════════════════

function EntitiesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filterType) params.set("type", filterType);
    if (filterRisk) params.set("risk", filterRisk);
    if (search) params.set("q", search);
    const res = await fetch(`/api/intelligence/admin/entities?${params}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(json.records ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, filterType, filterRisk, search]);

  useEffect(() => {
    load();
  }, [load]);

  const types = ["", "ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"];
  const risks = ["", "SANCTION", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search value…"
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: "6px 12px",
            color: "#f1f5f9",
            fontSize: 12,
            width: 220,
          }}
        />
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t || "All types"}
            </option>
          ))}
        </select>
        <select
          value={filterRisk}
          onChange={(e) => {
            setFilterRisk(e.target.value);
            setPage(1);
          }}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          {risks.map((r) => (
            <option key={r} value={r}>
              {r || "All risks"}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          border: "1px solid #1e293b",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["TYPE", "VALUE", "CHAIN", "RISK", "SOURCES", "CASES", "LAST SEEN", "SAFETY"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      color: "#64748b",
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  No entities found
                </td>
              </tr>
            ) : (
              data.map((e: any) => (
                <tr
                  key={e.id}
                  style={{ borderBottom: "1px solid #0f172a" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        background: "#1e293b",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#94a3b8",
                      }}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#e2e8f0",
                    }}
                  >
                    {truncate(e.value, 28)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {e.chain ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        color: RISK_COLOR[e.riskClass] ?? "#6b7280",
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      {e.riskClass}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(e.observations ?? []).map((o: any) => (
                        <span
                          key={o.id}
                          title={`${o.sourceSlug} — ${o.riskClass}`}
                          style={{
                            background: o.sourceTier === 1 ? "#7c3aed22" : "#1e293b",
                            border: `1px solid ${o.sourceTier === 1 ? "#7c3aed44" : "#334155"}`,
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontSize: 9,
                            fontWeight: 700,
                            color: o.sourceTier === 1 ? "#a78bfa" : "#94a3b8",
                          }}
                        >
                          {o.sourceSlug}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {e._count?.cases ?? 0}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 11 }}>
                    {fmt(e.lastSeenAt)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          e.displaySafety === "RETAIL_SAFE"
                            ? "#22c55e22"
                            : e.displaySafety === "ANALYST_REVIEWED"
                            ? "#eab30822"
                            : "#1e293b",
                        color:
                          e.displaySafety === "RETAIL_SAFE"
                            ? "#4ade80"
                            : e.displaySafety === "ANALYST_REVIEWED"
                            ? "#facc15"
                            : "#64748b",
                      }}
                    >
                      {e.displaySafety}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={25} onPage={setPage} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SOURCES TAB
// ═════════════════════════════════════════════════════════════════════════════

function SourcesTab({
  sources,
  onIngest,
  ingesting,
}: {
  sources: SourceStatus[];
  onIngest: (slug: string) => void;
  ingesting: string | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
      {sources.map((src) => (
        <div
          key={src.slug}
          style={{
            background: "#111827",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>{src.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Tier {src.tier}
                {src.jurisdiction ? ` · ${src.jurisdiction}` : ""}
                {" · "}
                {src.entityTypes.join(", ")}
              </div>
            </div>
            <span
              style={{
                background: src.tier === 1 ? "#7c3aed22" : "#1e293b",
                border: `1px solid ${src.tier === 1 ? "#7c3aed44" : "#334155"}`,
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 800,
                color: src.tier === 1 ? "#a78bfa" : "#94a3b8",
              }}
            >
              {src.tier === 1 ? "REGULATORY" : "TECHNICAL"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "#94a3b8",
            }}
          >
            <span>Schedule: {src.schedule}</span>
            <span style={{ fontWeight: 700, color: "#e2e8f0" }}>
              {src.entityCount} active
            </span>
          </div>

          {src.lastBatch && (
            <div
              style={{
                background: "#0f172a",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#64748b" }}>Last ingest</span>
                <span
                  style={{
                    color: STATUS_COLOR[src.lastBatch.status] ?? "#6b7280",
                    fontWeight: 700,
                  }}
                >
                  {src.lastBatch.status}
                </span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                {fmt(src.lastBatch.startedAt)}
                {src.lastBatch.recordsFetched != null &&
                  ` · ${src.lastBatch.recordsFetched} fetched`}
                {src.lastBatch.recordsNew != null &&
                  ` · ${src.lastBatch.recordsNew} new`}
              </div>
            </div>
          )}

          <button
            onClick={() => onIngest(src.slug)}
            disabled={ingesting === src.slug}
            style={{
              background: ingesting === src.slug ? "#334155" : "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 0",
              fontSize: 11,
              fontWeight: 700,
              cursor: ingesting === src.slug ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={12} className={ingesting === src.slug ? "animate-spin" : ""} />
            {ingesting === src.slug ? "Ingesting…" : "Run Ingest"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// INGESTION TAB
// ═════════════════════════════════════════════════════════════════════════════

function IngestionTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/intelligence/admin/batches?page=${page}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(json.records ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "success") return <CheckCircle size={14} color="#22c55e" />;
    if (status === "failed") return <XCircle size={14} color="#ef4444" />;
    if (status === "running") return <Clock size={14} color="#3b82f6" />;
    return <AlertTriangle size={14} color="#eab308" />;
  };

  return (
    <div>
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          border: "1px solid #1e293b",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["", "SOURCE", "STATUS", "STARTED", "COMPLETED", "FETCHED", "NEW", "UPDATED", "REMOVED", "TRIGGERED BY"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 10px",
                      textAlign: "left",
                      color: "#64748b",
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  No ingestion batches yet
                </td>
              </tr>
            ) : (
              data.map((b: any) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <StatusIcon status={b.status} />
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: "#e2e8f0" }}>
                    {b.sourceSlug}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span
                      style={{
                        color: STATUS_COLOR[b.status] ?? "#6b7280",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 11 }}>
                    {fmt(b.startedAt)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 11 }}>
                    {fmt(b.completedAt)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#e2e8f0", fontFamily: "monospace" }}>
                    {b.recordsFetched ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#22c55e", fontFamily: "monospace" }}>
                    {b.recordsNew ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#eab308", fontFamily: "monospace" }}>
                    {b.recordsUpdated ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#ef4444", fontFamily: "monospace" }}>
                    {b.recordsRemoved ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 11 }}>
                    {b.triggeredBy ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={25} onPage={setPage} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CASES TAB
// ═════════════════════════════════════════════════════════════════════════════

function CasesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/intelligence/admin/cases?page=${page}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(json.records ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          border: "1px solid #1e293b",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["TITLE", "TYPE", "STATUS", "SOURCE", "ENTITIES", "EVIDENCE", "REPORTED", "REF"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      color: "#64748b",
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  No cases yet — cases are created from ingested entities
                </td>
              </tr>
            ) : (
              data.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#e2e8f0", maxWidth: 200 }}>
                    {truncate(c.title, 40)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        color: CASE_TYPE_COLOR[c.caseType] ?? "#94a3b8",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {c.caseType}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        color: STATUS_COLOR[c.status] ?? "#6b7280",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {c.sourceSlug}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#e2e8f0", fontFamily: "monospace" }}>
                    {c._count?.entities ?? 0}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#e2e8f0", fontFamily: "monospace" }}>
                    {c._count?.evidence ?? 0}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 11 }}>
                    {fmt(c.reportedAt)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {c.externalUrl ? (
                      <a
                        href={c.externalUrl}
                        target="_blank"
                        rel="noopener"
                        style={{ color: "#818cf8" }}
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span style={{ color: "#334155" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={25} onPage={setPage} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT TAB
// ═════════════════════════════════════════════════════════════════════════════

function AuditTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/intelligence/admin/audit?page=${page}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(json.records ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          border: "1px solid #1e293b",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["TIME", "ACTOR", "ACTION", "TARGET", "DETAIL"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    color: "#64748b",
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  No audit entries yet — run an ingest to start
                </td>
              </tr>
            ) : (
              data.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "8px 12px", color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>
                    {fmt(a.createdAt)}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>
                    {a.actor}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        background: a.action.includes("created")
                          ? "#22c55e22"
                          : a.action.includes("completed")
                          ? "#3b82f622"
                          : "#1e293b",
                        color: a.action.includes("created")
                          ? "#4ade80"
                          : a.action.includes("completed")
                          ? "#60a5fa"
                          : "#94a3b8",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {a.action}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {a.targetType ? `${a.targetType}` : "—"}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#64748b", fontSize: 10, fontFamily: "monospace", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.detail ? JSON.stringify(a.detail) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={50} onPage={setPage} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>("entities");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<any>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/intelligence/admin", { credentials: "include" });
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleIngest = async (slug: string) => {
    setIngesting(slug);
    setIngestResult(null);
    try {
      const res = await fetch("/api/intelligence/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: slug }),
      });
      const json = await res.json();
      setIngestResult(json);
      loadStats();
    } finally {
      setIngesting(null);
    }
  };

  return (
    <div
      style={{
        background: "#0a0f1a",
        minHeight: "100vh",
        color: "#f1f5f9",
        padding: 32,
        fontFamily: "monospace",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: "#ef4444",
            fontWeight: 700,
            letterSpacing: "0.2em",
            marginBottom: 4,
          }}
        >
          CASE INTELLIGENCE
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
          Intelligence Hub
        </h1>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Entity scoring, source ingestion, case tracking — beta
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <Stat label="Entities" value={stats.entities.total} />
          <Stat label="Sanctions" value={stats.entities.sanction} color="#ef4444" />
          <Stat label="High Risk" value={stats.entities.high} color="#f97316" />
          <Stat label="Observations" value={stats.observations} />
          <Stat label="Cases" value={stats.cases} />
          <Stat label="Ingests" value={stats.batches} color="#3b82f6" />
        </div>
      )}

      {/* Ingest result banner */}
      {ingestResult && (
        <div
          style={{
            background:
              ingestResult.status === "success"
                ? "#22c55e11"
                : ingestResult.status === "failed"
                ? "#ef444411"
                : "#eab30811",
            border: `1px solid ${
              ingestResult.status === "success"
                ? "#22c55e44"
                : ingestResult.status === "failed"
                ? "#ef444444"
                : "#eab30844"
            }`,
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <strong>{ingestResult.sourceSlug}</strong> ingest{" "}
            <span style={{ color: STATUS_COLOR[ingestResult.status] ?? "#6b7280", fontWeight: 700 }}>
              {ingestResult.status}
            </span>
            {" — "}
            {ingestResult.recordsFetched} fetched, {ingestResult.recordsNew} new,{" "}
            {ingestResult.recordsUpdated} updated, {ingestResult.recordsRemoved} removed
          </span>
          <button
            onClick={() => setIngestResult(null)}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <TabBtn
          active={tab === "entities"}
          label="Entities"
          icon={Database}
          onClick={() => setTab("entities")}
          count={stats?.entities.total}
        />
        <TabBtn
          active={tab === "sources"}
          label="Sources"
          icon={Shield}
          onClick={() => setTab("sources")}
          count={stats?.sources.length}
        />
        <TabBtn
          active={tab === "ingestion"}
          label="Ingestion"
          icon={Activity}
          onClick={() => setTab("ingestion")}
          count={stats?.batches}
        />
        <TabBtn
          active={tab === "cases"}
          label="Cases"
          icon={FolderOpen}
          onClick={() => setTab("cases")}
          count={stats?.cases}
        />
        <TabBtn
          active={tab === "audit"}
          label="Audit Log"
          icon={ScrollText}
          onClick={() => setTab("audit")}
        />
      </div>

      {/* Tab content */}
      {tab === "entities" && <EntitiesTab />}
      {tab === "sources" && (
        <SourcesTab
          sources={stats?.sources ?? []}
          onIngest={handleIngest}
          ingesting={ingesting}
        />
      )}
      {tab === "ingestion" && <IngestionTab />}
      {tab === "cases" && <CasesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
