"use client";

import { useEffect, useState } from "react";

const ACCENT = "#FF6B00";

type XThread = {
  id: string;
  title: string;
  target: string | null;
  status: string;
  body: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  tweetUrl: string | null;
  impressions: number | null;
  retweets: number | null;
  likes: number | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#888",
  scheduled: "#3498DB",
  published: "#2ECC71",
};

export default function AdminThreadsPage() {
  const [threads, setThreads] = useState<XThread[]>([]);
  const [tab, setTab] = useState<"all" | "draft" | "scheduled" | "published">("all");
  const [editing, setEditing] = useState<XThread | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", target: "", body: "", status: "draft", scheduledAt: "", tweetUrl: "", impressions: "", retweets: "", likes: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/threads", { credentials: "same-origin" });
    if (res.ok) { const d = await res.json(); setThreads(d.threads ?? []); }
    setLoading(false);
  }

  function startCreate() {
    setForm({ title: "", target: "", body: "", status: "draft", scheduledAt: "", tweetUrl: "", impressions: "", retweets: "", likes: "" });
    setCreating(true);
    setEditing(null);
  }

  function startEdit(t: XThread) {
    setForm({
      title: t.title,
      target: t.target ?? "",
      body: t.body,
      status: t.status,
      scheduledAt: t.scheduledAt ? t.scheduledAt.slice(0, 16) : "",
      tweetUrl: t.tweetUrl ?? "",
      impressions: t.impressions?.toString() ?? "",
      retweets: t.retweets?.toString() ?? "",
      likes: t.likes?.toString() ?? "",
    });
    setEditing(t);
    setCreating(false);
  }

  async function save() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title,
      target: form.target,
      body: form.body,
      status: form.status,
      scheduledAt: form.scheduledAt || null,
      tweetUrl: form.tweetUrl || null,
      impressions: form.impressions ? parseInt(form.impressions) : null,
      retweets: form.retweets ? parseInt(form.retweets) : null,
      likes: form.likes ? parseInt(form.likes) : null,
    };
    if (form.status === "published" && !editing?.publishedAt) {
      payload.publishedAt = new Date().toISOString();
    }
    const url = editing ? `/api/admin/threads/${editing.id}` : "/api/admin/threads";
    const method = editing ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    setEditing(null);
    setCreating(false);
    setSaving(false);
    load();
  }

  async function del(id: string) {
    await fetch(`/api/admin/threads/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (editing?.id === id) setEditing(null);
    load();
  }

  const filtered = tab === "all" ? threads : threads.filter((t) => t.status === tab);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0D0D0D",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#fff",
    fontSize: 12,
    fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "32px 40px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: ACCENT, fontWeight: 700 }}>THREADS X</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{threads.length} threads</div>
          </div>
          <button onClick={startCreate} style={{ padding: "10px 20px", background: ACCENT, color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" }}>
            Nouveau thread
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
          {(["all", "draft", "scheduled", "published"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 14px", background: tab === t ? ACCENT : "rgba(255,255,255,0.04)", color: tab === t ? "#000" : "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>
              {t === "all" ? "Tous" : t === "draft" ? "En attente" : t === "scheduled" ? "Programme" : "Publie"}
            </button>
          ))}
        </div>

        {/* Editor */}
        {(creating || editing) && (
          <div style={{ marginTop: 20, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              {creating ? "Nouveau thread" : `Edition — ${editing!.title}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TITRE</div>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} placeholder="Titre du thread" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>CIBLE</div>
                <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} style={inputStyle} placeholder="GHOST, BOTIFY..." />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>BODY</div>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} style={{ ...inputStyle, fontFamily: "Menlo, monospace", fontSize: 11, resize: "vertical" }} placeholder="Thread content..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>STATUT</div>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>DATE PROGRAMMEE</div>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>TWEET URL</div>
                <input value={form.tweetUrl} onChange={(e) => setForm({ ...form, tweetUrl: e.target.value })} style={inputStyle} placeholder="https://x.com/..." />
              </div>
            </div>
            {form.status === "published" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>IMPRESSIONS</div>
                  <input type="number" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>RETWEETS</div>
                  <input type="number" value={form.retweets} onChange={(e) => setForm({ ...form, retweets: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>LIKES</div>
                  <input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} style={inputStyle} />
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={save} disabled={saving || !form.title.trim()} style={{ padding: "10px 20px", background: ACCENT, color: "#000", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Sauvegarder"}
              </button>
              <button onClick={() => { setEditing(null); setCreating(false); }} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Thread list */}
        <div style={{ marginTop: 20 }}>
          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              Aucun thread. Creez votre premier thread.
            </div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} style={{ padding: 14, background: "#0D0D0D", border: `1px solid ${editing?.id === t.id ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[t.status] ?? "#888" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.title}</span>
                    {t.target && (
                      <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, color: ACCENT, background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)", borderRadius: 4 }}>
                        {t.target}
                      </span>
                    )}
                    <span style={{ fontSize: 10, textTransform: "uppercase", color: STATUS_COLORS[t.status] ?? "#888", fontWeight: 700 }}>
                      {t.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {t.status === "published" && t.tweetUrl && (
                      <a href={t.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: ACCENT, textDecoration: "none" }}>
                        link
                      </a>
                    )}
                    {t.status === "published" && (
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                        {t.impressions?.toLocaleString() ?? "—"} views | {t.retweets ?? "—"} RT | {t.likes ?? "—"} likes
                      </span>
                    )}
                    <button onClick={() => startEdit(t)} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "rgba(255,255,255,0.6)", fontSize: 10, cursor: "pointer" }}>
                      Editer
                    </button>
                    <button onClick={() => del(t.id)} style={{ padding: "4px 10px", background: "rgba(255,0,0,0.04)", border: "1px solid rgba(255,0,0,0.15)", borderRadius: 4, color: "rgba(255,100,100,0.7)", fontSize: 10, cursor: "pointer" }}>
                      Suppr
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                  {t.body.slice(0, 120)}{t.body.length > 120 ? "..." : ""}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  {t.scheduledAt ? `Programme: ${new Date(t.scheduledAt).toLocaleDateString()}` : t.publishedAt ? `Publie: ${new Date(t.publishedAt).toLocaleDateString()}` : `Cree: ${new Date(t.createdAt).toLocaleDateString()}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
