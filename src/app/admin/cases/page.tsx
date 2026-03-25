"use client";
import { useEffect, useState } from "react";

const SEVERITY_COLOR: Record<string, string> = {
  danger: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
};

const BUCKET_LABEL: Record<string, string> = {
  BLATANT: "BLATANT",
  PROBABLE: "PROBABLE",
  POSSIBLE: "POSSIBLE",
};

export default function CasesPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter) params.set("severity", filter);
      const r = await fetch(`/api/admin/signals?${params}`);
      const data = await r.json();
      setSignals(data.signals ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page, filter]);

  async function generateCasefile(signalId: string) {
    setGenerating(signalId);
    try {
      const r = await fetch("/api/admin/casefiles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId }),
      });
      const data = await r.json();
      if (data.storageKey) {
        alert(`Casefile generated\nSHA256: ${data.pdfSha256}`);
      }
    } catch (e) {
      alert("Error generating casefile");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div style={{ padding: 32, color: "#f1f5f9", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", letterSpacing: "0.2em", marginBottom: 4 }}>SURVEILLANCE</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CASES</h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{total} signal{total !== 1 ? "s" : ""} detected</div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["", "danger", "warn", "info"].map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid",
            borderColor: filter === s ? "#4f46e5" : "#1e293b",
            background: filter === s ? "#4f46e522" : "transparent",
            color: filter === s ? "#818cf8" : "#64748b",
            cursor: "pointer", fontSize: 12, fontFamily: "monospace",
          }}>
            {s || "ALL"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading...</div>
      ) : signals.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13, padding: 32, border: "1px solid #1e293b", borderRadius: 8, textAlign: "center" }}>
          No signals detected yet.<br/>
          <span style={{ fontSize: 11, marginTop: 8, display: "block" }}>Signals are generated when a wallet sells a token shortly after a post mentioning its contract address.</span>
        </div>
      ) : (
        <div style={{ border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
                {["Handle", "Bucket", "Window", "Token", "TX Hash", "Detected", "Action"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "transparent" : "#0f172a08" }}>
                  <td style={{ padding: "10px 14px", color: "#f1f5f9", fontWeight: 700 }}>{s.influencer?.handle}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: `${SEVERITY_COLOR[s.severity ?? "info"]}22`,
                      color: SEVERITY_COLOR[s.severity ?? "info"],
                    }}>
                      {BUCKET_LABEL[s.windowBucket ?? ""] ?? s.windowBucket ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{s.windowMinutes ? `${s.windowMinutes}m` : "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontFamily: "monospace" }}>
                    {s.tokenAddress ? `${s.tokenAddress.slice(0, 8)}...` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {s.t1TxHash ? (
                      <a href={`https://etherscan.io/tx/${s.t1TxHash}`} target="_blank" style={{ color: "#4f46e5", textDecoration: "none" }}>
                        {s.t1TxHash.slice(0, 10)}...
                      </a>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => generateCasefile(s.id)} disabled={generating === s.id} style={{
                      padding: "4px 10px", borderRadius: 4, border: "1px solid #1e293b",
                      background: "transparent", color: "#818cf8", cursor: "pointer",
                      fontSize: 11, fontFamily: "monospace",
                    }}>
                      {generating === s.id ? "..." : "Generate PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 25 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", cursor: "pointer", fontFamily: "monospace" }}>Prev</button>
          <span style={{ padding: "6px 12px", color: "#64748b", fontSize: 12 }}>Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={signals.length < 25} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", cursor: "pointer", fontFamily: "monospace" }}>Next</button>
        </div>
      )}
    </div>
  );
}
