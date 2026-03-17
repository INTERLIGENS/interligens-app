"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function WatchSources() {
  const [sources, setSources]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [name, setName]         = useState("");
  const [url, setUrl]           = useState("");
  const [investigator, setInv]  = useState("@zachxbt");
  const [tags, setTags]         = useState("");
  const [msg, setMsg]           = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/watch-sources", { credentials: "include" });
    const data = await res.json();
    setSources(data.sources ?? []);
    setLoading(false);
  }

  async function addSource() {
    setAdding(true); setMsg(null);
    const res = await fetch("/api/admin/watch-sources", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, investigator, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }),
    });
    const data = await res.json();
    if (res.ok) { setMsg("✓ Source added"); setName(""); setUrl(""); setTags(""); load(); }
    else setMsg(`✗ ${data.error}`);
    setAdding(false);
  }

  async function checkNow(id: string) {
    setChecking(id); setMsg(null);
    const res = await fetch(`/api/admin/watch-sources/${id}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_now" }),
    });
    const data = await res.json();
    setMsg(data.intakeId ? `✓ New content → intake ${data.intakeId}` : "✓ No changes detected");
    setChecking(null);
    load();
  }

  async function removeSource(id: string) {
    await fetch(`/api/admin/watch-sources/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTEL VAULT</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>WATCH SOURCES</h1>
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>Auto-monitored URLs — checked every 6h</div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✓") ? "#14532d" : "#450a0a", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: msg.startsWith("✓") ? "#4ade80" : "#fca5a5", fontSize: 13 }}>{msg}</div>
      )}

      {/* Add form */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>ADD SOURCE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12, marginBottom: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (ex: ZachXBT Scam List)"
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/..."
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
          <input value={investigator} onChange={e => setInv(e.target.value)} placeholder="@investigator"
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags (comma-sep: scam, drainer)"
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
          <button onClick={addSource} disabled={adding || !name || !url}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>
      </div>

      {/* Sources list */}
      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
              {["Name","URL","Investigator","Last Checked","Last Intake","Errors","Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</td></tr>
            ) : sources.filter(s => s.active).length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#475569" }}>No sources yet</td></tr>
            ) : sources.filter(s => s.active).map((s: any) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #0f172a" }}>
                <td style={{ padding: "10px 14px", color: "#f1f5f9", fontWeight: 700 }}>{s.name}</td>
                <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.url}</td>
                <td style={{ padding: "10px 14px", color: "#8b5cf6" }}>{s.investigator}</td>
                <td style={{ padding: "10px 14px", color: "#475569" }}>{s.lastChecked ? new Date(s.lastChecked).toLocaleString() : "never"}</td>
                <td style={{ padding: "10px 14px" }}>
                  {s.lastIntakeId ? <Link href={`/admin/intake/${s.lastIntakeId}`} style={{ color: "#4f46e5", textDecoration: "none" }}>→ view</Link> : "—"}
                </td>
                <td style={{ padding: "10px 14px", color: s.errorCount > 0 ? "#ef4444" : "#475569" }}>{s.errorCount || "—"}</td>
                <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                  <button onClick={() => checkNow(s.id)} disabled={checking === s.id}
                    style={{ background: "#1e3a5f", color: "#60a5fa", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {checking === s.id ? "..." : "Check Now"}
                  </button>
                  <button onClick={() => removeSource(s.id)}
                    style={{ background: "#450a0a", color: "#fca5a5", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
