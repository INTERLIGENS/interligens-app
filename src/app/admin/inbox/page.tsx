"use client";

import { useEffect, useState } from "react";

const ACCENT = "#FF6B00";

type FeedbackItem = {
  id: string;
  accessId: string;
  investigatorName: string;
  investigatorEmail: string | null;
  type: string;
  body: string;
  status: string;
  createdAt: string;
};

type ConvItem = {
  id: string;
  participants: string[];
  lastMessage: { body: string; senderName: string; senderAccessId: string; priority: string; createdAt: string } | null;
  unreadCount: number;
};

type InboxData = {
  feedbacks: FeedbackItem[];
  conversations: ConvItem[];
  unreadCount: number;
};

export default function AdminInboxPage() {
  const [data, setData] = useState<InboxData | null>(null);
  const [tab, setTab] = useState<"all" | "unread" | "feedbacks" | "messages" | "urgent">("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadInbox();
  }, []);

  async function loadInbox() {
    const res = await fetch("/api/admin/messages", { credentials: "same-origin" });
    if (res.ok) setData(await res.json());
  }

  async function markRead(id: string) {
    await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status: "read" }),
    });
    loadInbox();
  }

  async function sendReply(toAccessId: string) {
    if (!replyBody.trim() || sending) return;
    setSending(true);
    await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ toAccessId, body: replyBody }),
    });
    setReplyBody("");
    setReplyTo(null);
    setSending(false);
    loadInbox();
  }

  function relDate(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const m = ms / 60000;
    if (m < 60) return `${Math.round(m)}m`;
    if (m < 1440) return `${Math.round(m / 60)}h`;
    return `${Math.round(m / 1440)}d`;
  }

  const feedbacks = data?.feedbacks ?? [];
  const convs = data?.conversations ?? [];

  type UnifiedItem = { kind: "feedback"; data: FeedbackItem } | { kind: "message"; data: ConvItem };

  let items: UnifiedItem[] = [
    ...feedbacks.map((f) => ({ kind: "feedback" as const, data: f })),
    ...convs.map((c) => ({ kind: "message" as const, data: c })),
  ];
  items.sort((a, b) => {
    const aDate = a.kind === "feedback" ? a.data.createdAt : (a.data.lastMessage?.createdAt ?? "");
    const bDate = b.kind === "feedback" ? b.data.createdAt : (b.data.lastMessage?.createdAt ?? "");
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  if (tab === "unread") items = items.filter((i) => i.kind === "feedback" ? i.data.status === "unread" : i.data.unreadCount > 0);
  if (tab === "feedbacks") items = items.filter((i) => i.kind === "feedback");
  if (tab === "messages") items = items.filter((i) => i.kind === "message");
  if (tab === "urgent") items = items.filter((i) => i.kind === "message" && i.data.lastMessage?.priority === "urgent");

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "32px 40px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: ACCENT, fontWeight: 700 }}>
          INBOX FONDATEUR
          {(data?.unreadCount ?? 0) > 0 && (
            <span style={{ marginLeft: 8, background: ACCENT, color: "#000", padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>
              {data?.unreadCount} non lus
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          Messages et feedbacks investigators
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
          {(["all", "unread", "feedbacks", "messages", "urgent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 14px",
                background: tab === t ? ACCENT : "rgba(255,255,255,0.04)",
                color: tab === t ? "#000" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {t === "all" ? "Tous" : t === "unread" ? "Non lus" : t === "feedbacks" ? "Feedbacks" : t === "messages" ? "Messages" : "Urgent"}
            </button>
          ))}
        </div>

        {/* Items */}
        <div style={{ marginTop: 16 }}>
          {!data ? (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              Aucun message en attente.
            </div>
          ) : (
            items.map((item) => {
              if (item.kind === "feedback") {
                const f = item.data;
                return (
                  <div key={`f-${f.id}`} style={{ padding: 14, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, color: "#9B59B6", background: "rgba(155,89,182,0.12)", border: "1px solid rgba(155,89,182,0.3)", borderRadius: 4 }}>
                          FEEDBACK
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{f.investigatorName}</span>
                        {f.investigatorEmail && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{f.investigatorEmail}</span>}
                      </div>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{relDate(f.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{f.body.slice(0, 300)}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {f.status === "unread" && (
                        <button onClick={() => markRead(f.id)} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "rgba(255,255,255,0.6)", fontSize: 10, cursor: "pointer" }}>
                          Marquer traité
                        </button>
                      )}
                      <button onClick={() => setReplyTo(replyTo === f.accessId ? null : f.accessId)} style={{ padding: "4px 10px", background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", borderRadius: 4, color: ACCENT, fontSize: 10, cursor: "pointer" }}>
                        Répondre
                      </button>
                    </div>
                    {replyTo === f.accessId && (
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <input value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Votre réponse…" style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit" }} />
                        <button onClick={() => sendReply(f.accessId)} disabled={sending} style={{ padding: "8px 14px", background: ACCENT, color: "#000", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Envoyer
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              const c = item.data;
              return (
                <div key={`c-${c.id}`} style={{ padding: 14, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "2px 8px", fontSize: 9, fontWeight: 700, color: c.lastMessage?.priority === "urgent" ? "#FF6B6B" : ACCENT, background: c.lastMessage?.priority === "urgent" ? "rgba(255,107,107,0.12)" : "rgba(255,107,0,0.12)", border: `1px solid ${c.lastMessage?.priority === "urgent" ? "rgba(255,107,107,0.3)" : "rgba(255,107,0,0.3)"}`, borderRadius: 4 }}>
                        {c.lastMessage?.priority === "urgent" ? "URGENT" : "MESSAGE"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{c.lastMessage?.senderName ?? "—"}</span>
                      {c.unreadCount > 0 && (
                        <span style={{ background: ACCENT, color: "#000", padding: "1px 6px", borderRadius: 8, fontSize: 9, fontWeight: 700 }}>{c.unreadCount}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{c.lastMessage ? relDate(c.lastMessage.createdAt) : ""}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{c.lastMessage?.body.slice(0, 200) ?? "—"}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
