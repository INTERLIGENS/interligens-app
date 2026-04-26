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

type Tab = "entities" | "sources" | "ingestion" | "cases" | "audit" | "serial_patterns";

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
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${active ? "bg-orange-500 text-black" : "bg-[#1a1a1a] text-gray-300 hover:bg-gray-700"}`}
    >
      <Icon size={14} />
      {label}
      {count !== undefined && (
        <span className={`inline-block px-2 py-0.5 rounded text-xs ${active ? "bg-black/20" : "bg-[#222]"}`}>
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
    <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 flex-1 min-w-[140px]">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label.toUpperCase()}
      </div>
      <div className="text-3xl font-bold text-white font-mono" style={color ? { color } : undefined}>
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
    <div className="flex gap-2 mt-4 justify-end items-center">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition"
      >
        ← Prev
      </button>
      <span className="text-gray-500 text-sm">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition"
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
    const res = await fetch(`/api/admin/intelligence/entities?${params}`, {
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
            background: "#1a1a1a",
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
            background: "#1a1a1a",
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
            background: "#1a1a1a",
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
          border: "1px solid #1a1a1a",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
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
                  style={{ borderBottom: "1px solid #111111" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        background: "#1a1a1a",
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
                            background: o.sourceTier === 1 ? "#7c3aed22" : "#1a1a1a",
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
                            : "#1a1a1a",
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
            border: "1px solid #1a1a1a",
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
                background: src.tier === 1 ? "#7c3aed22" : "#1a1a1a",
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
                background: "#111111",
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
    const res = await fetch(`/api/admin/intelligence/batches?page=${page}`, {
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
          border: "1px solid #1a1a1a",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
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
                <tr key={b.id} style={{ borderBottom: "1px solid #111111" }}>
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
    const res = await fetch(`/api/admin/intelligence/cases?page=${page}`, {
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
          border: "1px solid #1a1a1a",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
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
                <tr key={c.id} style={{ borderBottom: "1px solid #111111" }}>
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
    const res = await fetch(`/api/admin/intelligence/audit?page=${page}`, {
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
          border: "1px solid #1a1a1a",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
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
                <tr key={a.id} style={{ borderBottom: "1px solid #111111" }}>
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
                          : "#1a1a1a",
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
// SERIAL PATTERNS TAB
// ═════════════════════════════════════════════════════════════════════════════

const PATTERN_COLOR: Record<string, string> = {
  pump_dump: "#ef4444",
  coordinated_shill: "#f97316",
  exit_liquidity: "#eab308",
  wallet_cluster: "#8b5cf6",
};

const PATTERN_LABEL: Record<string, string> = {
  pump_dump: "OBSERVED PATTERN",
  coordinated_shill: "OBSERVED PATTERN",
  exit_liquidity: "OBSERVED PATTERN",
  wallet_cluster: "OBSERVED PATTERN",
};

function SerialPatternsTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChain, setFilterChain] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterChain) params.set("chain", filterChain);
    if (filterType) params.set("patternType", filterType);
    const res = await fetch(`/api/admin/intelligence/serial-patterns?${params}`, {
      credentials: "include",
    });
    const json = await res.json();
    setData(Array.isArray(json) ? json : []);
    setLoading(false);
  }, [filterChain, filterType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={filterChain}
          onChange={(e) => setFilterChain(e.target.value)}
          style={{ background: "#1a1a1a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", fontSize: 12 }}
        >
          {["", "solana", "ethereum", "bsc"].map((c) => (
            <option key={c} value={c}>{c || "All chains"}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ background: "#1a1a1a", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#94a3b8", fontSize: 12 }}
        >
          {["", "pump_dump", "coordinated_shill", "exit_liquidity", "wallet_cluster"].map((t) => (
            <option key={t} value={t}>{t || "All types"}</option>
          ))}
        </select>
      </div>

      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1a1a1a", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
              {["DEPLOYER", "CHAIN", "TOKENS", "RUGS", "TYPE", "BADGE", "CONF", "LINKED KOLs", "CASES", "LAST SEEN"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 10, letterSpacing: "0.05em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No serial patterns found</td></tr>
            ) : (
              data.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #111111" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 10, color: "#e2e8f0" }}>
                    {truncate(p.deployerAddress, 16)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>{p.chain}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, color: "#f1f5f9" }}>{p.tokenCount}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: p.rugCount > 0 ? "#ef4444" : "#64748b" }}>{p.rugCount}</td>
                  <td style={{ padding: "10px 12px", color: PATTERN_COLOR[p.patternType] ?? "#94a3b8", fontSize: 10, fontWeight: 700 }}>
                    {p.patternType.replace(/_/g, " ").toUpperCase()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: "#f9731622", border: "1px solid #f9731644", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fb923c" }}>
                      {PATTERN_LABEL[p.patternType] ?? "OBSERVED PATTERN"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{p.confidence}%</td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {Array.isArray(p.linkedKolHandles) ? p.linkedKolHandles.length : 0}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11 }}>
                    {Array.isArray(p.linkedCaseIds) ? p.linkedCaseIds.length : 0}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 11 }}>{fmt(p.lastSeenAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
    const res = await fetch("/api/admin/intelligence/stats", { credentials: "include" });
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleIngest = async (slug: string) => {
    setIngesting(slug);
    setIngestResult(null);
    try {
      const res = await fetch("/api/admin/intelligence/stats", {
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
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-orange-400">
            Intelligence Hub
          </h1>
          <p className="text-gray-400 text-sm">
            Entity scoring, source ingestion, case tracking — beta
          </p>
        </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <Stat label="Entities" value={stats.entities.total} />
          <Stat label="Sanctions" value={stats.entities.sanction} color="#ef4444" />
          <Stat label="High Risk" value={stats.entities.high} color="#f97316" />
          <Stat label="Observations" value={stats.observations} />
          <Stat label="Cases" value={stats.cases} />
          <Stat label="Ingests" value={stats.batches} color="#f97316" />
        </div>
      )}

      {/* Ingest result banner */}
      {ingestResult && (
        <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-3 text-sm flex justify-between items-center">
          <span>
            <strong>{ingestResult.sourceSlug}</strong> ingest{" "}
            <span className="font-semibold text-orange-400">
              {ingestResult.status}
            </span>
            {" — "}
            {ingestResult.recordsFetched} fetched, {ingestResult.recordsNew} new,{" "}
            {ingestResult.recordsUpdated} updated, {ingestResult.recordsRemoved} removed
          </span>
          <button
            onClick={() => setIngestResult(null)}
            className="text-gray-500 hover:text-orange-400 transition bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
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
        <TabBtn
          active={tab === "serial_patterns"}
          label="Serial Patterns"
          icon={AlertTriangle}
          onClick={() => setTab("serial_patterns")}
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
      {tab === "serial_patterns" && <SerialPatternsTab />}
      </div>
    </div>
  );
}
