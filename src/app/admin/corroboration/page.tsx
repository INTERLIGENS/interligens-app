"use client";
import { useEffect, useState } from "react";

export default function CorroborationPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function runCorroboration() {
    setRunning(true); setMsg(null);
    // Call via admin action endpoint
    const res = await fetch("/api/admin/corroboration/run", { method: "POST", credentials: "include" });
    const d = await res.json();
    if (res.ok) { setData(d); setMsg(`✓ Done — ${d.labelsElevated} labels elevated`); }
    else setMsg(`✗ ${d.error}`);
    setRunning(false);
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTEL VAULT</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>CORROBORATION ENGINE</h1>
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>Cross-source address corroboration — runs automatically every 24h</div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✓") ? "#14532d" : "#450a0a", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: msg.startsWith("✓") ? "#4ade80" : "#fca5a5", fontSize: 13 }}>{msg}</div>
      )}

      <button onClick={runCorroboration} disabled={running}
        style={{ background: running ? "#334155" : "#4f46e5", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 900, cursor: running ? "not-allowed" : "pointer", marginBottom: 24 }}>
        {running ? "Running..." : "▶ Run Corroboration Now"}
      </button>

      {data && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              ["Corroborated Addresses", data.corroboratedAddresses],
              ["Labels Elevated",        data.labelsElevated],
              ["Top Evidence",           data.top10?.[0]?.evidenceCount ?? 0],
            ].map(([l,v]) => (
              <div key={l as string} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{l}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#4f46e5" }}>{v}</div>
              </div>
            ))}
          </div>

          {data.top10?.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: "0.1em" }}>TOP CORROBORATED ADDRESSES</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    {["Address","Chain","Evidence Count","Confidence"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top10.map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0f172a" }}>
                      <td style={{ padding: "8px 14px", color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>{r.address}</td>
                      <td style={{ padding: "8px 14px", color: "#64748b" }}>{r.chain}</td>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ background: "#1e3a5f", color: "#60a5fa", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{r.evidenceCount}</span>
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ color: r.confidence === "high" ? "#22c55e" : r.confidence === "medium" ? "#f59e0b" : "#6b7280", fontWeight: 700 }}>{r.confidence}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
