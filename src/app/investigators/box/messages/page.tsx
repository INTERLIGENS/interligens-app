"use client";

import { useEffect, useState } from "react";

const ACCENT = "#FF6B00";

type ConvSummary = {
  id: string;
  lastMessage: { body: string; senderName: string; priority: string; createdAt: string } | null;
  unreadCount: number;
  participants: { accessId: string }[];
};

type MessageItem = {
  id: string;
  senderAccessId: string;
  senderName: string;
  body: string;
  priority: string;
  createdAt: string;
  isRead: boolean;
};

type ConvDetail = {
  id: string;
  messages: MessageItem[];
};

export default function InvestigatorMessagesPage() {
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [activeConv, setActiveConv] = useState<ConvDetail | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    try {
      const res = await fetch("/api/investigators/messages");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openConv(id: string) {
    const res = await fetch(`/api/investigators/messages/${id}`);
    if (res.ok) {
      const data = await res.json();
      setActiveConv(data.conversation);
      await fetch(`/api/investigators/messages/${id}`, { method: "PATCH" });
      loadConversations();
    }
  }

  async function sendMessage(convId?: string) {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      const body: Record<string, string> = { body: newMsg, priority };
      if (convId) body.conversationId = convId;
      else body.toAccessId = "founder";

      const res = await fetch("/api/investigators/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewMsg("");
        const data = await res.json();
        if (data.conversationId) await openConv(data.conversationId);
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  }

  function relDate(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const m = ms / 60000;
    if (m < 60) return `${Math.round(m)}m`;
    if (m < 1440) return `${Math.round(m / 60)}h`;
    return `${Math.round(m / 1440)}d`;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "32px 40px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: ACCENT, fontWeight: 700 }}>
          MESSAGES
          {conversations.some((c) => c.unreadCount > 0) && (
            <span style={{ marginLeft: 8, background: ACCENT, color: "#000", padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>
              {conversations.reduce((s, c) => s + c.unreadCount, 0)} unread
            </span>
          )}
        </div>

        {/* New message */}
        <div style={{ marginTop: 20, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            New message to Founder
          </div>
          <textarea
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Your message..."
            rows={3}
            style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 11 }}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              onClick={() => sendMessage()}
              disabled={sending || !newMsg.trim()}
              style={{ padding: "8px 16px", background: ACCENT, color: "#000", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", opacity: sending ? 0.5 : 1 }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        {/* Conversations */}
        <div style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Conversations
        </div>

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Loading…</div>
        ) : conversations.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, padding: 20, textAlign: "center" }}>
            No conversations yet. Send your first message above.
          </div>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => openConv(c.id)}
              style={{
                padding: 14,
                background: activeConv?.id === c.id ? "rgba(255,107,0,0.06)" : "#0D0D0D",
                border: `1px solid ${activeConv?.id === c.id ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8,
                marginBottom: 6,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                  {c.lastMessage?.senderName ?? "—"}
                  {c.lastMessage?.priority === "urgent" && (
                    <span style={{ marginLeft: 6, fontSize: 9, color: "#FF6B6B", fontWeight: 700 }}>URGENT</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                  {c.lastMessage?.body.slice(0, 60) ?? "No messages"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {c.unreadCount > 0 && (
                  <span style={{ background: ACCENT, color: "#000", padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                    {c.unreadCount}
                  </span>
                )}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  {c.lastMessage ? relDate(c.lastMessage.createdAt) : ""}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Active conversation messages */}
        {activeConv && (
          <div style={{ marginTop: 16, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Conversation
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {activeConv.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.senderAccessId === "founder" ? "flex-start" : "flex-end",
                    maxWidth: "75%",
                    padding: "8px 12px",
                    background: m.senderAccessId === "founder" ? "rgba(255,255,255,0.04)" : "rgba(255,107,0,0.1)",
                    border: `1px solid ${m.senderAccessId === "founder" ? "rgba(255,255,255,0.08)" : "rgba(255,107,0,0.25)"}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    {m.senderName} · {relDate(m.createdAt)}
                    {m.priority === "urgent" && <span style={{ color: "#FF6B6B", marginLeft: 6 }}>URGENT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#fff", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Reply…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(activeConv.id); } }}
                style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "8px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit" }}
              />
              <button
                onClick={() => sendMessage(activeConv.id)}
                disabled={sending || !newMsg.trim()}
                style={{ padding: "8px 16px", background: ACCENT, color: "#000", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
