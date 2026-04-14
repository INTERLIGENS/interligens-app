"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// SEC-007 — previously read `process.env.NEXT_PUBLIC_ADMIN_TOKEN`. The constant
// was never actually used and the pattern was a booby trap (any future misname
// would ship the admin token into the client bundle). Removed.

const STATUS_COLOR: Record<string,string> = {
  pending:      "#f59e0b",
  routed:       "#22c55e",
  needs_manual: "#f97316",
  archived:     "#6b7280",
  failed:       "#ef4444",
};
const CLASS_COLOR: Record<string,string> = {
  ioc:    "#ef4444",
  kol:    "#8b5cf6",
  mixed:  "#f97316",
  rawdoc: "#6b7280",
};

export default function IntakeInbox() {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("");
  const [classification, setCls] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
        const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (classification) params.set("classification", classification);
    const res = await fetch(`/api/admin/intake?${params}`, { credentials: "include", headers: { } });
    const data = await res.json();
    setRecords(data.records ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, status, classification]);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTEL VAULT</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>INTAKE INBOX</h1>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{total} records</div>
        </div>
        <Link href="/admin/intake/new" style={{ background: "#4f46e5", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          + New Intake
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {["","pending","routed","needs_manual","archived","failed"].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            style={{ background: status === s ? "#4f46e5" : "#1e293b", color: status === s ? "#fff" : "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {s || "All"}
          </button>
        ))}
        <div style={{ width: 1, background: "#334155" }} />
        {["","ioc","kol","mixed","rawdoc"].map(c => (
          <button key={c} onClick={() => { setCls(c); setPage(1); }}
            style={{ background: classification === c ? "#1e3a5f" : "#1e293b", color: classification === c ? "#60a5fa" : "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {c || "All types"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["Status","Type","Source","Classification","Confidence","Warnings","Batch","Created"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, letterSpacing: "0.05em", fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#475569" }}>No records</td></tr>
            ) : records.map((r: any) => {
              const warns = JSON.parse(r.extractWarnings || "[]");
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: (STATUS_COLOR[r.status] ?? "#6b7280") + "22", color: STATUS_COLOR[r.status] ?? "#6b7280", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{r.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{r.inputType}</td>
                  <td style={{ padding: "10px 14px", color: "#cbd5e1", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sourceRef ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: CLASS_COLOR[r.classification] ?? "#6b7280", fontWeight: 700 }}>{r.classification ?? "—"}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{r.routerConfidence ? (r.routerConfidence * 100).toFixed(0) + "%" : "—"}</td>
                  <td style={{ padding: "10px 14px", color: warns.length ? "#f97316" : "#475569" }}>{warns.length ? warns.length + " ⚠" : "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {r.linkedBatchId ? (
                      <Link href={`/admin/intel-vault/batch/${r.linkedBatchId}`} style={{ color: "#60a5fa", textDecoration: "none" }}>→ batch</Link>
                    ) : r.pendingBatch ? <span style={{ color: "#f97316" }}>pending</span> : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Link href={`/admin/intake/${r.id}`} style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 700 }}>View →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>← Prev</button>
        <span style={{ color: "#6b7280", padding: "6px 0" }}>Page {page}</span>
        <button onClick={() => setPage(p => p+1)} disabled={records.length < 25}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>Next →</button>
      </div>
    </div>
  );
}
