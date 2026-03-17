"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const TIER_COLOR: Record<string,string> = {
  caller: "#8b5cf6", influencer: "#3b82f6",
  research: "#22c55e", unknown: "#6b7280",
};
const RISK_COLOR: Record<string,string> = {
  unverified: "#f59e0b", flagged: "#ef4444", verified: "#22c55e",
};

export default function KolDirectory() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/kol?${params}`, { credentials: "include" });
    const data = await res.json();
    setProfiles(data.profiles ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, search]);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTEL VAULT</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>KOL DIRECTORY</h1>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{total} profiles</div>
        </div>
        <Link href="/admin/intake/new" style={{ background: "#1e293b", color: "#8b5cf6", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700, border: "1px solid #8b5cf622" }}>
          + New Intake
        </Link>
      </div>

      <input
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search @handle..."
        style={{ width: "100%", maxWidth: 400, background: "#111827", border: "1px solid #334155", borderRadius: 8, padding: "10px 16px", color: "#f1f5f9", fontSize: 13, marginBottom: 20, boxSizing: "border-box" }}
      />

      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["Handle","Tier","Price/Post","Platform","Label","Risk","Wallets","Source","Created"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</td></tr>
            ) : profiles.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#475569" }}>No profiles</td></tr>
            ) : profiles.map((p: any) => {
              const wallets = JSON.parse(p.wallets || "[]");
              const intakeIds = JSON.parse(p.sourceIntakeIds || "[]");
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #0f172a" }}>
                  <td style={{ padding: "10px 14px", color: "#c4b5fd", fontWeight: 700 }}>{p.handle}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {p.tier ? <span style={{ background: "#1e1b4b", color: "#a5b4fc", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{p.tier}</span> : <span style={{ color: "#475569" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#22c55e", fontWeight: 700 }}>{p.pricePerPost ? `$${p.pricePerPost.toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{p.platform}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: TIER_COLOR[p.label] ?? "#6b7280", fontWeight: 700 }}>{p.label}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: RISK_COLOR[p.riskFlag] ?? "#6b7280", fontWeight: 600 }}>{p.riskFlag}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{wallets.length || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {intakeIds[0] ? (
                      <Link href={`/admin/intake/${intakeIds[0]}`} style={{ color: "#4f46e5", textDecoration: "none" }}>→ intake</Link>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>← Prev</button>
        <span style={{ color: "#6b7280", padding: "6px 0" }}>Page {page}</span>
        <button onClick={() => setPage(p => p+1)} disabled={profiles.length < 25}
          style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>Next →</button>
      </div>
    </div>
  );
}
