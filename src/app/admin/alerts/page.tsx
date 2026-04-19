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
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">Alerts</h1>
            <p className="text-gray-400 text-sm">Manage alert subscriptions</p>
          </div>
        </div>

        {/* Add subscription */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">New subscription</h2>
          <div className="flex gap-2 flex-wrap">
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            <input placeholder="Webhook URL" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
              className="flex-[2] min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            <select value={form.severityThreshold} onChange={e => setForm(f => ({ ...f, severityThreshold: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
              <option value="POSSIBLE">POSSIBLE+</option>
              <option value="PROBABLE">PROBABLE+</option>
              <option value="BLATANT">BLATANT only</option>
            </select>
            <button onClick={addSubscription} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition">
              {saving ? "..." : "Add"}
            </button>
          </div>
        </div>

        {/* Subscriptions list */}
        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : subs.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
            No subscriptions yet.
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  {["Channel", "Destination", "Threshold", "Status", "Created"].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-900/50 transition">
                    <td className="py-2 px-3 text-gray-400">{s.webhookUrl ? "Webhook" : "Email"}</td>
                    <td className="py-2 px-3 text-white">{s.webhookUrl || s.email}</td>
                    <td className="py-2 px-3 text-orange-400">{s.severityThreshold}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${s.status === "active" ? "bg-gray-800 text-green-400" : "bg-gray-800 text-red-400"}`}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Test button */}
        <div>
          <button onClick={testDeliver}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Trigger delivery now
          </button>
        </div>
      </div>
    </div>
  );
}
