"use client";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", webhookUrl: "", severityThreshold: "PROBABLE" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/alerts/subscriptions");
      const data = await r.json();
      setSubs(data.subscriptions ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addSubscription() {
    if (!form.email && !form.webhookUrl) return;
    setSaving(true);
    try {
      await fetch("/api/admin/alerts/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ email: "", webhookUrl: "", severityThreshold: "PROBABLE" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function testDeliver() {
    await fetch("/api/cron/alerts/deliver", { method: "POST" });
    alert("Delivery triggered");
  }

  return (
    <div style={{ padding: 32, color: "#f1f5f9", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", letterSpacing: "0.2em", marginBottom: 4 }}>SURVEILLANCE</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>ALERTS</h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Manage alert subscriptions</div>
      </div>

      {/* Add subscription */}
      <div style={{ border: "1px solid #1e293b", borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 12 }}>NEW SUBSCRIPTION</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f172a", color: "#f1f5f9", fontFamily: "monospace", fontSize: 12, flex: 1, minWidth: 200 }} />
          <input placeholder="Webhook URL" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f172a", color: "#f1f5f9", fontFamily: "monospace", fontSize: 12, flex: 2, minWidth: 200 }} />
          <select value={form.severityThreshold} onChange={e => setForm(f => ({ ...f, severityThreshold: e.target.value }))}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f172a", color: "#f1f5f9", fontFamily: "monospace", fontSize: 12 }}>
            <option value="POSSIBLE">POSSIBLE+</option>
            <option value="PROBABLE">PROBABLE+</option>
            <option value="BLATANT">BLATANT only</option>
          </select>
          <button onClick={addSubscription} disabled={saving} style={{
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "monospace",
          }}>
            {saving ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Subscriptions list */}
      {loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading...</div>
      ) : subs.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13, padding: 32, border: "1px solid #1e293b", borderRadius: 8, textAlign: "center" }}>
          No subscriptions yet.
        </div>
      ) : (
        <div style={{ border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
                {["Channel", "Destination", "Threshold", "Status", "Created"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "transparent" : "#0f172a08" }}>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{s.webhookUrl ? "Webhook" : "Email"}</td>
                  <td style={{ padding: "10px 14px", color: "#f1f5f9" }}>{s.webhookUrl || s.email}</td>
                  <td style={{ padding: "10px 14px", color: "#818cf8" }}>{s.severityThreshold}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ color: s.status === "active" ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Test button */}
      <div style={{ marginTop: 20 }}>
        <button onClick={testDeliver} style={{
          padding: "8px 16px", borderRadius: 6, border: "1px solid #1e293b",
          background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 12, fontFamily: "monospace",
        }}>
          Trigger delivery now
        </button>
      </div>
    </div>
  );
}
