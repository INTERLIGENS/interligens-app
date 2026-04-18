"use client";

import { useEffect, useMemo, useState } from "react";
import { describeResponse } from "@/lib/investigators/errorMessages";

const ACCENT = "#FF6B00";

type ThreadStatus =
  | "open"
  | "waiting_on_founder"
  | "waiting_on_investigator"
  | "resolved";

type ConvSummary = {
  id: string;
  status: ThreadStatus | string | null;
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
  status?: ThreadStatus | string;
  messages: MessageItem[];
};

const STATUS_LABEL_FR: Record<ThreadStatus, string> = {
  open: "Ouvert",
  waiting_on_founder: "En attente fondateur",
  waiting_on_investigator: "En attente investigateur",
  resolved: "Résolu",
};

const STATUS_COLOR: Record<ThreadStatus, { fg: string; bg: string; border: string }> = {
  open:                     { fg: "#FF6B00", bg: "rgba(255,107,0,0.10)",  border: "rgba(255,107,0,0.35)" },
  waiting_on_founder:       { fg: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.35)" },
  waiting_on_investigator:  { fg: "#EAB308", bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.35)"  },
  resolved:                 { fg: "#22C55E", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.35)" },
};

const STATUS_ORDER: ThreadStatus[] = [
  "waiting_on_founder",
  "waiting_on_investigator",
  "open",
  "resolved",
];

function normStatus(s: ConvSummary["status"]): ThreadStatus {
  const v = (s ?? "open") as ThreadStatus;
  return STATUS_LABEL_FR[v] ? v : "open";
}

function StatusBadge({ status }: { status: ThreadStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABEL_FR[status]}
    </span>
  );
}

type FilterKey = "all" | ThreadStatus;

const FILTER_ORDER: FilterKey[] = [
  "all",
  "waiting_on_founder",
  "waiting_on_investigator",
  "open",
  "resolved",
];

const FILTER_LABEL_FR: Record<FilterKey, string> = {
  all: "Tous",
  ...STATUS_LABEL_FR,
};

export default function InvestigatorMessagesPage() {
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [activeConv, setActiveConv] = useState<ConvDetail | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/investigators/messages");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } else {
        setLoadError(describeResponse(res));
      }
    } catch {
      setLoadError("Couldn't reach the server — check your connection.");
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
    setSendError(null);
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
      } else {
        setSendError(describeResponse(res));
      }
    } catch {
      setSendError("Couldn't send the message — check your connection.");
    } finally {
      setSending(false);
    }
  }

  async function setThreadStatus(id: string, status: ThreadStatus) {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/investigators/threads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setActiveConv((a) => (a && a.id === id ? { ...a, status } : a));
        loadConversations();
      }
    } finally {
      setStatusBusy(false);
    }
  }

  function relDate(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const m = ms / 60000;
    if (m < 60) return `${Math.round(m)}m`;
    if (m < 1440) return `${Math.round(m / 60)}h`;
    return `${Math.round(m / 1440)}d`;
  }

  // Sort: non-resolved first, then by lastMessage desc
  const sortedConvs = useMemo(() => {
    const ranked = conversations.map((c) => ({
      c,
      rank: STATUS_ORDER.indexOf(normStatus(c.status)),
      ts: c.lastMessage ? new Date(c.lastMessage.createdAt).getTime() : 0,
    }));
    ranked.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.ts - a.ts;
    });
    return ranked.map((r) => r.c);
  }, [conversations]);

  const filteredConvs = useMemo(
    () =>
      filter === "all"
        ? sortedConvs
        : sortedConvs.filter((c) => normStatus(c.status) === filter),
    [sortedConvs, filter],
  );

  const counts = useMemo(() => {
    const by: Record<FilterKey, number> = {
      all: 0,
      open: 0,
      waiting_on_founder: 0,
      waiting_on_investigator: 0,
      resolved: 0,
    };
    for (const c of conversations) {
      const unread = c.unreadCount > 0 ? 1 : 0;
      by.all += unread;
      const s = normStatus(c.status);
      if (unread) by[s] += 1;
    }
    return by;
  }, [conversations]);

  const activeStatus: ThreadStatus | null = activeConv
    ? normStatus(activeConv.status ?? null)
    : null;

  return (
    <div className="inv-messages-root" style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
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
            aria-label="New message to founder"
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
          {sendError && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "#FF3B5C",
              }}
            >
              {sendError}
            </div>
          )}
        </div>

        {/* Status filters */}
        <div style={{ marginTop: 24, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_ORDER.map((k) => {
            const active = filter === k;
            const unread = counts[k];
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: "6px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRadius: 6,
                  cursor: "pointer",
                  border: "1px solid " + (active ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)"),
                  background: active ? "rgba(255,107,0,0.12)" : "#0D0D0D",
                  color: active ? ACCENT : "rgba(255,255,255,0.55)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {FILTER_LABEL_FR[k]}
                {unread > 0 && (
                  <span
                    style={{
                      background: ACCENT,
                      color: "#000",
                      padding: "1px 6px",
                      borderRadius: 8,
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Conversations
        </div>

        {loadError ? (
          <div
            role="alert"
            style={{
              background: "rgba(255,59,92,0.08)",
              border: "1px solid rgba(255,59,92,0.35)",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 12,
              color: "#FF9AAB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadConversations}
              style={{
                background: "transparent",
                color: "#FF9AAB",
                border: "1px solid rgba(255,154,171,0.4)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Loading…</div>
        ) : filteredConvs.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, padding: 20, textAlign: "center" }}>
            {conversations.length === 0
              ? "No conversations yet. Send your first message above."
              : "No conversations match this filter."}
          </div>
        ) : (
          filteredConvs.map((c) => {
            const s = normStatus(c.status);
            return (
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
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>{c.lastMessage?.senderName ?? "—"}</span>
                    <StatusBadge status={s} />
                    {c.lastMessage?.priority === "urgent" && (
                      <span style={{ fontSize: 9, color: "#FF6B6B", fontWeight: 700 }}>URGENT</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.lastMessage?.body.slice(0, 60) ?? "No messages"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.unreadCount > 0 && (
                    <span style={{ background: ACCENT, color: "#000", padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                      {c.unreadCount}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                    {c.lastMessage ? relDate(c.lastMessage.createdAt) : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Active conversation messages */}
        {activeConv && (
          <div style={{ marginTop: 16, background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
                Conversation
                {activeStatus && <StatusBadge status={activeStatus} />}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {activeStatus !== "resolved" ? (
                  <button
                    onClick={() => setThreadStatus(activeConv.id, "resolved")}
                    disabled={statusBusy}
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                      background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)", color: "#22C55E",
                      opacity: statusBusy ? 0.5 : 1,
                    }}
                  >
                    Marquer résolu
                  </button>
                ) : (
                  <button
                    onClick={() => setThreadStatus(activeConv.id, "open")}
                    disabled={statusBusy}
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                      background: "rgba(255,107,0,0.10)", border: "1px solid rgba(255,107,0,0.35)", color: ACCENT,
                      opacity: statusBusy ? 0.5 : 1,
                    }}
                  >
                    Rouvrir
                  </button>
                )}
              </div>
            </div>
            <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
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
